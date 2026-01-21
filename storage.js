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
 * 导出单例
 * @type {NoteStorage}
 */
const noteStorage = new NoteStorage();

