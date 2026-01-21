// 公共工具函数和共享代码

/**
 * HTML 转义函数，防止 XSS 攻击
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的 HTML 字符串
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化日期（完整格式）
 * @param {string} dateString - ISO 日期字符串
 * @returns {string} 格式化后的日期字符串（中文格式）
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化日期（相对时间，用于列表显示）
 * @param {string} dateString - ISO 日期字符串
 * @returns {string} 相对时间字符串（如"刚刚"、"5分钟前"等）
 */
function formatDateRelative(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小字符串（如"1.5 MB"）
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 防抖函数，延迟执行函数直到停止调用后指定时间
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数，限制函数执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 将文件转换为 Base64 字符串
 * @param {File} file - 要转换的文件对象
 * @returns {Promise<string>} Base64 编码的字符串
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 导出功能 - JSON（返回 Blob，不包含下载逻辑）
 * @param {Array<Object>} notes - 笔记数组
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Promise<Blob>} JSON 格式的 Blob 对象
 */
async function exportToJSON(notes, includeImages = false) {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalNotes: notes.length,
    notes: notes.map(note => {
      const exportedNote = {
        id: note.id,
        title: note.title,
        url: note.url,
        text: note.text,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      };

      if (includeImages) {
        exportedNote.images = note.images || [];
        exportedNote.imageIds = note.imageIds || [];
      } else {
        exportedNote.imageCount = (note.images && note.images.length) || (note.imageIds && note.imageIds.length) || 0;
      }

      // 支持分类和标签（如果存在）
      if (note.categories) exportedNote.categories = note.categories;
      if (note.tags) exportedNote.tags = note.tags;

      return exportedNote;
    })
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  return blob;
}

/**
 * 导出功能 - Markdown（返回 Blob，不包含下载逻辑）
 * @param {Array<Object>} notes - 笔记数组
 * @returns {Promise<Blob>} Markdown 格式的 Blob 对象
 */
