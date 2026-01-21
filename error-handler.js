/**
 * 统一错误处理类
 * 提供错误处理、日志记录和用户友好的错误提示
 */
class ErrorHandler {
  /**
   * 创建 ErrorHandler 实例
   */
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {Object} [context={}] - 错误上下文信息
   * @param {string} [context.operation] - 操作类型（如 'save', 'load', 'delete' 等）
   * @returns {string} 用户友好的错误消息
   */
  handleError(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      context: context,
      type: error.name || 'Error'
    };

    // 记录错误
    this.logError(errorInfo);

    // 控制台输出
    console.error('[ErrorHandler]', errorInfo);

    // 返回用户友好的错误消息
    return this.getUserFriendlyMessage(error, context);
  }

  /**
   * 记录错误到日志
   * @param {Object} errorInfo - 错误信息对象
   * @private
   */
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }

  /**
   * 获取用户友好的错误消息
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   * @returns {string} 用户友好的错误消息
   * @private
   */
  getUserFriendlyMessage(error, context) {
    const errorType = error.name || 'Error';
    const errorMessage = error.message || String(error);

    // 根据错误类型返回不同的消息
    switch (errorType) {
      case 'QuotaExceededError':
        return '存储空间不足，请清理一些笔记或图片';
      case 'NotFoundError':
        return '未找到请求的资源';
      case 'NetworkError':
        return '网络错误，请检查网络连接';
      case 'TypeError':
        return '数据格式错误，请重试';
      case 'SyntaxError':
        return '数据格式错误，无法解析';
      default:
        // 根据上下文返回更具体的消息
        if (context.operation === 'save') {
          return '保存失败，请重试';
        } else if (context.operation === 'load') {
          return '加载失败，请刷新页面重试';
        } else if (context.operation === 'delete') {
          return '删除失败，请重试';
        } else if (context.operation === 'export') {
          return '导出失败，请重试';
        } else if (context.operation === 'import') {
          return '导入失败，请检查文件格式';
        }
        return '操作失败，请重试';
    }
  }

  /**
   * 显示错误提示（Toast）
   * @param {string} message - 错误消息
   * @param {number} [duration=3000] - 显示时长（毫秒）
   */
  showError(message, duration = 3000) {
    // 创建 Toast 提示
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  }

  /**
   * 显示成功提示（Toast）
   * @param {string} message - 成功消息
   * @param {number} [duration=2000] - 显示时长（毫秒）
   */
  showSuccess(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  }

  /**
   * 显示警告提示（Toast）
   * @param {string} message - 警告消息
   * @param {number} [duration=3000] - 显示时长（毫秒）
   */
  showWarning(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'warning-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff9800;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration);
  }

  /**
   * 包装异步函数，自动处理错误
   * @param {Function} fn - 要包装的异步函数
   * @param {Object} [context={}] - 错误上下文
   * @returns {Promise<*>} 函数执行结果
   * @throws {Error} 如果函数执行失败
   */
  async wrapAsync(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      const message = this.handleError(error, context);
      this.showError(message);
      throw error;
    }
  }

  /**
   * 获取错误日志
   * @returns {Array<Object>} 错误日志数组的副本
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}

/**
 * 导出单例
 * @type {ErrorHandler}
 */
const errorHandler = new ErrorHandler();

// 添加 CSS 动画（如果不存在）
if (!document.getElementById('error-handler-styles')) {
  const style = document.createElement('style');
  style.id = 'error-handler-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
