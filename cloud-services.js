/**
 * 云服务集成模块
 * 支持 Google Drive、Notion、Obsidian 等云服务
 */

/**
 * Google Drive API 集成类
 * 提供文件上传、OAuth 认证等功能
 */
class GoogleDriveService {
  constructor() {
    this.clientId = null;
    this.accessToken = null;
    this.apiBase = 'https://www.googleapis.com/drive/v3';
    this.uploadBase = 'https://www.googleapis.com/upload/drive/v3';
  }

  /**
   * 初始化 Google Drive 服务
   * @param {string} clientId - Google OAuth Client ID
   * @returns {Promise<void>}
   */
  async init(clientId) {
    this.clientId = clientId;
    // 尝试从存储中恢复 access token
    const stored = await chrome.storage.local.get(['googleDriveToken']);
    if (stored.googleDriveToken) {
      this.accessToken = stored.googleDriveToken;
    }
  }

  /**
   * 启动 OAuth 认证流程
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    if (!this.clientId) {
      throw new Error('Google Drive Client ID 未配置');
    }

    return new Promise((resolve, reject) => {
      const redirectUri = chrome.identity.getRedirectURL();
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ].join(' ');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}`;

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!responseUrl) {
          reject(new Error('认证被取消'));
          return;
        }

        // 从响应 URL 中提取 access token
        // responseUrl 格式: chrome-extension://xxx/#access_token=xxx&token_type=Bearer&expires_in=3600
        const hash = responseUrl.split('#')[1];
        if (!hash) {
          reject(new Error('无法解析认证响应'));
          return;
        }

        const urlParams = new URLSearchParams(hash);
        const token = urlParams.get('access_token');
        
        if (token) {
          this.accessToken = token;
          chrome.storage.local.set({ googleDriveToken: token });
          resolve(token);
        } else {
          const error = urlParams.get('error');
          reject(new Error(error || '无法获取 access token'));
        }
      });
    });
  }

  /**
   * 检查是否已认证
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * 登出
   */
  async logout() {
    this.accessToken = null;
    await chrome.storage.local.remove(['googleDriveToken']);
  }

