// Content Script - 用于从网页提取内容和注入侧边栏

let sidebarIframe = null;
let isSidebarVisible = false;

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleSidebar') {
    toggleSidebar();
    sendResponse({ success: true });
  } else if (request.action === 'capturePage') {
    capturePageContent()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放
  }
});

// 切换侧边栏显示/隐藏
function toggleSidebar() {
  if (isSidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

// 显示侧边栏
function showSidebar() {
  if (sidebarIframe && sidebarIframe.parentElement) {
    sidebarIframe.parentElement.style.display = 'block';
    isSidebarVisible = true;
    chrome.storage.local.set({ sidebarVisible: true });
    return;
  }

  // 创建侧边栏容器
  const container = document.createElement('div');
  container.id = 'fact-notebook-sidebar-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    transition: right 0.3s ease, left 0.3s ease;
  `;

  // 创建 iframe
  sidebarIframe = document.createElement('iframe');
  sidebarIframe.id = 'fact-notebook-sidebar';
  sidebarIframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    pointer-events: auto;
    background: white;
  `;
  sidebarIframe.src = chrome.runtime.getURL('sidebar.html');

  container.appendChild(sidebarIframe);
  document.body.appendChild(container);
  isSidebarVisible = true;
  chrome.storage.local.set({ sidebarVisible: true });
}

// 隐藏侧边栏
function hideSidebar() {
  if (sidebarIframe && sidebarIframe.parentElement) {
    sidebarIframe.parentElement.style.display = 'none';
    isSidebarVisible = false;
    chrome.storage.local.set({ sidebarVisible: false });
  }
}

// 监听来自 iframe 的消息
let isResizing = false;

window.addEventListener('message', (event) => {
  if (event.data.type === 'resizeSidebar') {
    const container = document.getElementById('fact-notebook-sidebar-container');
    if (container) {
      container.style.width = `${event.data.width}px`;
      // 更新位置
      if (event.data.position === 'left') {
        container.style.left = '0';
        container.style.right = 'auto';
      } else {
        container.style.right = '0';
        container.style.left = 'auto';
      }
    }
  } else if (event.data.type === 'hideSidebar') {
    hideSidebar();
  } else if (event.data.type === 'updateSidebarPosition') {
    const container = document.getElementById('fact-notebook-sidebar-container');
    if (container) {
      if (event.data.position === 'left') {
        container.style.left = '0';
        container.style.right = 'auto';
      } else {
        container.style.right = '0';
        container.style.left = 'auto';
      }
    }
  } else if (event.data.type === 'startResize') {
    isResizing = true;
    // 在父窗口监听鼠标移动，以便在鼠标移出 iframe 时也能继续调整
    const handleParentMouseMove = (e) => {
      if (isResizing && sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          type: 'mousemove',
          event: { clientX: e.clientX }
        }, '*');
      }
    };
    
    const handleParentMouseUp = () => {
      if (isResizing && sidebarIframe && sidebarIframe.contentWindow) {
        sidebarIframe.contentWindow.postMessage({
          type: 'mouseup'
        }, '*');
        isResizing = false;
        document.removeEventListener('mousemove', handleParentMouseMove);
        document.removeEventListener('mouseup', handleParentMouseUp);
      }
    };
    
    document.addEventListener('mousemove', handleParentMouseMove);
    document.addEventListener('mouseup', handleParentMouseUp);
  } else if (event.data.type === 'endResize') {
    isResizing = false;
  }
});

// 初始化：默认显示侧边栏
chrome.storage.local.get(['sidebarVisible'], (result) => {
  // 如果没有设置过，默认显示；如果设置过，按设置来
  if (result.sidebarVisible === undefined || result.sidebarVisible) {
    showSidebar();
  }
});

// 捕获页面内容
async function capturePageContent() {
  const result = {
    text: '',
    images: []
  };

  // 提取文本内容
  result.text = extractTextContent();

  // 提取图片
  result.images = await extractImages();

  return result;
}

// 提取文本内容
function extractTextContent() {
  // 移除脚本和样式标签
  const scripts = document.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());

  // 获取主要内容区域
  const mainContent = document.querySelector('main, article, [role="main"], .content, .post-content, .article-content');
  const contentElement = mainContent || document.body;

  // 提取文本
  let text = contentElement.innerText || contentElement.textContent || '';

  // 清理文本
  text = text
    .replace(/\s+/g, ' ') // 合并多个空格
    .replace(/\n\s*\n/g, '\n') // 合并多个换行
    .trim();

  // 限制长度
  if (text.length > 5000) {
    text = text.substring(0, 5000) + '...';
  }

  return text;
}

// 提取图片
async function extractImages() {
  const images = [];
  const imgElements = document.querySelectorAll('img');

  // 限制图片数量
  const maxImages = 5;
  const selectedImages = Array.from(imgElements)
    .filter(img => {
      // 过滤掉太小的图片（可能是图标）
      return img.naturalWidth > 100 && img.naturalHeight > 100;
    })
    .slice(0, maxImages);

  for (const img of selectedImages) {
    try {
      const imageData = await imageToBase64(img);
      if (imageData) {
        images.push(imageData);
      }
    } catch (error) {
      console.error('提取图片失败:', error);
    }
  }

  return images;
}

// 图片转 base64
function imageToBase64(img) {
  return new Promise((resolve, reject) => {
    // 检查图片是否有效
    if (!img.src) {
      reject(new Error('图片没有 src'));
      return;
    }

    // 如果是 data URL 或 blob URL，直接返回
    if (img.src.startsWith('data:') || img.src.startsWith('blob:')) {
      resolve(img.src);
      return;
    }

    // 尝试使用 fetch 获取图片（适用于同源或 CORS 允许的图片）
    fetch(img.src)
      .then(response => {
        if (!response.ok) {
          throw new Error('图片获取失败');
        }
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          // 压缩图片（如果太大）
          const imgElement = new Image();
          imgElement.onload = () => {
            const maxSize = 800;
            let width = imgElement.width;
            let height = imgElement.height;

            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height);
              width = Math.floor(width * ratio);
              height = Math.floor(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgElement, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          imgElement.onerror = () => resolve(reader.result); // 如果压缩失败，使用原始数据
          imgElement.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // fetch 失败，尝试使用 canvas（需要处理跨域）
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const newImg = new Image();
        
        newImg.crossOrigin = 'anonymous';
        newImg.onload = () => {
          const maxSize = 800;
          let width = newImg.width;
          let height = newImg.height;

          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(newImg, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        newImg.onerror = () => {
          // 如果所有方法都失败，返回原始 URL（用户可能需要手动处理）
          console.warn('无法提取图片，返回原始 URL:', img.src);
          resolve(img.src);
        };
        newImg.src = img.src;
      });
  });
}