async function exportToMarkdown(notes) {
  let markdown = `# 事实笔记本导出\n\n`;
  markdown += `**导出时间**: ${formatDate(new Date().toISOString())}\n`;
  markdown += `**笔记总数**: ${notes.length}\n\n`;
  markdown += `---\n\n`;

  for (const note of notes) {
    markdown += `## ${note.title || '无标题'}\n\n`;
    
    if (note.url) {
      markdown += `**来源**: [${note.url}](${note.url})\n\n`;
    }
    
    if (note.categories && note.categories.length > 0) {
      markdown += `**分类**: ${note.categories.join(', ')}\n\n`;
    }
    
    if (note.tags && note.tags.length > 0) {
      markdown += `**标签**: ${note.tags.map(t => `#${t}`).join(' ')}\n\n`;
    }
    
    if (note.text) {
      markdown += `### 内容\n\n`;
      markdown += `${note.text}\n\n`;
    }
    
    if (note.images && note.images.length > 0) {
      markdown += `### 图片 (${note.images.length} 张)\n\n`;
      note.images.forEach((imageData, imgIndex) => {
        markdown += `![图片 ${imgIndex + 1}](${imageData})\n\n`;
      });
    }
    
    if (note.createdAt) {
      markdown += `**创建时间**: ${formatDate(note.createdAt)}\n`;
    }
    if (note.updatedAt) {
      markdown += `**更新时间**: ${formatDate(note.updatedAt)}\n`;
    }
    
    markdown += `\n---\n\n`;
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  return blob;
}

/**
 * 生成 PDF 导出用的 HTML 内容
 * @param {Array<Object>} notes - 笔记数组
 * @returns {string} HTML 字符串
 */
function generatePDFHTML(notes) {
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>事实笔记本导出</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        h3 { color: #666; }
        .note { margin-bottom: 40px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .url { color: #667eea; word-break: break-all; }
        .meta { color: #999; font-size: 12px; margin-top: 10px; }
        .tags { margin: 10px 0; }
        .tag { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 12px; }
        img { max-width: 100%; height: auto; margin: 10px 0; }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body>
      <h1>事实笔记本导出</h1>
      <p><strong>导出时间</strong>: ${formatDate(new Date().toISOString())}</p>
      <p><strong>笔记总数</strong>: ${notes.length}</p>
      <hr>
  `;

  notes.forEach((note, index) => {
    htmlContent += `<div class="note ${index > 0 ? 'page-break' : ''}">`;
    htmlContent += `<h2>${index + 1}. ${escapeHtml(note.title || '无标题')}</h2>`;
    
    if (note.url) {
      htmlContent += `<p class="url"><strong>来源</strong>: <a href="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a></p>`;
    }
    
    if (note.category) {
      htmlContent += `<p><strong>分类</strong>: ${escapeHtml(note.category)}</p>`;
    }
    
    if (note.tags && note.tags.length > 0) {
      htmlContent += `<div class="tags">`;
      note.tags.forEach(tag => {
        htmlContent += `<span class="tag">#${escapeHtml(tag)}</span>`;
      });
      htmlContent += `</div>`;
    }
    
    if (note.text) {
      htmlContent += `<h3>内容</h3>`;
      htmlContent += `<div>${note.text.replace(/\n/g, '<br>')}</div>`;
    }
    
    if (note.images && note.images.length > 0) {
      htmlContent += `<h3>图片 (${note.images.length} 张)</h3>`;
      note.images.forEach((imageData) => {
        htmlContent += `<img src="${imageData}" alt="图片">`;
      });
    }
    
    htmlContent += `<div class="meta">`;
    if (note.createdAt) {
      htmlContent += `创建时间: ${formatDate(note.createdAt)} `;
    }
    if (note.updatedAt) {
      htmlContent += `更新时间: ${formatDate(note.updatedAt)}`;
    }
    htmlContent += `</div>`;
    htmlContent += `</div>`;
  });

  htmlContent += `</body></html>`;
  return htmlContent;
}

/**
 * 生成 DOCX 导出用的 HTML 内容
 * @param {Array<Object>} notes - 笔记数组
 * @returns {string} HTML 字符串
 */
function generateDOCXHTML(notes) {
  let htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <meta name="ProgId" content="Word.Document">
      <meta name="Generator" content="Microsoft Word">
      <meta name="Originator" content="Microsoft Word">
      <title>事实笔记本导出</title>
      <style>
        @page {
          size: A4;
          margin: 2.5cm;
        }
        body {
          font-family: 'Microsoft YaHei', SimSun, sans-serif;
          font-size: 12pt;
          line-height: 1.6;
        }
        h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        h3 { color: #666; }
        .note { margin-bottom: 40px; }
        .url { color: #667eea; word-break: break-all; }
        .meta { color: #999; font-size: 10pt; margin-top: 10px; }
        .tags { margin: 10px 0; }
        .tag { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 10pt; }
        img { max-width: 100%; height: auto; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>事实笔记本导出</h1>
      <p><strong>导出时间</strong>: ${formatDate(new Date().toISOString())}</p>
      <p><strong>笔记总数</strong>: ${notes.length}</p>
      <hr>
  `;

  notes.forEach((note, index) => {
    htmlContent += `<div class="note">`;
    htmlContent += `<h2>${index + 1}. ${escapeHtml(note.title || '无标题')}</h2>`;
    
    if (note.url) {
      htmlContent += `<p class="url"><strong>来源</strong>: <a href="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a></p>`;
    }
    
    if (note.category) {
      htmlContent += `<p><strong>分类</strong>: ${escapeHtml(note.category)}</p>`;
    }
    
    if (note.tags && note.tags.length > 0) {
      htmlContent += `<div class="tags">`;
      note.tags.forEach(tag => {
        htmlContent += `<span class="tag">#${escapeHtml(tag)}</span>`;
      });
      htmlContent += `</div>`;
    }
    
    if (note.text) {
      htmlContent += `<h3>内容</h3>`;
      htmlContent += `<div>${note.text.replace(/\n/g, '<br>')}</div>`;
    }
    
    if (note.images && note.images.length > 0) {
      htmlContent += `<h3>图片 (${note.images.length} 张)</h3>`;
      note.images.forEach((imageData) => {
        htmlContent += `<img src="${imageData}" alt="图片">`;
      });
    }
    
    htmlContent += `<div class="meta">`;
    if (note.createdAt) {
      htmlContent += `创建时间: ${formatDate(note.createdAt)} `;
    }
    if (note.updatedAt) {
      htmlContent += `更新时间: ${formatDate(note.updatedAt)}`;
    }
    htmlContent += `</div>`;
    htmlContent += `</div>`;
  });

  htmlContent += `</body></html>`;
  return htmlContent;
}

/**
 * 下载文件
 * @param {Blob} blob - 要下载的 Blob 对象
 * @param {string} filename - 文件名
 */
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 验证笔记数据
 * @param {Object} note - 笔记对象
 * @returns {Array<string>} 错误信息数组，如果验证通过则返回空数组
 */
function validateNote(note) {
  const errors = [];
  
  if (!note) {
    errors.push('笔记数据不能为空');
    return errors;
  }

  if (note.title && note.title.length > 200) {
    errors.push('标题长度不能超过 200 个字符');
  }

  if (note.text && note.text.length > 100000) {
    errors.push('文本内容长度不能超过 100000 个字符');
  }

  if (note.url && !isValidURL(note.url)) {
    errors.push('URL 格式不正确');
  }

  if (note.tags && !Array.isArray(note.tags)) {
    errors.push('标签必须是数组');
  }

  if (note.categories && !Array.isArray(note.categories)) {
    errors.push('分类必须是数组');
  }

  return errors;
}

/**
 * 验证 URL 格式
 * @param {string} string - 要验证的 URL 字符串
 * @returns {boolean} 是否为有效的 URL
 */
function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 生成唯一 ID
 * @returns {string} 唯一标识符
 */
function generateId() {
  return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 将 Base64 字符串转换为 File 对象
 * @param {string} base64 - Base64 编码的字符串
 * @param {string} filename - 文件名
 * @returns {File} File 对象
 */
function base64ToFile(base64, filename) {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * 清理文件名，移除非法字符
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的文件名
 */
function sanitizeFileName(name) {
  return name.replace(/[\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * 构建笔记导出文件名
 * @param {Object} note - 笔记对象
 * @param {number} index - 笔记索引
 * @param {string} extension - 文件扩展名
 * @param {string} [suffix] - 文件名后缀（可选）
 * @returns {string} 完整的文件名
 */
function buildNoteFilename(note, index, extension, suffix) {
  const dateTag = new Date().toISOString().split('T')[0];
  const title = sanitizeFileName(note.title || '');
  const baseName = title || `note-${index + 1}`;
  const suffixTag = suffix ? `-${suffix}` : '';
  return `fact-notebook-${baseName}${suffixTag}-${dateTag}.${extension}`;
}

/**
 * 构建 JSON 导出数据
 * @param {Array<Object>} notes - 笔记数组
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Object} 导出数据对象
 */
function buildJsonExportData(notes, includeImages) {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalNotes: notes.length,
    notes: includeImages
      ? notes
      : notes.map(note => ({
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
}

/**
 * 构建 Markdown 导出内容
 * @param {Array<Object>} notes - 笔记数组
 * @param {boolean} includeImages - 是否包含图片
 * @returns {string} Markdown 格式的字符串
 */
function buildMarkdownContent(notes, includeImages) {
  let markdown = `# 事实笔记本导出\n\n`;
  markdown += `**导出时间**: ${formatDate(new Date().toISOString())}\n`;
  markdown += `**笔记总数**: ${notes.length}\n\n`;
  markdown += `---\n\n`;

  notes.forEach((note, index) => {
    markdown += `## ${index + 1}. ${note.title || '无标题'}\n\n`;

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
      markdown += `### 内容\n\n`;
      markdown += `${note.text}\n\n`;
    }

    if (note.images && note.images.length > 0) {
      if (includeImages) {
        markdown += `### 图片 (${note.images.length} 张)\n\n`;
        note.images.forEach((imageData, imgIndex) => {
          markdown += `![图片 ${imgIndex + 1}](${imageData})\n\n`;
        });
      } else {
        markdown += `### 图片数量：${note.images.length} 张\n\n`;
      }
    }

    if (note.createdAt) {
      markdown += `**创建时间**: ${formatDate(note.createdAt)}\n`;
    }
    if (note.updatedAt) {
      markdown += `**更新时间**: ${formatDate(note.updatedAt)}\n`;
    }

    markdown += `\n---\n\n`;
  });

  return markdown;
}

/**
 * 下载文本文件
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} type - MIME 类型
 */
function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  downloadFile(blob, filename);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise<void>} Promise 对象
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 导出功能函数 ====================

/**
 * 导出为 JSON（完整实现，包含下载）
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @param {Object|boolean} options - 导出选项，可以是对象或布尔值
 * @param {boolean} [options.includeImages] - 是否包含图片
 * @returns {Promise<void>}
 */
async function exportToJSON(storage, options = {}) {
  try {
    const notes = await storage.getAllNotes();

    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    const includeImages = typeof options === 'boolean' ? options : options.includeImages;

    if (includeImages === undefined) {
      const exportData = buildJsonExportData(notes, false);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(blob, filename);

      const includeFull = confirm('是否导出包含图片的完整数据？\n（文件会很大，建议先导出简化版本）');

      if (includeFull) {
        const fullExportData = buildJsonExportData(notes, true);
        const fullJsonString = JSON.stringify(fullExportData, null, 2);
        const fullBlob = new Blob([fullJsonString], { type: 'application/json' });
        const fullFilename = `fact-notebook-full-export-${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(fullBlob, fullFilename);
      }
      return;
    }

    const exportData = buildJsonExportData(notes, includeImages);
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = includeImages
      ? `fact-notebook-full-export-${new Date().toISOString().split('T')[0]}.json`
      : `fact-notebook-export-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 导出为 Markdown（完整实现，包含下载）
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @param {boolean} [includeImages=true] - 是否包含图片
 * @returns {Promise<void>}
 */
async function exportToMarkdown(storage, includeImages = true) {
  try {
    const notes = await storage.getAllNotes();

    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    const markdown = buildMarkdownContent(notes, includeImages !== false);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const filename = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.md`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 导出为 PDF（完整实现）
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @returns {Promise<void>}
 */
async function exportToPDF(storage) {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    const htmlContent = generatePDFHTML(notes);

    // 打开新窗口并打印
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // 等待内容加载后打印
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 导出为 DOCX（完整实现）
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @returns {Promise<void>}
 */
async function exportToDOCX(storage) {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    const htmlContent = generateDOCXHTML(notes);
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const filename = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.doc`;
    downloadFile(blob, filename);
    
    alert('已导出为 Word 格式文件。\n注意：这是一个 HTML 文件，可以在 Word 中打开并另存为真正的 DOCX 格式。');
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 导出单个笔记为 PDF
 * @param {Object} note - 笔记对象
 * @returns {Promise<void>}
 */
async function exportSingleNoteToPDF(note) {
  try {
    const notes = [note];
    const htmlContent = generatePDFHTML(notes);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 导出单个笔记为 DOCX
 * @param {Object} note - 笔记对象
 * @returns {Promise<void>}
 */
async function exportSingleNoteToDOCX(note) {
  try {
    const notes = [note];
    const htmlContent = generateDOCXHTML(notes);
    const filename = buildNoteFilename(note, 0, 'doc');
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    downloadFile(blob, filename);

    alert('已导出为 Word 格式文件。\n注意：这是一个 HTML 文件，可以在 Word 中打开并另存为真正的 DOCX 格式。');
  } catch (error) {
    console.error('导出失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('导出失败，请重试');
    } else {
      alert('导出失败，请重试');
    }
  }
}

/**
 * 批量下载笔记为 JSON
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Promise<void>}
 */
async function batchDownloadNotesAsJSON(storage, includeImages) {
  try {
    const notes = await storage.getAllNotes();

    if (notes.length === 0) {
      alert('没有可下载的笔记');
      return;
    }

    const shouldIncludeImages = typeof includeImages === 'boolean'
      ? includeImages
      : confirm('批量下载是否包含图片？\n（包含图片会显著增大文件）');

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const exportData = buildJsonExportData([note], shouldIncludeImages);
      const jsonString = JSON.stringify(exportData, null, 2);
      const filename = buildNoteFilename(note, i, 'json', shouldIncludeImages ? 'full' : 'simple');
      downloadTextFile(jsonString, filename, 'application/json');
      await sleep(120);
    }
  } catch (error) {
    console.error('批量下载失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('批量下载失败，请重试');
    } else {
      alert('批量下载失败，请重试');
    }
  }
}

/**
 * 批量下载笔记为 Markdown
 * @param {Object} storage - 存储对象，需要实现 getAllNotes 方法
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Promise<void>}
 */
async function batchDownloadNotesAsMarkdown(storage, includeImages) {
  try {
    const notes = await storage.getAllNotes();

    if (notes.length === 0) {
      alert('没有可下载的笔记');
      return;
    }

    const shouldIncludeImages = typeof includeImages === 'boolean'
      ? includeImages
      : confirm('批量下载是否包含图片？\n（包含图片会显著增大文件）');

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const markdown = buildMarkdownContent([note], shouldIncludeImages);
      const filename = buildNoteFilename(note, i, 'md');
      downloadTextFile(markdown, filename, 'text/markdown;charset=utf-8');
      await sleep(120);
    }
  } catch (error) {
    console.error('批量下载失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('批量下载失败，请重试');
    } else {
      alert('批量下载失败，请重试');
    }
  }
}

/**
 * 下载单个笔记为 JSON
 * @param {Object} note - 笔记对象
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Promise<void>}
 */
async function downloadNoteAsJSON(note, includeImages) {
  const shouldIncludeImages = typeof includeImages === 'boolean'
    ? includeImages
    : confirm('是否包含图片？\n（包含图片会显著增大文件）');
  const exportData = buildJsonExportData([note], shouldIncludeImages);
  const jsonString = JSON.stringify(exportData, null, 2);
  const filename = buildNoteFilename(note, 0, 'json', shouldIncludeImages ? 'full' : 'simple');
  downloadTextFile(jsonString, filename, 'application/json');
}

/**
 * 下载单个笔记为 Markdown
 * @param {Object} note - 笔记对象
 * @param {boolean} includeImages - 是否包含图片
 * @returns {Promise<void>}
 */
async function downloadNoteAsMarkdown(note, includeImages) {
  const shouldIncludeImages = typeof includeImages === 'boolean'
    ? includeImages
    : confirm('是否包含图片？\n（包含图片会显著增大文件）');
  const markdown = buildMarkdownContent([note], shouldIncludeImages);
  const filename = buildNoteFilename(note, 0, 'md');
  downloadTextFile(markdown, filename, 'text/markdown;charset=utf-8');
}
