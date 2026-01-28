# 技能与方案文档

本文档记录项目开发中的常见问题解决方案、开发技巧和最佳实践。

## 常见问题解决方案

### 图标文件缺失问题

**问题描述：** 插件加载时提示缺少图标文件（icon16.png, icon48.png, icon128.png）

**解决方案：**

1. **使用 Python 脚本生成（推荐）**
   ```bash
   pip install Pillow
   python generate-icons.py
   ```

2. **使用 HTML 工具生成**
   - 在浏览器中打开 `generate-icons.html`
   - 点击"生成图标"按钮
   - 下载并重命名文件到 `icons/` 目录

3. **使用在线工具**
   - 访问 https://www.favicon-generator.org/
   - 上传 512x512 图片
   - 下载生成的图标文件

4. **临时占位图标**
   - 创建纯色 PNG 图片（16x16, 48x48, 128x128）
   - 建议使用主题色 #667eea

**注意：** 图标文件缺失可能导致扩展加载报错或无法加载，请尽快补齐图标文件。

### 跨域图片提取失败

**问题描述：** 某些网站的图片无法提取，控制台显示 CORS 错误

**原因：** 浏览器的跨域安全限制，某些网站设置了 CORS 策略阻止图片访问

**解决方案：**

1. **使用代理或 CORS 代理服务**
   - 在 `content.js` 中实现图片代理逻辑
   - 使用第三方 CORS 代理（不推荐，有隐私风险）

2. **提示用户手动上传**
   - 检测到跨域图片时，提示用户手动上传
   - 提供右键菜单"保存图片"功能

3. **使用 Canvas 转换**
   ```javascript
   // 在 content.js 中
   const canvas = document.createElement('canvas');
   const ctx = canvas.getContext('2d');
   const img = new Image();
   img.crossOrigin = 'anonymous';
   img.onload = () => {
     canvas.width = img.width;
     canvas.height = img.height;
     ctx.drawImage(img, 0, 0);
     const dataUrl = canvas.toDataURL('image/png');
     // 使用 dataUrl
   };
   img.src = imageUrl;
   ```

**最佳实践：** 在提取图片前先检查是否可访问，失败时提供友好的错误提示。

### 数据存储大小限制

**问题描述：** Chrome Storage API 有存储限制（通常 10MB），大量图片会导致存储空间不足

**解决方案：**

1. **使用 IndexedDB 存储图片**
   - 项目已实现 `image-storage.js`，使用 IndexedDB 存储大文件
   - 在 `storage.js` 中调用 `getImageStorage()` 使用

2. **图片压缩**
   - 在 `content.js` 的图片提取流程中进行压缩
   - 自动压缩图片到最大 800px（宽或高）
   - 使用 JPEG 格式（质量 0.8）减少文件大小

3. **定期清理**
   - 提供数据清理功能
   - 删除不需要的笔记和图片
   - 导出备份后清理

**代码示例：**
```javascript
// 使用 ImageStorage 存储图片
const imageStorage = await noteStorage.getImageStorage();
if (imageStorage) {
  const imageId = await imageStorage.saveImage(base64Data);
  // 在笔记中只存储 imageId，而不是完整的 base64
}
```

### 云服务认证问题

**问题描述：** Google Drive、Notion 等云服务认证失败

**Google Drive 认证失败：**

1. **检查 Client ID 配置**
   - 确认在 Google Cloud Console 中正确创建了 OAuth 客户端
   - 应用类型选择"Chrome 应用"
   - 检查 Chrome Extension ID 是否添加到重定向 URI

2. **检查 API 启用状态**
   - 确认已启用 Google Drive API
   - 检查 API 配额是否超限

3. **Token 过期处理**
   - 实现 Token 刷新逻辑
   - 检测到过期时自动重新认证

**Notion 认证失败：**

1. **检查 Integration Token**
   - 确认 Token 格式正确
   - 检查 Token 是否已过期或被撤销

2. **检查 Database 权限**
   - 确认 Database 已授权给 Integration
   - 检查 Integration 权限范围

3. **检查 Database ID 格式**
   - Database ID 应该是 32 位十六进制字符串
   - 从 URL 中提取：`https://www.notion.so/workspace/DATABASE_ID`

**代码示例：**
```javascript
// 在 cloud-services.js 中处理认证错误
try {
  await googleDriveService.authenticate();
} catch (error) {
  if (error.message.includes('access_denied')) {
    errorHandler.showError('用户取消了认证');
  } else {
    errorHandler.showError('认证失败：' + error.message);
  }
}
```

