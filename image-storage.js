// 图片存储管理 - 使用 IndexedDB 存储图片
class ImageStorage {
  constructor() {
    this.dbName = 'fact_notebook_images';
    this.dbVersion = 1;
    this.storeName = 'images';
    this.db = null;
  }

  // 初始化数据库
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
          objectStore.createIndex('noteId', 'noteId', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  // 保存图片
  async saveImage(imageData, noteId, imageIndex = 0) {
    await this.init();
    
    const id = `${noteId}_${imageIndex}_${Date.now()}`;
    const imageBlob = await this.dataURLToBlob(imageData);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const imageRecord = {
        id: id,
        noteId: noteId,
        imageIndex: imageIndex,
        data: imageBlob,
        createdAt: new Date().toISOString()
      };

      const request = store.add(imageRecord);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  // 批量保存图片
  async saveImages(imageDataArray, noteId) {
    const imageIds = [];
    for (let i = 0; i < imageDataArray.length; i++) {
      const id = await this.saveImage(imageDataArray[i], noteId, i);
      imageIds.push(id);
    }
    return imageIds;
  }

  // 获取图片
  async getImage(imageId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(imageId);

      request.onsuccess = () => {
        if (request.result) {
          this.blobToDataURL(request.result.data).then(resolve).catch(reject);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 获取笔记的所有图片
  async getImagesByNoteId(noteId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('noteId');
      const request = index.getAll(noteId);

      request.onsuccess = async () => {
        const results = request.result;
        const images = await Promise.all(
          results.sort((a, b) => a.imageIndex - b.imageIndex).map(
            record => this.blobToDataURL(record.data)
          )
        );
        resolve(images);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 删除图片
  async deleteImage(imageId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(imageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 删除笔记的所有图片
  async deleteImagesByNoteId(noteId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('noteId');
      const request = index.openCursor(noteId);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 获取存储大小（估算）
  async getStorageSize() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result;
        let totalSize = 0;
        results.forEach(record => {
          totalSize += record.data.size || 0;
        });
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 清理未使用的图片（可选）
  async cleanupOrphanedImages(validNoteIds) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('noteId');
      const request = index.openCursor();

      const orphanedIds = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!validNoteIds.includes(cursor.value.noteId)) {
            orphanedIds.push(cursor.value.id);
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(orphanedIds.length);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 工具函数：DataURL 转 Blob
  async dataURLToBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
  }

  // 工具函数：Blob 转 DataURL
  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// 导出单例
const imageStorage = new ImageStorage();