  /**
   * 上传文件到 Google Drive
   * @param {Blob|string} content - 文件内容（Blob 或字符串）
   * @param {string} filename - 文件名
   * @param {string} mimeType - MIME 类型
   * @returns {Promise<Object>} 上传后的文件信息
   */
  async uploadFile(content, filename, mimeType = 'text/plain') {
    if (!this.accessToken) {
      await this.authenticate();
    }

    // 将内容转换为 Blob（如果需要）
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

    // 创建文件元数据
    const metadata = {
      name: filename,
      mimeType: mimeType
    };

    // 使用 multipart upload
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    try {
      const response = await fetch(`${this.uploadBase}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          // Token 过期，重新认证
          await this.logout();
          await this.authenticate();
          return this.uploadFile(content, filename, mimeType);
        }
        throw new Error(`上传失败: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Google Drive 上传失败:', error);
      throw error;
    }
  }

  /**
   * 创建文件夹
   * @param {string} folderName - 文件夹名称
   * @returns {Promise<Object>} 创建的文件夹信息
   */
  async createFolder(folderName) {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    try {
      const response = await fetch(`${this.apiBase}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.logout();
          await this.authenticate();
          return this.createFolder(folderName);
        }
        throw new Error(`创建文件夹失败: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Google Drive 创建文件夹失败:', error);
      throw error;
    }
  }
}

/**
 * Notion API 集成类
 * 提供页面创建、内容上传等功能
 */
class NotionService {
  constructor() {
    this.apiKey = null;
    this.apiBase = 'https://api.notion.com/v1';
    this.databaseId = null;
  }

  /**
   * 初始化 Notion 服务
   * @param {string} apiKey - Notion Integration Token
   * @param {string} [databaseId] - Notion Database ID（可选）
   */
  async init(apiKey, databaseId = null) {
    this.apiKey = apiKey;
    this.databaseId = databaseId;
    await chrome.storage.local.set({
      notionApiKey: apiKey,
      notionDatabaseId: databaseId
    });
  }

  /**
   * 检查是否已配置
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * 从存储中恢复配置
   */
  async restoreConfig() {
    const stored = await chrome.storage.local.get(['notionApiKey', 'notionDatabaseId']);
    if (stored.notionApiKey) {
      this.apiKey = stored.notionApiKey;
      this.databaseId = stored.notionDatabaseId || null;
    }
  }

  /**
   * 创建 Notion 页面
   * @param {Object} note - 笔记对象
   * @param {string} [parentId] - 父页面或数据库 ID
   * @returns {Promise<Object>} 创建的页面信息
   */
  async createPage(note, parentId = null) {
    if (!this.apiKey) {
      throw new Error('Notion API Key 未配置');
    }

    // 确定 parent
    let parent;
    if (parentId) {
      parent = { database_id: parentId };
    } else if (this.databaseId) {
      parent = { database_id: this.databaseId };
    } else {
      throw new Error('需要指定 Notion Database ID 或 Parent ID');
    }

    // 构建页面内容
    const children = [];

    // 添加标题
    if (note.title) {
      children.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{
            type: 'text',
            text: { content: note.title }
          }]
        }
      });
    }

    // 添加 URL（如果有）
    if (note.url) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: '来源: ' },
              annotations: { bold: true }
            },
            {
              type: 'text',
              text: { content: note.url, link: { url: note.url } },
              annotations: { underline: true }
            }
          ]
        }
      });
    }

    // 添加文本内容
    if (note.text) {
      const textBlocks = note.text.split('\n\n');
      textBlocks.forEach(block => {
        if (block.trim()) {
          children.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: block }
              }]
            }
          });
        }
      });
    }

    // 添加图片（如果有）
    if (note.images && note.images.length > 0) {
      note.images.forEach(imageData => {
        // Notion 需要图片 URL，Base64 需要先上传
        // 这里简化处理，只支持 URL
        if (imageData.startsWith('http')) {
          children.push({
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: { url: imageData }
            }
          });
        }
      });
    }

    // 构建页面属性
    const properties = {
      title: {
        title: [{
          type: 'text',
          text: { content: note.title || '无标题' }
        }]
      }
    };

    // 添加标签（如果有）
    if (note.tags && note.tags.length > 0) {
      properties.Tags = {
        multi_select: note.tags.map(tag => ({ name: tag }))
      };
    }

    // 添加分类（如果有）
    if (note.category) {
      properties.Category = {
        select: { name: note.category }
      };
    }

    const pageData = {
      parent: parent,
      properties: properties,
      children: children
    };

    try {
      const response = await fetch(`${this.apiBase}/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(pageData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`创建页面失败: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Notion 创建页面失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建页面
   * @param {Array<Object>} notes - 笔记数组
   * @param {string} [parentId] - 父页面或数据库 ID
   * @returns {Promise<Array<Object>>} 创建的页面数组
   */
  async createPages(notes, parentId = null) {
    const results = [];
    for (const note of notes) {
      try {
        const page = await this.createPage(note, parentId);
        results.push(page);
        // 添加延迟避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`创建笔记 "${note.title}" 失败:`, error);
        results.push({ error: error.message, note });
      }
    }
    return results;
  }
}

/**
 * Obsidian 集成类
 * 支持通过 URI 协议或文件系统导出笔记
 */
class ObsidianService {
  constructor() {
    this.vaultPath = null;
    this.useUri = false; // 是否使用 Obsidian URI 协议
  }

  /**
   * 初始化 Obsidian 服务
   * @param {string} [vaultPath] - Obsidian 仓库路径（可选，用于本地文件写入）
   */
  async init(vaultPath = null) {
    this.vaultPath = vaultPath;
    this.useUri = !vaultPath; // 如果没有指定路径，使用 URI 协议
    if (vaultPath) {
      await chrome.storage.local.set({ obsidianVaultPath: vaultPath });
    }
  }

  /**
   * 从存储中恢复配置
   */
  async restoreConfig() {
    const stored = await chrome.storage.local.get(['obsidianVaultPath']);
    if (stored.obsidianVaultPath) {
      this.vaultPath = stored.obsidianVaultPath;
      this.useUri = false;
    }
  }

  /**
   * 检查是否已配置
   * @returns {boolean}
   */
  isConfigured() {
    return this.vaultPath !== null || this.useUri;
  }

  /**
   * 导出笔记到 Obsidian（通过 URI 协议）
   * @param {Object} note - 笔记对象
   * @returns {Promise<void>}
   */
  async exportNote(note) {
    if (this.useUri) {
      return this.exportViaUri(note);
    } else {
      return this.exportViaFileSystem(note);
    }
  }

  /**
   * 通过 Obsidian URI 协议导出
   * @param {Object} note - 笔记对象
   * @private
   */
  async exportViaUri(note) {
    // 构建 Markdown 内容
    const markdown = this.buildMarkdown(note);
    
    // 使用 Obsidian URI 协议
    const filename = this.sanitizeFilename(note.title || '无标题') + '.md';
    const uri = `obsidian://new?vault=&file=${encodeURIComponent(filename)}&content=${encodeURIComponent(markdown)}`;
    
    // 创建隐藏的链接并点击
    const link = document.createElement('a');
    link.href = uri;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 通过文件系统导出（需要文件系统访问权限）
   * @param {Object} note - 笔记对象
   * @private
   */
  async exportViaFileSystem(note) {
    // 注意：Chrome Extension 无法直接访问文件系统
    // 这个方法需要用户手动选择文件夹或使用 File System Access API（需要用户交互）
    const markdown = this.buildMarkdown(note);
    const filename = this.sanitizeFilename(note.title || '无标题') + '.md';
    
    // 使用 File System Access API
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Markdown files',
          accept: { 'text/markdown': ['.md'] }
        }]
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(markdown);
      await writable.close();
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }
  }

  /**
   * 构建 Markdown 内容
   * @param {Object} note - 笔记对象
   * @returns {string} Markdown 字符串
   * @private
   */
  buildMarkdown(note) {
    let markdown = `# ${note.title || '无标题'}\n\n`;
    
    if (note.url) {
      markdown += `**来源**: [${note.url}](${note.url})\n\n`;
    }
    
    if (note.category) {
      markdown += `**分类**: ${note.category}\n\n`;
    }
    
    if (note.tags && note.tags.length > 0) {
      markdown += `**标签**: ${note.tags.map(t => `#${t}`).join(' ')}\n\n`;
    }
    
    if (note.text) {
      markdown += `## 内容\n\n${note.text}\n\n`;
    }
    
    if (note.images && note.images.length > 0) {
      markdown += `## 图片\n\n`;
      note.images.forEach((imageData, index) => {
        if (imageData.startsWith('data:')) {
          // Base64 图片，保存为本地引用
          markdown += `![图片 ${index + 1}](images/${note.id}_${index}.png)\n\n`;
        } else {
          markdown += `![图片 ${index + 1}](${imageData})\n\n`;
        }
      });
    }
    
    if (note.createdAt) {
      markdown += `**创建时间**: ${new Date(note.createdAt).toLocaleString('zh-CN')}\n`;
    }
    
    return markdown;
  }

  /**
   * 清理文件名
   * @param {string} name - 原始文件名
   * @returns {string} 清理后的文件名
   * @private
   */
  sanitizeFilename(name) {
    return name.replace(/[\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
  }
}

/**
 * 云服务管理器
 * 统一管理所有云服务的初始化和导出操作
 */
class CloudServicesManager {
  constructor() {
    this.googleDrive = new GoogleDriveService();
    this.notion = new NotionService();
    this.obsidian = new ObsidianService();
  }

  /**
   * 初始化所有服务
   */
  async init() {
    // 从存储中恢复配置
    await this.notion.restoreConfig();
    await this.obsidian.restoreConfig();
    
    // Google Drive 需要 Client ID，从配置中读取
    const config = await chrome.storage.local.get(['googleDriveClientId']);
    if (config.googleDriveClientId) {
      await this.googleDrive.init(config.googleDriveClientId);
    }
  }

  /**
   * 导出笔记到 Google Drive
   * @param {Object|Array<Object>} notes - 笔记对象或数组
   * @param {string} format - 导出格式（'json', 'md', 'pdf', 'docx'）
   * @param {boolean} includeImages - 是否包含图片
   * @returns {Promise<Object>} 上传结果
   */
  async exportToGoogleDrive(notes, format = 'md', includeImages = false) {
    const notesArray = Array.isArray(notes) ? notes : [notes];
    
    // 生成文件内容
    let content, filename, mimeType;
    
    if (format === 'json') {
      const exportData = buildJsonExportData(notesArray, includeImages);
      content = JSON.stringify(exportData, null, 2);
      filename = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else if (format === 'md') {
      content = buildMarkdownContent(notesArray, includeImages);
      filename = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.md`;
      mimeType = 'text/markdown';
    } else {
      throw new Error(`不支持的格式: ${format}`);
    }

    return await this.googleDrive.uploadFile(content, filename, mimeType);
  }

  /**
   * 导出笔记到 Notion
   * @param {Object|Array<Object>} notes - 笔记对象或数组
   * @param {string} [databaseId] - Notion Database ID
   * @returns {Promise<Array<Object>>} 创建结果
   */
  async exportToNotion(notes, databaseId = null) {
    const notesArray = Array.isArray(notes) ? notes : [notes];
    return await this.notion.createPages(notesArray, databaseId);
  }

  /**
   * 导出笔记到 Obsidian
   * @param {Object|Array<Object>} notes - 笔记对象或数组
   * @returns {Promise<void>}
   */
  async exportToObsidian(notes) {
    const notesArray = Array.isArray(notes) ? notes : [notes];
    
    for (const note of notesArray) {
      await this.obsidian.exportNote(note);
      // 添加延迟避免过快触发
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * 导出单例
 * @type {CloudServicesManager}
 */
const cloudServices = new CloudServicesManager();
