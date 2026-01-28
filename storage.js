/**
 * 数据存储管理类
 * 负责笔记的存储、检索和管理
 */
class NoteStorage {
  /**
   * 创建 NoteStorage 实例
   */
  constructor() {
    this.STORAGE_KEY = 'fact_notebook_notes';
    // 延迟初始化 ImageStorage，避免在非浏览器环境出错
    this.imageStorage = null;
  }

  /**
   * 获取 ImageStorage 实例
   * @returns {Promise<Object|null>} ImageStorage 实例，如果不可用则返回 null
   */
  async getImageStorage() {
    if (!this.imageStorage && typeof indexedDB !== 'undefined') {
      // 检查 imageStorage 是否已定义（通过 script 标签加载）
      if (typeof imageStorage !== 'undefined') {
        this.imageStorage = imageStorage;
        await this.imageStorage.init();
      }
    }
    return this.imageStorage;
  }

  /**
   * 获取所有笔记
   * @returns {Promise<Array<Object>>} 笔记数组，按创建时间倒序排列
   */
  async getAllNotes() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        const notes = result[this.STORAGE_KEY] || [];
        // 按创建时间倒序排列
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(notes);
      });
    });
  }

  /**
   * 保存笔记
   * @param {Object} note - 笔记对象
   * @param {string} [note.id] - 笔记 ID，如果不存在则自动生成
   * @param {string} note.title - 笔记标题
   * @param {string} [note.url] - 笔记 URL
   * @param {string} [note.text] - 笔记文本内容
   * @param {Array<string>} [note.images] - 图片数组（Base64）
   * @param {Array<string>} [note.imageIds] - 图片 ID 数组（IndexedDB）
   * @param {string} [note.category] - 分类
   * @param {Array<string>} [note.tags] - 标签数组
   * @returns {Promise<Object>} 保存后的笔记对象
   * @throws {Error} 如果保存失败
   */
  async saveNote(note) {
    return new Promise(async (resolve, reject) => {
      try {
        const notes = await this.getAllNotes();
        
        // 如果没有ID，说明是新笔记
        if (!note.id) {
          note.id = Date.now().toString();
          note.createdAt = new Date().toISOString();
        }
        note.updatedAt = new Date().toISOString();

        // 处理图片：如果图片是 base64 数据，迁移到 IndexedDB
        if (note.images && Array.isArray(note.images) && note.images.length > 0) {
          const imgStorage = await this.getImageStorage();
          if (imgStorage) {
            // 检查图片是否是 base64 数据（需要迁移）
            const needsMigration = note.images.some(img => 
              typeof img === 'string' && img.startsWith('data:image')
            );
            
            if (needsMigration) {
              // 迁移图片到 IndexedDB
              const imageIds = await imgStorage.saveImages(note.images, note.id);
              note.imageIds = imageIds;
              note.images = []; // 清空 base64 数据
            } else if (note.imageIds) {
              // 如果已有 imageIds，保持使用
              // 如果图片数组有变化，需要更新
            }
          }
        }

        // 检查是否已存在（更新场景）
        const existingIndex = notes.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
          notes[existingIndex] = note;
        } else {
          notes.push(note);
        }

        chrome.storage.local.set({ [this.STORAGE_KEY]: notes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(note);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 删除笔记
   * @param {string} noteId - 笔记 ID
   * @returns {Promise<void>}
   * @throws {Error} 如果删除失败
   */
  async deleteNote(noteId) {
    return new Promise(async (resolve, reject) => {
      try {
        const notes = await this.getAllNotes();
        const filteredNotes = notes.filter(n => n.id !== noteId);
        
        // 删除关联的图片
        const imgStorage = await this.getImageStorage();
        if (imgStorage) {
          await imgStorage.deleteImagesByNoteId(noteId);
        }
        
        chrome.storage.local.set({ [this.STORAGE_KEY]: filteredNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取笔记（包含图片）
   * @param {string} noteId - 笔记 ID
   * @returns {Promise<Object|null>} 笔记对象，如果不存在则返回 null
   */
  async getNoteWithImages(noteId) {
    const note = await this.getNote(noteId);
    if (!note) return null;

    // 如果有 imageIds，从 IndexedDB 加载图片
    if (note.imageIds && Array.isArray(note.imageIds) && note.imageIds.length > 0) {
      const imgStorage = await this.getImageStorage();
      if (imgStorage) {
        note.images = await imgStorage.getImagesByNoteId(noteId);
      }
    }
    // 如果没有 imageIds 但有 images（旧数据），直接返回
    // 如果没有 images，返回空数组
    if (!note.images) {
      note.images = [];
    }

    return note;
  }

  /**
   * 获取所有笔记（包含图片）
   * @param {boolean} [loadImages=false] - 是否加载图片（可能很慢，谨慎使用）
   * @returns {Promise<Array<Object>>} 笔记数组
   */
  async getAllNotesWithImages(loadImages = false) {
    const notes = await this.getAllNotes();
    
    if (loadImages) {
      const imgStorage = await this.getImageStorage();
      if (imgStorage) {
        // 批量加载图片（可能很慢，谨慎使用）
        for (const note of notes) {
          if (note.imageIds && Array.isArray(note.imageIds) && note.imageIds.length > 0) {
            note.images = await imgStorage.getImagesByNoteId(note.id);
          } else if (!note.images) {
            note.images = [];
          }
        }
      }
    }
    
    return notes;
  }

  /**
   * 获取单个笔记
   * @param {string} noteId - 笔记 ID
   * @returns {Promise<Object|undefined>} 笔记对象，如果不存在则返回 undefined
   */
  async getNote(noteId) {
    const notes = await this.getAllNotes();
    return notes.find(n => n.id === noteId);
  }

  /**
   * 搜索笔记
   * @param {string} query - 搜索关键词
   * @returns {Promise<Array<Object>>} 匹配的笔记数组
   */
  async searchNotes(query) {
    const notes = await this.getAllNotes();
    if (!query) return notes;

    const lowerQuery = query.toLowerCase();
    return notes.filter(note => {
      return (
        note.title?.toLowerCase().includes(lowerQuery) ||
        note.text?.toLowerCase().includes(lowerQuery) ||
        note.url?.toLowerCase().includes(lowerQuery)
      );
    });
  }
}

/**
 * 备份管理器类
 * 负责自动备份和恢复功能
 */
class BackupManager {
  constructor() {
    this.backupFolderHandle = null;
    this.autoBackupEnabled = false;
    this.backupFrequency = 'every-save';
    this.cloudBackupEnabled = false;
    this.lastBackupDate = null;
    this.handleStorageKey = 'backupFolderHandle';
  }

  /**
   * 初始化备份管理器
   */
  async init() {
    try {
      const config = await chrome.storage.local.get([
        'autoBackupEnabled',
        'backupFrequency',
        'cloudBackupEnabled',
        'lastBackupDate',
        'backupFolderPath'
      ]);
      
      this.autoBackupEnabled = config.autoBackupEnabled || false;
      this.backupFrequency = config.backupFrequency || 'every-save';
      this.cloudBackupEnabled = config.cloudBackupEnabled || false;
      this.lastBackupDate = config.lastBackupDate || null;

      // 从 IndexedDB 恢复文件夹句柄（如果可用）
      if (typeof backupHandleStorage !== 'undefined') {
        try {
          this.backupFolderHandle = await backupHandleStorage.getHandle(this.handleStorageKey);
          if (!config.backupFolderPath && this.backupFolderHandle?.name) {
            await chrome.storage.local.set({ backupFolderPath: this.backupFolderHandle.name });
          }
        } catch (error) {
          console.warn('无法恢复备份文件夹句柄:', error);
          this.backupFolderHandle = null;
        }
      }
    } catch (error) {
      console.error('初始化备份管理器失败:', error);
    }
  }

  /**
   * 保存备份设置
   */
  async saveSettings() {
    await chrome.storage.local.set({
      autoBackupEnabled: this.autoBackupEnabled,
      backupFrequency: this.backupFrequency,
      cloudBackupEnabled: this.cloudBackupEnabled,
      lastBackupDate: this.lastBackupDate
    });
  }

  /**
   * 选择备份文件夹
   * @returns {Promise<FileSystemDirectoryHandle|null>}
   */
  async selectBackupFolder() {
    try {
      if (!window.showDirectoryPicker) {
        throw new Error('您的浏览器不支持文件系统访问 API');
      }
      
      const handle = await window.showDirectoryPicker();
      this.backupFolderHandle = handle;
      
      // 保存文件夹句柄（使用 IndexedDB 持久化）
      if (typeof backupHandleStorage !== 'undefined') {
        await backupHandleStorage.saveHandle(this.handleStorageKey, handle);
      }

      // 保存路径提示
      await chrome.storage.local.set({
        backupFolderPath: handle.name // 只保存名称作为提示
      });
      
      return handle;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('选择备份文件夹失败:', error);
        throw error;
      }
      return null;
    }
  }

  /**
   * 检查是否需要备份
   * @returns {boolean}
   */
  shouldBackup() {
    if (!this.autoBackupEnabled || this.backupFrequency === 'manual') {
      return false;
    }

    if (this.backupFrequency === 'every-save') {
      return true;
    }

    if (!this.lastBackupDate) {
      return true;
    }

    const now = new Date();
    const lastBackup = new Date(this.lastBackupDate);
    const daysDiff = (now - lastBackup) / (1000 * 60 * 60 * 24);

    if (this.backupFrequency === 'daily' && daysDiff >= 1) {
      return true;
    }

    if (this.backupFrequency === 'weekly' && daysDiff >= 7) {
      return true;
    }

    return false;
  }

  async ensureFolderPermission(handle) {
    if (!handle || !handle.queryPermission) return false;

    const options = { mode: 'readwrite' };
    const current = await handle.queryPermission(options);
    if (current === 'granted') return true;

    const requested = await handle.requestPermission(options);
    return requested === 'granted';
  }

  /**
   * 创建备份文件
   * @param {Array<Object>} notes - 笔记数组
   * @param {boolean} includeImages - 是否包含图片
   * @returns {Promise<string>} 备份文件路径
   */
  async createBackup(notes, includeImages = false) {
    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalNotes: notes.length,
        notes: includeImages ? notes : notes.map(note => ({
          id: note.id,
          title: note.title,
          url: note.url,
          text: note.text,
          imageCount: note.images ? note.images.length : (note.imageIds ? note.imageIds.length : 0),
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          category: note.category,
          tags: note.tags
        }))
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `fact-notebook-backup-${timestamp}.json`;

      // 如果配置了本地备份文件夹
      if (this.backupFolderHandle) {
        try {
          const hasPermission = await this.ensureFolderPermission(this.backupFolderHandle);
          if (!hasPermission) {
            throw new Error('未授权访问备份文件夹');
          }
          const fileHandle = await this.backupFolderHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          
          this.lastBackupDate = new Date().toISOString();
          await this.saveSettings();
          
          return `已保存到: ${filename}`;
        } catch (error) {
          console.error('保存备份文件失败:', error);
          // 失败时回退到下载方式
        }
      }

      // 如果没有配置文件夹，使用下载方式
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.lastBackupDate = new Date().toISOString();
      await this.saveSettings();

      return `已下载: ${filename}`;
    } catch (error) {
      console.error('创建备份失败:', error);
      throw error;
    }
  }

  /**
   * 备份到 Google Drive（如果启用）
   * @param {Array<Object>} notes - 笔记数组
   */
  async backupToCloud(notes) {
    if (!this.cloudBackupEnabled) {
      return;
    }

    try {
      // 检查 cloudServices 是否可用
      if (typeof cloudServices !== 'undefined' && cloudServices.googleDrive) {
        const format = 'json';
        await cloudServices.exportToGoogleDrive(notes, format, false);
      }
    } catch (error) {
      console.error('云端备份失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}

/**
 * 导出单例
 * @type {NoteStorage}
 */
const noteStorage = new NoteStorage();

/**
 * 导出备份管理器单例
 * @type {BackupManager}
 */
const backupManager = new BackupManager();