### 侧边栏显示异常

**问题描述：** 侧边栏无法显示、位置错误或样式异常

**解决方案：**

1. **检查 iframe 加载**
   - 确认 `sidebar.html` 在 `web_accessible_resources` 中
   - 检查 iframe 的 `src` 路径是否正确

2. **检查 CSS 冲突**
   - 使用 Shadow DOM 隔离样式（如果可能）
   - 使用更具体的选择器避免冲突
   - 检查 z-index 设置

3. **检查内容脚本注入**
   - 确认 `content.js` 正确注入
   - 检查消息传递是否正常

**调试方法：**
```javascript
// 在 content.js 中
console.log('Sidebar iframe:', document.getElementById('fact-notebook-sidebar'));
console.log('Sidebar visible:', document.getElementById('fact-notebook-sidebar')?.style.display);
```

## 开发技巧

### 右键菜单保存页面内容

**需求场景：** 希望在页面空白处右键即可保存当前页面的文本与图片

**实现要点：**
1. 在 `background.js` 的右键菜单上下文中加入 `page`
2. 右键点击时通过 `content.js` 的 `capturePage` 获取页面内容
3. 保存时统一走 `NoteStorage.saveNote` 以支持图片迁移到 IndexedDB

### 弹窗文档库标签

**需求场景：** 在弹窗模式中切换查看文档库统计与列表

**实现要点：**
1. 在 `popup.html` 头部加入“笔记 / 文档库”标签
2. 在 `popup.js` 中实现视图切换与 `loadLibraryView` 渲染
3. 在 `popup.css` 添加文档库统计卡片与列表样式

### Chrome Extension 调试方法

**Popup 调试：**
1. 右键点击插件图标
2. 选择"检查弹出内容"
3. 在 DevTools 中调试

**Sidebar 调试：**
1. 在侧边栏中按 F12
2. 或右键点击侧边栏 → 检查
3. 注意：侧边栏是 iframe，需要单独打开 DevTools

**Content Script 调试：**
1. 在网页中按 F12
2. 在 Console 中查看日志
3. 使用 `chrome.runtime.sendMessage` 测试消息传递

**Background Service Worker 调试：**
1. 访问 `chrome://extensions/`
2. 找到插件，点击"service worker"链接
3. 在 DevTools 中调试后台脚本

**调试技巧：**
```javascript
// 使用 chrome.storage.local 查看存储数据
chrome.storage.local.get(null, (data) => {
  console.log('All storage:', data);
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
});
```

### Content Script 与页面通信

**向页面发送消息：**
```javascript
// 在 content.js 中
chrome.runtime.sendMessage({
  type: 'GET_PAGE_CONTENT',
  url: window.location.href
}, (response) => {
  console.log('Response:', response);
});
```

**接收 Background 消息：**
```javascript
// 在 content.js 中
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    const content = extractPageContent();
    sendResponse({ success: true, content });
  }
  return true; // 保持消息通道开放
});
```

**与 Popup/Sidebar 通信：**
```javascript
// 在 popup.js 或 sidebar.js 中
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'GET_PAGE_INFO'
  }, (response) => {
    console.log('Page info:', response);
  });
});
```

### Chrome Storage API 使用

**存储数据：**
```javascript
// 存储单个值
chrome.storage.local.set({ key: 'value' }, () => {
  console.log('Saved');
});

// 存储多个值
chrome.storage.local.set({
  key1: 'value1',
  key2: 'value2'
}, () => {
  console.log('Saved');
});
```

**读取数据：**
```javascript
// 读取单个值
chrome.storage.local.get(['key'], (result) => {
  console.log('Value:', result.key);
});

// 读取多个值
chrome.storage.local.get(['key1', 'key2'], (result) => {
  console.log('Values:', result);
});

// 读取所有数据
chrome.storage.local.get(null, (result) => {
  console.log('All data:', result);
});
```

**监听存储变化：**
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', changes);
  console.log('Area:', areaName);
});
```

**错误处理：**
```javascript
chrome.storage.local.set(data, () => {
  if (chrome.runtime.lastError) {
    console.error('Storage error:', chrome.runtime.lastError);
    if (chrome.runtime.lastError.message.includes('QUOTA_BYTES')) {
      errorHandler.showError('存储空间不足');
    }
  }
});
```

### 图片压缩和 Base64 编码

**图片压缩（`content.js` 提取图片时内置）：**
```javascript
// 在 content.js 的图片提取流程中
const maxSize = 800;
let width = img.width;
let height = img.height;

