// Background Service Worker
importScripts('image-storage.js', 'backup-handle-storage.js', 'storage.js');

const noteStorageInstance = typeof noteStorage !== 'undefined' ? noteStorage : new NoteStorage();
const CONTEXT_MENU_ID = 'saveToNote';
const CONTEXT_MENU_TITLE = '保存到知识笔记';
const CONTEXT_MENU_CONTEXTS = ['page', 'selection', 'image', 'link'];
const ACTION_ERROR_BADGE_COLOR = '#d93025';
const ACTION_DEFAULT_TITLE = '知识笔记';

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:') ||
    url.startsWith('moz-extension://')
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function flashActionError(tabId, title) {
  if (!tabId) return;
  try {
    await chrome.action.setBadgeBackgroundColor({ color: ACTION_ERROR_BADGE_COLOR, tabId });
    await chrome.action.setBadgeText({ text: '!', tabId });
    if (title) {
      await chrome.action.setTitle({ title, tabId });
    }
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId });
      chrome.action.setTitle({ title: ACTION_DEFAULT_TITLE, tabId });
    }, 2000);
  } catch (error) {
    console.warn('设置扩展按钮状态失败:', error);
  }
}

async function sendToggleMessage(tabId, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'toggleSidebar' });
      return true;
    } catch (error) {
      await delay(80);
    }
  }
  return false;
}

function ensureContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: CONTEXT_MENU_TITLE,
      contexts: CONTEXT_MENU_CONTEXTS
    });
  });
}

// 安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('知识笔记插件已安装');
  ensureContextMenus();
  
  // 如果是更新，提醒用户备份数据
  if (details.reason === 'update') {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '知识笔记已更新',
      message: '建议备份您的数据，避免数据丢失。点击插件图标打开备份设置。'
    });
  }
});

// 浏览器启动时确保右键菜单存在
chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus();
});

// 监听扩展被禁用/卸载（Manifest V3 中可能不可用，但尝试监听）
try {
  chrome.runtime.onSuspend?.addListener(() => {
    // 扩展即将被禁用/卸载
    console.log('扩展即将被禁用/卸载，提醒用户备份数据');
    // 注意：此时可能无法显示通知，因为扩展正在被卸载
  });
} catch (error) {
  // onSuspend 在 Manifest V3 中可能不可用
  console.log('onSuspend 事件不可用');
}

// 监听存储变化，检测数据清空（可能是卸载前的操作）
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // 如果检测到所有数据被清空，可能是用户准备卸载
    if (changes.fact_notebook_notes && 
        (!changes.fact_notebook_notes.newValue || changes.fact_notebook_notes.newValue.length === 0) &&
        changes.fact_notebook_notes.oldValue && 
        changes.fact_notebook_notes.oldValue.length > 0) {
      // 数据被清空，可能是误操作或准备卸载
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '数据已清空',
        message: '所有笔记数据已被清空。如果这是误操作，请尽快从备份恢复数据。'
      });
    }
  }
});

// 点击插件图标时切换侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) {
      return;
    }
    if (isRestrictedUrl(tab.url)) {
      await flashActionError(tab.id, '当前页面不支持侧边栏');
      return;
    }

    const sent = await sendToggleMessage(tab.id, 1);
    if (sent) {
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    const retried = await sendToggleMessage(tab.id, 5);
    if (!retried) {
      await flashActionError(tab.id, '侧边栏未响应');
    }
  } catch (error) {
    console.error('无法切换侧边栏:', error);
    if (tab?.id) {
      await flashActionError(tab.id, '无法打开侧边栏');
    }
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
  if (info.menuItemId === CONTEXT_MENU_ID) {
    try {
      const pageUrl = info.pageUrl || tab?.url || '';
      const note = {
        title: '',
        url: pageUrl,
        text: '',
        images: []
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
          const imageBase64 = await imageUrlToBase64(info.srcUrl, tab?.id);
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

      const shouldCapturePage = !info.selectionText && !info.linkUrl && !(info.mediaType === 'image');
      if (shouldCapturePage && tab?.id) {
        try {
          const pageContent = await capturePageFromTab(tab.id);
          if (pageContent?.text) {
            note.text = note.text ? note.text + '\n\n' + pageContent.text : pageContent.text;
          }
          if (pageContent?.images?.length) {
            note.images = note.images.concat(pageContent.images);
          }
        } catch (error) {
          console.warn('捕获页面内容失败:', error);
        }
      }

      // 如果没有标题，使用页面标题
      if (!note.title) {
        note.title = tab?.title || pageUrl || '无标题';
      }

      // 保存笔记
      await noteStorageInstance.saveNote(note);
      
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

async function capturePageFromTab(tabId) {
  const response = await sendMessageToTab(tabId, { action: 'capturePage' });
  if (!response?.success) {
    throw new Error(response?.error || 'capturePage failed');
  }
  return response;
}

async function captureImageFromTab(tabId, srcUrl) {
  const response = await sendMessageToTab(tabId, { action: 'captureImage', srcUrl });
  if (!response?.success) {
    throw new Error(response?.error || 'captureImage failed');
  }
  return response.imageData;
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!tabId) throw error;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

// 将图片 URL 转换为 base64
async function imageUrlToBase64(imageUrl, tabId) {
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
    if (tabId) {
      try {
        return await captureImageFromTab(tabId, imageUrl);
      } catch (captureError) {
        throw captureError;
      }
    }
    throw error;
  }
}
