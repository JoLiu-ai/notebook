// Background Service Worker

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('事实笔记本插件已安装');
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