if (width > maxSize || height > maxSize) {
  const ratio = Math.min(maxSize / width, maxSize / height);
  width = Math.floor(width * ratio);
  height = Math.floor(height * ratio);
}

canvas.width = width;
canvas.height = height;
ctx.drawImage(img, 0, 0, width, height);
const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
```

**Base64 转 Blob：**
```javascript
function base64ToBlob(base64, mimeType) {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}
```

### 防抖和节流应用

**防抖（Debounce）- 用于自动保存：**
```javascript
// 在 common.js 中已实现
const debouncedSave = debounce(async () => {
  await saveNote();
}, 2000); // 停止输入 2 秒后保存

// 使用
inputElement.addEventListener('input', () => {
  debouncedSave();
});
```

**节流（Throttle）- 用于滚动事件：**
```javascript
// 在 common.js 中已实现
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 100); // 每 100ms 最多执行一次

// 使用
window.addEventListener('scroll', throttledScroll);
```

## 最佳实践

### 错误处理模式

**统一错误处理：**
```javascript
// 使用 error-handler.js 中的 ErrorHandler
try {
  await operation();
} catch (error) {
  const message = errorHandler.handleError(error, {
    operation: 'save'
  });
  errorHandler.showError(message);
}
```

**异步函数包装：**
```javascript
// 使用 wrapAsync 自动处理错误
await errorHandler.wrapAsync(async () => {
  await saveNote();
}, { operation: 'save' });
```

**错误分类处理：**
- `QuotaExceededError`: 存储空间不足
- `NetworkError`: 网络错误
- `TypeError`: 数据格式错误
- `NotFoundError`: 资源未找到

### 数据导入导出格式

**导出格式（默认不包含图片）：**
```json
{
  "version": "1.0",
  "exportDate": "2024-01-01T00:00:00.000Z",
  "totalNotes": 10,
  "notes": [
    {
      "id": "timestamp",
      "title": "笔记标题",
      "url": "https://example.com",
      "text": "文本内容",
      "imageCount": 2,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "category": "分类",
      "tags": ["标签1", "标签2"]
    }
  ]
}
```

**包含图片时：**
- `notes` 会输出完整笔记对象（可能包含 `images` 或 `imageIds`），与存储结构一致。

**导入验证：**
```javascript
function validateImportData(data) {
  if (!data.notes || !Array.isArray(data.notes)) {
    throw new Error('无效的导入文件格式');
  }
  return data.notes.map(note => ({
    id: note.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
    title: note.title || '',
    url: note.url || '',
    text: note.text || '',
    images: note.images || [],
    imageIds: note.imageIds || [],
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString()
  }));
}
```

### 云服务集成模式

**统一接口设计：**
```javascript
class CloudService {
  async authenticate() {}
  async isAuthenticated() {}
  async upload(data) {}
  async logout() {}
}

// 各云服务实现统一接口
class GoogleDriveService extends CloudService { }
class NotionService extends CloudService { }
class ObsidianService extends CloudService { }
```

**配置管理：**
```javascript
// 在 chrome.storage.local 中存储配置
const config = {
  googleDrive: {
    clientId: 'xxx',
    token: 'xxx'
  },
  notion: {
    token: 'xxx',
    databaseId: 'xxx'
  }
};
```

### 性能优化建议

1. **延迟加载**
   - 使用 `getImageStorage()` 延迟初始化 IndexedDB
   - 图片列表使用虚拟滚动（如果数量很大）

2. **数据分页**
   - 大量笔记时实现分页加载
   - 使用 `chrome.storage.local.get()` 分批读取

3. **缓存策略**
   - 缓存页面内容提取结果
   - 避免重复的 API 调用

4. **内存管理**
   - 及时清理不需要的 DOM 元素
   - 使用 WeakMap 存储临时数据

5. **异步操作**
   - 所有 I/O 操作使用异步
   - 使用 Promise.all() 并行处理

**代码示例：**
```javascript
// 批量处理笔记
async function processNotesInBatches(notes, batchSize = 10) {
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = notes.slice(i, i + batchSize);
    await Promise.all(batch.map(note => processNote(note)));
  }
}
```
