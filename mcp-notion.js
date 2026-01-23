/**
 * MCP Notion 集成类
 * 通过 MCP Server 调用 Notion 工具创建页面
 */
class McpNotionService {
  constructor() {
    this.serverUrl = null;
    this.apiKey = null;
    this.databaseId = null;
    this.toolName = 'notion-create-pages';
    this.enabled = false;
  }

  /**
   * 初始化 MCP Notion 配置
   * @param {Object} options - 配置项
   * @param {string|null} [options.serverUrl] - MCP Server URL
   * @param {string|null} [options.apiKey] - MCP API Key（可选）
   * @param {string|null} [options.databaseId] - Notion Database ID
   * @param {string|null} [options.toolName] - MCP Tool Name
   * @param {boolean} [options.enabled] - 是否启用 MCP
   */
  async init({
    serverUrl,
    apiKey,
    databaseId,
    toolName,
    enabled
  } = {}) {
    if (serverUrl !== undefined) {
      this.serverUrl = serverUrl;
    }
    if (apiKey !== undefined) {
      this.apiKey = apiKey;
    }
    if (databaseId !== undefined) {
      this.databaseId = databaseId;
    }
    if (toolName !== undefined) {
      this.toolName = toolName || 'notion-create-pages';
    }
    if (typeof enabled === 'boolean') {
      this.enabled = enabled;
    }

    await chrome.storage.local.set({
      mcpNotionServerUrl: this.serverUrl,
      mcpNotionApiKey: this.apiKey,
      mcpNotionToolName: this.toolName,
      mcpNotionEnabled: this.enabled,
      notionDatabaseId: this.databaseId
    });
  }

  /**
   * 从存储中恢复配置
   */
  async restoreConfig() {
    const stored = await chrome.storage.local.get([
      'mcpNotionServerUrl',
      'mcpNotionApiKey',
      'mcpNotionToolName',
      'mcpNotionEnabled',
      'notionDatabaseId'
    ]);

    this.serverUrl = stored.mcpNotionServerUrl || null;
    this.apiKey = stored.mcpNotionApiKey || null;
    this.toolName = stored.mcpNotionToolName || 'notion-create-pages';
    this.enabled = !!stored.mcpNotionEnabled;
    this.databaseId = stored.notionDatabaseId || null;
  }

  /**
   * 检查是否已配置
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.serverUrl;
  }

  /**
   * 检查是否启用 MCP
   * @returns {boolean}
   */
  isEnabled() {
    return !!this.enabled;
  }

  /**
   * 构建 Notion Markdown 内容
   * @param {Object} note - 笔记对象
   * @returns {string}
   * @private
   */
  buildContent(note) {
    const sections = [];

    if (note.url) {
      sections.push(`来源: ${note.url}`);
    }

    if (note.category) {
      sections.push(`分类: ${note.category}`);
    }

    if (note.tags && note.tags.length > 0) {
      sections.push(`标签: ${note.tags.map(tag => `#${tag}`).join(' ')}`);
    }

    if (note.text) {
      sections.push(note.text);
    }

    if (note.images && note.images.length > 0) {
      const imageLines = note.images
        .filter(image => typeof image === 'string' && image.startsWith('http'))
        .map((image, index) => `![图片 ${index + 1}](${image})`);
      if (imageLines.length > 0) {
        sections.push(imageLines.join('\n'));
      }
    }

    if (sections.length === 0) {
      return '（无内容）';
    }

    return sections.join('\n\n');
  }

  /**
   * 构建 MCP 页面数据
   * @param {Object} note - 笔记对象
   * @returns {Object}
   * @private
   */
  buildPage(note) {
    return {
      properties: {
        title: note.title || '无标题'
      },
      content: this.buildContent(note)
    };
  }

  /**
   * 调用 MCP Server
   * @param {string} method - MCP 方法
   * @param {Object} params - MCP 参数
   * @returns {Promise<Object>} MCP 响应
   * @private
   */
  async callMcp(method, params) {
    if (!this.serverUrl) {
      throw new Error('MCP Server URL 未配置');
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`MCP 请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      const message = data.error.message || 'MCP 调用失败';
      throw new Error(message);
    }

    return data.result;
  }

  /**
   * 批量创建 Notion 页面（通过 MCP）
   * @param {Array<Object>} notes - 笔记数组
   * @param {string} [databaseId] - Notion Database ID
   * @returns {Promise<Object>} MCP 调用结果
   */
  async createPages(notes, databaseId = null) {
    const parentId = databaseId || this.databaseId;
    if (!parentId) {
      throw new Error('需要指定 Notion Database ID 或 Parent ID');
    }

    const pages = notes.map(note => this.buildPage(note));
    const result = await this.callMcp('tools/call', {
      name: this.toolName,
      arguments: {
        parent: { database_id: parentId },
        pages
      }
    });

    if (result && result.isError) {
      const message = result.content || 'MCP Notion 调用失败';
      throw new Error(message);
    }

    return result;
  }
}
