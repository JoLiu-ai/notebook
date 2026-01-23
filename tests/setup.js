// Jest 测试环境设置
// Mock Chrome Extension API

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((data, callback) => {
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://test/${path}`)
  },
  tabs: {
    query: jest.fn((query, callback) => {
      callback([{ id: 1, url: 'https://example.com', title: 'Example' }]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({ success: true });
    })
  }
};

// Mock DOM APIs
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
  }
};

global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsDataURL(file) {
    setTimeout(() => {
      this.result = 'data:image/png;base64,mock';
      if (this.onload) this.onload({ target: { result: this.result } });
    }, 0);
  }
};
