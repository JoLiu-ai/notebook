// Content Script - 用于从网页提取内容和注入侧边栏
(function () {
  if (window.__factNotebookContentScriptLoaded) {
    return;
  }
  window.__factNotebookContentScriptLoaded = true;

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
  } else if (request.action === 'captureImage') {
    captureImageByUrl(request.srcUrl)
      .then(imageData => sendResponse({ success: true, imageData }))
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
  // 侧边栏 iframe 请求当前页面信息（URL/标题）
  if (event.data && event.data.type === 'factNotebook:getPageInfo') {
    if (sidebarIframe && sidebarIframe.contentWindow) {
      sidebarIframe.contentWindow.postMessage({
        type: 'factNotebook:pageInfo',
        requestId: event.data.requestId,
        url: window.location.href,
        title: document.title
      }, '*');
    }
    return;
  }

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

// 捕获页面内容（保留格式：代码块、标题、加粗/斜体、列表、图片顺序）
async function capturePageContent() {
  return await extractContentAsMarkdown();
}

// 占位符前缀，用于在 Markdown 中标记图片位置，展示时由 common.js 替换为真实图片
const IMAGE_PLACEHOLDER_PREFIX = '{{IMAGE_';

function findLiveImgBySrc(src, usedSet) {
  if (!src) return null;
  for (const img of document.images) {
    if ((img.src === src || img.currentSrc === src) && !usedSet.has(img)) {
      usedSet.add(img);
      return img;
    }
  }
  return null;
}

/**
 * 按当前站点获取文章正文根节点（优先匹配知识星球等站点结构，与 articles.zsxq.com 格式一致）
 * @returns {Element}
 */
function getArticleRoot() {
  const host = (document.location.hostname || '').toLowerCase();

  if (host.includes('zsxq.com') || host.includes('articles.zsxq.com')) {
    const zsxqSelectors = [
      '.quill-editor',           // 知识星球文章正文容器 post js_watermark quill-editor
      '.post.quill-editor',
      '.rich-content',
      '.article-content',
      '.topic-content',
      '.post-content',
      '[class*="article-body"]',
      '[class*="topic-detail"]',
      '[class*="content-body"]',
      'main',
      'article',
      '[role="main"]'
    ];
    for (const sel of zsxqSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 20) return el;
    }
  }

  const generic = document.querySelector('main, article, [role="main"], .content, .post-content, .article-content, .rich-content');
  return generic || document.body;
}

/**
 * 将 DOM 转为 Markdown，保留代码块、标题、列表、图片顺序等
 * @returns {Promise<{ text: string, images: string[] }>}
 */
async function extractContentAsMarkdown() {
  const root = getArticleRoot();
  const clone = root.cloneNode(true);
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  const state = {
    parts: [],
    images: [],
    imageIndex: 0,
    length: 0,
    maxLength: 15000,
    maxImages: 15,
    usedLiveImgs: new Set()
  };

  async function walk(el, listPrefix = '') {
    if (state.length >= state.maxLength) return;
    if (el.nodeType === Node.TEXT_NODE) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) {
        state.parts.push(text);
        state.length += text.length;
      }
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;

    const tag = el.tagName.toLowerCase();
    if (tag === 'img') {
      if (state.images.length >= state.maxImages) return;
      const src = el.getAttribute('src');
      if (!src) return;
      const alt = (el.getAttribute('alt') || el.getAttribute('title') || '图片').trim().slice(0, 80);
      const liveImg = findLiveImgBySrc(src, state.usedLiveImgs);
      if (!liveImg || (liveImg.naturalWidth <= 80 && liveImg.naturalHeight <= 80)) return;
      try {
        const data = await imageToBase64(liveImg);
        if (data) {
          state.images.push(data);
          const placeholder = `${IMAGE_PLACEHOLDER_PREFIX}${state.imageIndex}}}`;
          state.parts.push(`\n![${alt}](${placeholder})\n`);
          state.imageIndex += 1;
          state.length += 20;
        }
      } catch (e) {
        console.warn('提取图片失败', e);
      }
      return;
    }

    switch (tag) {
      case 'h1':
        state.parts.push('\n# ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'h2':
        state.parts.push('\n## ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'h3':
        state.parts.push('\n### ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'h4':
        state.parts.push('\n#### ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'h5':
        state.parts.push('\n##### ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'h6':
        state.parts.push('\n###### ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'pre': {
        const code = el.querySelector('code');
        const content = (code || el).textContent || '';
        if (content.trim()) {
          state.parts.push('\n```\n' + content.trim() + '\n```\n');
          state.length += content.length;
        }
        break;
      }
      case 'code':
        if (el.closest('pre')) break;
        state.parts.push('`');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('`');
        break;
      case 'p':
      case 'div':
      case 'section':
        state.parts.push('\n');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'br':
        state.parts.push('\n');
        break;
      case 'ul':
        state.parts.push('\n');
        for (const li of el.children) {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            state.parts.push('\n- ');
            for (const c of li.childNodes) await walk(c);
          }
        }
        state.parts.push('\n');
        break;
      case 'ol':
        state.parts.push('\n');
        let idx = 0;
        for (const li of el.children) {
          if (li.tagName && li.tagName.toLowerCase() === 'li') {
            idx += 1;
            state.parts.push('\n' + idx + '. ');
            for (const c of li.childNodes) await walk(c);
          }
        }
        state.parts.push('\n');
        break;
      case 'li':
        for (const c of el.childNodes) await walk(c);
        break;
      case 'blockquote':
        state.parts.push('\n> ');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('\n');
        break;
      case 'strong':
      case 'b':
        state.parts.push('**');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('**');
        break;
      case 'em':
      case 'i':
        state.parts.push('*');
        for (const c of el.childNodes) await walk(c);
        state.parts.push('*');
        break;
      case 'a': {
        const href = el.getAttribute('href');
        const text = (el.textContent || '').trim();
        if (href && text) {
          state.parts.push(`[${text}](${href})`);
        } else if (href) {
          state.parts.push(href);
        } else {
          for (const c of el.childNodes) await walk(c);
        }
        state.length += (text || href || '').length + 4;
        break;
      }
      default:
        for (const c of el.childNodes) await walk(c);
    }
  }

  for (const child of clone.childNodes) {
    await walk(child);
    if (state.length >= state.maxLength) break;
  }

  let text = state.parts.join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > state.maxLength) {
    text = text.substring(0, state.maxLength) + '...';
  }
  return { text, images: state.images };
}

// 兼容：仅要纯文本时使用（如无格式的旧逻辑）
function extractTextContent() {
  const el = getArticleRoot();
  const clone = el.cloneNode(true);
  clone.querySelectorAll('script, style, noscript').forEach(e => e.remove());
  let text = (clone.textContent || '').replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  if (text.length > 5000) text = text.substring(0, 5000) + '...';
  return text;
}

// 提取图片（兼容旧逻辑，不保证与正文顺序一致）
async function extractImages() {
  const images = [];
  const maxImages = 5;
  const imgs = Array.from(document.querySelectorAll('img'))
    .filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
    .slice(0, maxImages);
  for (const img of imgs) {
    try {
      const data = await imageToBase64(img);
      if (data) images.push(data);
    } catch (e) {
      console.error('提取图片失败:', e);
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

// 根据图片 URL 获取 base64（优先匹配 DOM 图片）
async function captureImageByUrl(srcUrl) {
  if (!srcUrl) {
    throw new Error('图片地址为空');
  }

  const imgElement = Array.from(document.images).find(img => {
    return img.currentSrc === srcUrl || img.src === srcUrl;
  });

  if (imgElement) {
    return await imageToBase64(imgElement);
  }

  return await imageUrlToBase64(srcUrl);
}

function imageUrlToBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      reject(new Error('图片地址为空'));
      return;
    }

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      resolve(imageUrl);
      return;
    }

    fetch(imageUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('图片获取失败');
        }
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(() => {
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
          console.warn('无法提取图片，返回原始 URL:', imageUrl);
          resolve(imageUrl);
        };
        newImg.src = imageUrl;
      });
  });
}
})();
