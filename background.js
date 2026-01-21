// Background Service Worker

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('知识笔记插件已安装');
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "saveToNote",
    title: "保存到知识笔记",
    contexts: ["selection", "image", "link"]
  });
});

// 点击插件图标时切换侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  // 向当前标签页的 content script 发送消息
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
  } catch (error) {
    // 如果 content script 未加载，先注入它
    console.log('注入 content script');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    // 等待一下再发送消息
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
      } catch (e) {
        console.error('无法切换侧边栏:', e);
      }
    }, 100);
  }
});

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sidebarClosed') {
    // 侧边栏已关闭，更新状态
    chrome.storage.local.set({ sidebarVisible: false });
    sendResponse({ success: true });
  }
});

// 监听快捷键（可选功能）
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'save-current-page') {
    // 可以在这里实现快捷键保存功能
    console.log('快捷键保存当前页面');
  }
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveToNote") {
    try {
      const note = {
        id: Date.now().toString(),
        title: '',
        url: tab.url,
        text: '',
        images: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 处理选中的文本
      if (info.selectionText) {
        note.text = info.selectionText;
        note.title = info.selectionText.substring(0, 50) + (info.selectionText.length > 50 ? '...' : '');
      }

      // 处理图片
      if (info.mediaType === 'image' && info.srcUrl) {
        try {
          // 将图片 URL 转换为 base64
          const imageBase64 = await imageUrlToBase64(info.srcUrl);
          note.images = [imageBase64];
          if (!note.title) {
            note.title = '保存的图片';
          }
        } catch (error) {
          console.error('转换图片失败:', error);
          // 如果转换失败，保存图片 URL
          note.text = (note.text ? note.text + '\n\n' : '') + `图片链接: ${info.srcUrl}`;
        }
      }

      // 处理链接
      if (info.linkUrl) {
        note.url = info.linkUrl;
        if (info.linkText) {
          note.title = info.linkText;
          note.text = (note.text ? note.text + '\n\n' : '') + `链接: ${info.linkUrl}`;
        } else {
          note.title = info.linkUrl;
        }
      }

      // 如果没有标题，使用页面标题
      if (!note.title) {
        note.title = tab.title || '无标题';
      }

      // 保存笔记
      await saveNoteToStorage(note);
      
      // 显示通知
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '知识笔记',
        message: '已保存到笔记'
      });
    } catch (error) {
      console.error('保存笔记失败:', error);
    }
  }
});

// 将图片 URL 转换为 base64
async function imageUrlToBase64(imageUrl) {
  try {
    // 使用 fetch 获取图片
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    // 如果跨域或其他错误，尝试使用 content script 获取
    throw error;
  }
}

// 保存笔记到存储
async function saveNoteToStorage(note) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['fact_notebook_notes'], (result) => {
      const notes = result.fact_notebook_notes || [];
      
      // 检查是否已存在（更新场景）
      const existingIndex = notes.findIndex(n => n.id === note.id);
      if (existingIndex >= 0) {
        notes[existingIndex] = note;
      } else {
        notes.push(note);
      }

      chrome.storage.local.set({ fact_notebook_notes: notes }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(note);
        }
      });
    });
  });
}
