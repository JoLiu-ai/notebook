// 数据存储管理
class NoteStorage {
  constructor() {
    this.STORAGE_KEY = 'fact_notebook_notes';
  }

  // 获取所有笔记
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

  // 保存笔记
  async saveNote(note) {
    return new Promise((resolve, reject) => {
      this.getAllNotes().then((notes) => {
        // 如果没有ID，说明是新笔记
        if (!note.id) {
          note.id = Date.now().toString();
          note.createdAt = new Date().toISOString();
        }
        note.updatedAt = new Date().toISOString();

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
      });
    });
  }

  // 删除笔记
  async deleteNote(noteId) {
    return new Promise((resolve, reject) => {
      this.getAllNotes().then((notes) => {
        const filteredNotes = notes.filter(n => n.id !== noteId);
        chrome.storage.local.set({ [this.STORAGE_KEY]: filteredNotes }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }

  // 获取单个笔记
  async getNote(noteId) {
    const notes = await this.getAllNotes();
    return notes.find(n => n.id === noteId);
  }

  // 搜索笔记
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

// 导出单例
const noteStorage = new NoteStorage();

