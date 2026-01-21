// Popup 主逻辑
const storage = noteStorage;
let currentViewingNoteId = null;
let autoSaveTimer = null; // 自动保存定时器

// DOM 元素
const addNoteBtn = document.getElementById('addNoteBtn');
const exportBtn = document.getElementById('exportBtn');
const searchInput = document.getElementById('searchInput');
const notesContainer = document.getElementById('notesContainer');
const emptyState = document.getElementById('emptyState');
const addNoteModal = document.getElementById('addNoteModal');
const viewNoteModal = document.getElementById('viewNoteModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const editNoteBtn = document.getElementById('editNoteBtn');
const closeViewBtn = document.getElementById('closeViewBtn');
const downloadModal = document.getElementById('downloadModal');
const downloadModalTitle = document.getElementById('downloadModalTitle');
const closeDownloadModalBtn = document.getElementById('closeDownloadModal');
const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
const confirmDownloadBtn = document.getElementById('confirmDownloadBtn');
const downloadModeSelect = document.getElementById('downloadModeSelect');
const downloadFormatSelect = document.getElementById('downloadFormatSelect');
const downloadIncludeImages = document.getElementById('downloadIncludeImages');
const downloadModeRow = document.getElementById('downloadModeRow');
const downloadImagesRow = document.getElementById('downloadImagesRow');

// 表单元素
const noteTitle = document.getElementById('noteTitle');
const noteUrl = document.getElementById('noteUrl');
const noteText = document.getElementById('noteText');
const noteCategory = document.getElementById('noteCategory');
const noteTagsInput = document.getElementById('noteTagsInput');
const tagsDisplay = document.getElementById('tagsDisplay');
const categoryList = document.getElementById('categoryList');
const imageInput = document.getElementById('imageInput');
const selectImageBtn = document.getElementById('selectImageBtn');
const imagePreview = document.getElementById('imagePreview');
const capturePageBtn = document.getElementById('capturePageBtn');

// 标签管理
let currentTags = [];
let allCategories = [];
let selectedImages = [];
let downloadContext = { scope: 'all', note: null };

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadNotes();
  setupEventListeners();
  loadCurrentPageInfo();
});

// 设置事件监听
function setupEventListeners() {
  // 添加笔记按钮
  addNoteBtn.addEventListener('click', () => {
    openAddNoteModal();
  });

  // 导出数据按钮
  exportBtn.addEventListener('click', async () => {
    openDownloadModal({ scope: 'all' });
  });

  // 搜索
  searchInput.addEventListener('input', async (e) => {
    await loadNotes(e.target.value);
  });

  // 模态框关闭
  closeModal.addEventListener('click', closeAddNoteModal);
  cancelBtn.addEventListener('click', closeAddNoteModal);
  if (editNoteBtn) {
    editNoteBtn.addEventListener('click', () => {
      if (!currentViewingNoteId) return;
      closeViewNoteModal();
      editNote(currentViewingNoteId);
    });
  }
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', closeViewNoteModal);
  }

  // 下载弹窗
  if (closeDownloadModalBtn) {
    closeDownloadModalBtn.addEventListener('click', closeDownloadModal);
  }
  if (cancelDownloadBtn) {
    cancelDownloadBtn.addEventListener('click', closeDownloadModal);
  }
  if (confirmDownloadBtn) {
    confirmDownloadBtn.addEventListener('click', handleDownloadConfirm);
  }
  if (downloadModeSelect) {
    downloadModeSelect.addEventListener('change', updateDownloadFormatOptions);
  }
  if (downloadFormatSelect) {
    downloadFormatSelect.addEventListener('change', updateDownloadImagesVisibility);
  }
  if (downloadModal) {
    downloadModal.addEventListener('click', (e) => {
      if (e.target === downloadModal) {
        closeDownloadModal();
      }
    });
  }


  // 保存笔记
  saveNoteBtn.addEventListener('click', async () => {
    // 清除自动保存定时器
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    await saveNote();
  });

  // 自动保存（防抖）- 监听文本内容输入
  noteText.addEventListener('input', () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      await autoSaveNote();
    }, 2000); // 2秒后自动保存
  });

  // 标签输入处理
  if (noteTagsInput) {
    noteTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = e.target.value.trim();
        if (tag && !currentTags.includes(tag)) {
          addTag(tag);
          e.target.value = '';
        }
      }
    });

    noteTagsInput.addEventListener('blur', (e) => {
      const tag = e.target.value.trim();
      if (tag && !currentTags.includes(tag)) {
        addTag(tag);
        e.target.value = '';
      }
    });
  }

  // 分类输入处理 - 加载分类列表
  if (noteCategory) {
    loadCategories();
    noteCategory.addEventListener('input', debounce(loadCategories, 300));
  }

  // 删除笔记
  deleteNoteBtn.addEventListener('click', async () => {
    if (currentViewingNoteId) {
      if (confirm('确定要删除这条笔记吗？')) {
        await storage.deleteNote(currentViewingNoteId);
        closeViewNoteModal();
        await loadNotes();
      }
    }
  });

  // 选择图片
  selectImageBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', (e) => {
    handleImageSelect(e.target.files);
  });

  // 捕获当前页面
  capturePageBtn.addEventListener('click', async () => {
    await captureCurrentPage();
  });

  // 点击模态框外部关闭
  addNoteModal.addEventListener('click', (e) => {
    if (e.target === addNoteModal) {
      closeAddNoteModal();
    }
  });

  viewNoteModal.addEventListener('click', (e) => {
    if (e.target === viewNoteModal) {
      closeViewNoteModal();
    }
  });
}

// 加载当前页面信息
async function loadCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      noteUrl.value = tab.url;
      noteTitle.value = tab.title || '';
    }
  } catch (error) {
    console.error('获取当前页面信息失败:', error);
  }
}

// 加载笔记列表
async function loadNotes(searchQuery = '') {
  const notes = await storage.searchNotes(searchQuery);
  renderNotes(notes);
}

// 渲染笔记列表
function renderNotes(notes) {
  notesContainer.innerHTML = '';
  
  if (notes.length === 0) {
    emptyState.classList.add('show');
    return;
  }

  emptyState.classList.remove('show');

  notes.forEach(note => {
    const noteCard = createNoteCard(note);
    notesContainer.appendChild(noteCard);
  });
}

// 创建笔记卡片
function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.addEventListener('click', () => {
    viewNote(note.id);
  });

  const title = document.createElement('div');
  title.className = 'note-title';
  title.textContent = note.title || '无标题';

  const preview = document.createElement('div');
  preview.className = 'note-preview';
  preview.textContent = note.text || '';

  const metaTags = document.createElement('div');
  metaTags.className = 'note-meta-tags';

  if (note.category) {
    const categorySpan = document.createElement('span');
    categorySpan.className = 'note-category-badge';
    categorySpan.textContent = note.category;
    metaTags.appendChild(categorySpan);
  }

  if (note.tags && note.tags.length > 0) {
    note.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'note-tag-badge';
      tagSpan.textContent = `#${tag}`;
      metaTags.appendChild(tagSpan);
    });
  }

  const url = document.createElement('div');
  url.className = 'note-url';
  url.textContent = note.url || '';

  const meta = document.createElement('div');
  meta.className = 'note-meta';

  const date = document.createElement('span');
  date.textContent = formatDateRelative(note.createdAt);

  const metaRight = document.createElement('div');
  metaRight.className = 'note-meta-right';

  if (note.images && note.images.length > 0) {
    const imagesCount = document.createElement('span');
    imagesCount.className = 'note-images-count';
    imagesCount.innerHTML = `🖼️ ${note.images.length}`;
    metaRight.appendChild(imagesCount);
  }

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'note-download-btn';
  downloadBtn.textContent = '下载';
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDownloadModal({ scope: 'single', note });
  });
  metaRight.appendChild(downloadBtn);

  meta.appendChild(date);
  meta.appendChild(metaRight);

  card.appendChild(title);
  card.appendChild(preview);
  if (metaTags.children.length > 0) {
    card.appendChild(metaTags);
  }
  if (note.url) {
    card.appendChild(url);
  }
  card.appendChild(meta);

  return card;
}

// 打开添加笔记模态框
async function openAddNoteModal(note = null) {
  addNoteModal.classList.add('show');
  
  if (note) {
    // 编辑模式
    noteTitle.value = note.title || '';
    noteUrl.value = note.url || '';
    noteText.value = note.text || '';
    
    // 加载分类和标签
    if (noteCategory) {
      noteCategory.value = note.category || '';
    }
    currentTags = note.tags ? [...note.tags] : [];
    renderTags();
    
    selectedImages = [];
    imagePreview.innerHTML = '';
    
    // 加载图片（支持新的 IndexedDB 存储）
    let imagesToShow = [];
    if (note.imageIds && note.imageIds.length > 0) {
      // 从 IndexedDB 加载图片
      try {
        const imgStorage = await storage.getImageStorage();
        if (imgStorage) {
          imagesToShow = await imgStorage.getImagesByNoteId(note.id);
        }
      } catch (error) {
        console.error('加载图片失败:', error);
      }
    } else if (note.images && note.images.length > 0) {
      // 旧格式的 base64 图片
      imagesToShow = note.images;
    }
    
    // 显示原有图片（只读预览）
    if (imagesToShow.length > 0) {
      imagesToShow.forEach((imageData, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.style.opacity = '0.7';
        previewItem.title = '原有图片（如需替换请重新选择）';
        
        const img = document.createElement('img');
        img.src = imageData;
        
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.bottom = '4px';
        label.style.left = '4px';
        label.style.background = 'rgba(0,0,0,0.6)';
        label.style.color = 'white';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '2px';
        label.style.fontSize = '10px';
        label.textContent = '原有';
        
        previewItem.appendChild(img);
        previewItem.appendChild(label);
        imagePreview.appendChild(previewItem);
      });
    }
    
    saveNoteBtn.textContent = '更新';
    document.querySelector('.modal-header h2').textContent = '编辑笔记';
    currentViewingNoteId = note.id;
  } else {
    // 新建模式
    loadCurrentPageInfo();
    noteText.value = '';
    if (noteCategory) {
      noteCategory.value = '';
    }
    currentTags = [];
    renderTags();
    selectedImages = [];
    imagePreview.innerHTML = '';
    saveNoteBtn.textContent = '保存';
    document.querySelector('.modal-header h2').textContent = '添加笔记';
    currentViewingNoteId = null;
  }
  
  // 加载分类列表
  loadCategories();
}

// 编辑笔记
async function editNote(noteId) {
  const note = await storage.getNote(noteId);
  if (note) {
    openAddNoteModal(note);
  }
}

// 关闭添加笔记模态框
function closeAddNoteModal() {
  // 清除自动保存定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  addNoteModal.classList.remove('show');
  // 清空表单
  noteTitle.value = '';
  noteUrl.value = '';
  noteText.value = '';
  if (noteCategory) {
    noteCategory.value = '';
  }
  currentTags = [];
  renderTags();
  selectedImages = [];
  imagePreview.innerHTML = '';
}

// 保存笔记
async function saveNote() {
  const title = noteTitle.value.trim();
  const url = noteUrl.value.trim();
  const text = noteText.value.trim();
  const category = noteCategory ? noteCategory.value.trim() : '';
  const tags = currentTags.filter(t => t.trim());

  if (!title && !text && selectedImages.length === 0) {
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError('请至少填写标题、文本或添加图片');
    } else {
      alert('请至少填写标题、文本或添加图片');
    }
    return;
  }

  try {
    // 将新选择的图片转换为 base64（用于保存到 IndexedDB）
    const newImages = await Promise.all(
      selectedImages.map(file => fileToBase64(file))
    );

    const note = {
      id: currentViewingNoteId,
      title: title || '无标题',
      url: url,
      text: text,
      images: newImages, // 新选择的图片
      updatedAt: new Date().toISOString()
    };

    // 添加分类和标签
    if (category) {
      note.category = category;
    }
    if (tags.length > 0) {
      note.tags = tags;
    }

    if (!currentViewingNoteId) {
      note.createdAt = new Date().toISOString();
    } else {
      const existingNote = await storage.getNote(currentViewingNoteId);
      if (existingNote) {
        note.createdAt = existingNote.createdAt;
        // 保留原有的图片 ID（如果存在）
        if (existingNote.imageIds) {
          note.imageIds = existingNote.imageIds;
        }
      } else {
        note.createdAt = new Date().toISOString();
      }
    }

    await storage.saveNote(note);
    
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showSuccess('保存成功');
    }
    
    closeAddNoteModal();
    await loadNotes();
  } catch (error) {
    console.error('保存笔记失败:', error);
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showError(errorHandler.handleError(error, { operation: 'save' }));
    } else {
      alert('保存失败，请重试');
    }
  }
}

// 标签管理函数
function addTag(tag) {
  const trimmedTag = tag.trim();
  if (trimmedTag && !currentTags.includes(trimmedTag)) {
    currentTags.push(trimmedTag);
    renderTags();
    // 保存标签到所有标签列表（用于自动完成）
    saveTagToHistory(trimmedTag);
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTags();
}

function renderTags() {
  if (!tagsDisplay) return;
  
  tagsDisplay.innerHTML = '';
  currentTags.forEach(tag => {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `
      <span>${escapeHtml(tag)}</span>
      <button type="button" class="tag-remove" aria-label="删除标签">×</button>
    `;
    tagItem.querySelector('.tag-remove').addEventListener('click', () => {
      removeTag(tag);
    });
    tagsDisplay.appendChild(tagItem);
  });
}

// 加载分类列表
async function loadCategories() {
  if (!categoryList) return;
  
  try {
    const notes = await storage.getAllNotes();
    const categories = new Set();
    notes.forEach(note => {
      if (note.category) {
        categories.add(note.category);
      }
    });
    
    allCategories = Array.from(categories).sort();
    categoryList.innerHTML = '';
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      categoryList.appendChild(option);
    });
  } catch (error) {
    console.error('加载分类失败:', error);
  }
}

// 保存标签到历史记录（用于自动完成）
function saveTagToHistory(tag) {
  try {
    const tagHistory = JSON.parse(localStorage.getItem('fact_notebook_tag_history') || '[]');
    if (!tagHistory.includes(tag)) {
      tagHistory.push(tag);
      // 限制历史记录数量
      if (tagHistory.length > 50) {
        tagHistory.shift();
      }
      localStorage.setItem('fact_notebook_tag_history', JSON.stringify(tagHistory));
    }
  } catch (error) {
    console.error('保存标签历史失败:', error);
  }
}

// 自动保存笔记（静默保存，不关闭模态框）
async function autoSaveNote() {
  const title = noteTitle.value.trim();
  const url = noteUrl.value.trim();
  const text = noteText.value.trim();

  // 如果没有任何内容，不保存
  if (!title && !text && selectedImages.length === 0) {
    return;
  }

  try {
    // 将新选择的图片转换为 base64
    const newImages = await Promise.all(
      selectedImages.map(file => fileToBase64(file))
    );

    // 如果是新建笔记且还没有 ID，生成一个临时 ID
    let noteId = currentViewingNoteId;
    if (!noteId) {
      noteId = 'temp_' + Date.now();
      currentViewingNoteId = noteId;
    }

    const note = {
      id: noteId,
      title: title || '无标题',
      url: url,
      text: text,
      images: newImages,
      updatedAt: new Date().toISOString()
    };

    // 添加分类和标签
    const category = noteCategory ? noteCategory.value.trim() : '';
    const tags = currentTags.filter(t => t.trim());
    if (category) {
      note.category = category;
    }
    if (tags.length > 0) {
      note.tags = tags;
    }

    if (!currentViewingNoteId || currentViewingNoteId.startsWith('temp_')) {
      // 检查是否已有创建时间
      const existingNote = await storage.getNote(noteId);
      if (existingNote && existingNote.createdAt) {
        note.createdAt = existingNote.createdAt;
      } else {
        note.createdAt = new Date().toISOString();
      }
    } else {
      const existingNote = await storage.getNote(currentViewingNoteId);
      if (existingNote) {
        note.createdAt = existingNote.createdAt;
      } else {
        note.createdAt = new Date().toISOString();
      }
    }

    await storage.saveNote(note);
    // 更新 currentViewingNoteId 为保存后的 ID（如果是新建）
    if (currentViewingNoteId && currentViewingNoteId.startsWith('temp_')) {
      currentViewingNoteId = note.id;
    }
    // 静默刷新笔记列表，不关闭模态框
    await loadNotes();
  } catch (error) {
    console.error('自动保存笔记失败:', error);
    // 自动保存失败时不显示错误提示，避免打扰用户
  }
}

// 查看笔记详情
async function viewNote(noteId) {
  const note = await storage.getNoteWithImages(noteId);
  if (!note) return;

  currentViewingNoteId = noteId;

  document.getElementById('viewNoteTitle').textContent = note.title || '无标题';
  const viewBody = document.getElementById('viewNoteBody');
  viewBody.innerHTML = '';

  // URL
  if (note.url) {
    const urlDiv = document.createElement('div');
    urlDiv.className = 'note-detail-url';
    const link = document.createElement('a');
    link.href = note.url;
    link.target = '_blank';
    link.textContent = note.url;
    link.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    urlDiv.appendChild(link);
    viewBody.appendChild(urlDiv);
  }

  // 分类和标签
  if (note.category || (note.tags && note.tags.length > 0)) {
    const metaDiv = document.createElement('div');
    metaDiv.className = 'note-meta-tags';
    
    if (note.category) {
      const categorySpan = document.createElement('span');
      categorySpan.className = 'note-category-badge';
      categorySpan.textContent = note.category;
      metaDiv.appendChild(categorySpan);
    }
    
    if (note.tags && note.tags.length > 0) {
      note.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'note-tag-badge';
        tagSpan.textContent = `#${tag}`;
        metaDiv.appendChild(tagSpan);
      });
    }
    
    viewBody.appendChild(metaDiv);
  }

  // 文本
  if (note.text) {
    const textDiv = document.createElement('div');
    textDiv.className = 'note-detail-text';
    textDiv.textContent = note.text;
    viewBody.appendChild(textDiv);
  }

  // 图片
  if (note.images && note.images.length > 0) {
    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'note-detail-images';
    note.images.forEach((imageData, index) => {
      const img = document.createElement('img');
      // 确保图片数据是有效的
      if (imageData && (imageData.startsWith('data:') || imageData.startsWith('http') || imageData.startsWith('blob:'))) {
        img.src = imageData;
        img.alt = `图片 ${index + 1}`;
        img.style.cursor = 'pointer';
        img.title = '点击查看大图';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 在新窗口中打开大图
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head><title>图片 ${index + 1}</title></head>
                <body style="margin:0;padding:20px;text-align:center;background:#f5f5f5;">
                  <img src="${imageData}" style="max-width:100%;max-height:100vh;border:1px solid #ddd;border-radius:4px;" alt="图片 ${index + 1}">
                </body>
              </html>
            `);
          }
        });
        img.addEventListener('error', () => {
          img.style.display = 'none';
          console.error('图片加载失败:', imageData.substring(0, 50));
        });
        imagesDiv.appendChild(img);
      }
    });
    if (imagesDiv.children.length > 0) {
      viewBody.appendChild(imagesDiv);
    }
  }


  viewNoteModal.classList.add('show');
}

// 关闭查看笔记模态框
function closeViewNoteModal() {
  viewNoteModal.classList.remove('show');
  currentViewingNoteId = null;
}

// 处理图片选择
function handleImageSelect(files) {
  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/')) {
      selectedImages.push(file);
      addImagePreview(file);
    }
  });
}

// 添加图片预览
function addImagePreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    
    const img = document.createElement('img');
    img.src = e.target.result;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      selectedImages = selectedImages.filter(f => f !== file);
      previewItem.remove();
    });

    previewItem.appendChild(img);
    previewItem.appendChild(removeBtn);
    imagePreview.appendChild(previewItem);
  };
  reader.readAsDataURL(file);
}

// 捕获当前页面
async function captureCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 发送消息给 content script 来捕获页面内容
    chrome.tabs.sendMessage(tab.id, { action: 'capturePage' }, async (response) => {
      if (response && response.success) {
        // 填充文本内容
        if (response.text) {
          noteText.value = response.text;
        }
        
        // 添加图片
        if (response.images && response.images.length > 0) {
          response.images.forEach(imageData => {
            // 将 base64 转换为 File 对象
            const file = base64ToFile(imageData, 'screenshot.png');
            selectedImages.push(file);
            addImagePreview(file);
          });
        }
      } else {
        alert('无法捕获页面内容，请确保页面已完全加载');
      }
    });
  } catch (error) {
    console.error('捕获页面失败:', error);
    alert('捕获页面失败');
  }
}

// 注意：fileToBase64, base64ToFile, formatDateRelative 等函数已在 common.js 中定义



// 下载弹窗控制
function openDownloadModal({ scope, note }) {
  downloadContext = {
    scope: scope || 'all',
    note: note || null
  };

  if (downloadModalTitle) {
    downloadModalTitle.textContent = downloadContext.scope === 'single' ? '下载笔记' : '下载全部';
  }

  if (downloadModeRow) {
    downloadModeRow.style.display = downloadContext.scope === 'all' ? '' : 'none';
  }

  if (downloadModeSelect && downloadContext.scope === 'all') {
    downloadModeSelect.value = 'batch';
  }

  if (downloadIncludeImages) {
    downloadIncludeImages.checked = false;
  }

  updateDownloadFormatOptions();

  if (downloadModal) {
    downloadModal.classList.add('show');
  }
}

function closeDownloadModal() {
  if (downloadModal) {
    downloadModal.classList.remove('show');
  }
}

function getDownloadFormatOptions(scope, mode) {
  if (scope === 'single') {
    return [
      { value: 'json', label: 'JSON - 原始数据格式' },
      { value: 'md', label: 'Markdown - Markdown 格式' },
      { value: 'pdf', label: 'PDF - PDF 文档' },
      { value: 'docx', label: 'DOCX - Word 文档' }
    ];
  }

  if (mode === 'batch') {
    return [
      { value: 'json', label: 'JSON - 原始数据格式' },
      { value: 'md', label: 'Markdown - Markdown 格式' }
    ];
  }

  return [
    { value: 'json', label: 'JSON - 原始数据格式' },
    { value: 'md', label: 'Markdown - Markdown 格式' },
    { value: 'pdf', label: 'PDF - PDF 文档' },
    { value: 'docx', label: 'DOCX - Word 文档' }
  ];
}

function updateDownloadFormatOptions() {
  if (!downloadFormatSelect) return;

  const scope = downloadContext.scope || 'all';
  const mode = scope === 'all' && downloadModeSelect ? downloadModeSelect.value : 'single';
  const options = getDownloadFormatOptions(scope, mode);

  downloadFormatSelect.innerHTML = '';
  options.forEach((option) => {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    downloadFormatSelect.appendChild(optionEl);
  });

  updateDownloadImagesVisibility();
}

function updateDownloadImagesVisibility() {
  if (!downloadFormatSelect || !downloadImagesRow) return;

  const format = downloadFormatSelect.value;
  const showImages = format === 'json' || format === 'md';
  downloadImagesRow.style.display = showImages ? '' : 'none';

  if (!showImages && downloadIncludeImages) {
    downloadIncludeImages.checked = false;
  }
}

async function handleDownloadConfirm() {
  if (!downloadFormatSelect) return;

  const scope = downloadContext.scope || 'all';
  const mode = scope === 'all' && downloadModeSelect ? downloadModeSelect.value : 'single';
  const format = downloadFormatSelect.value;
  const includeImages = downloadIncludeImages ? downloadIncludeImages.checked : false;

  if (scope === 'single') {
    const note = downloadContext.note;
    if (!note) {
      alert('未找到要下载的笔记');
      return;
    }
  }

  closeDownloadModal();

  if (scope === 'single') {
    const note = downloadContext.note;
    if (format === 'json') {
      await downloadNoteAsJSON(note, includeImages);
    } else if (format === 'md') {
      await downloadNoteAsMarkdown(note, includeImages);
    } else if (format === 'pdf') {
      await exportSingleNoteToPDF(note);
    } else if (format === 'docx') {
      await exportSingleNoteToDOCX(note);
    }
    return;
  }

  if (mode === 'batch') {
    if (format === 'json') {
      await batchDownloadNotesAsJSON(storage, includeImages);
    } else if (format === 'md') {
      await batchDownloadNotesAsMarkdown(storage, includeImages);
    }
    return;
  }

  if (format === 'json') {
    await exportToJSON(storage, { includeImages });
  } else if (format === 'md') {
    await exportToMarkdown(storage, includeImages);
  } else if (format === 'pdf') {
    await exportToPDF(storage);
  } else if (format === 'docx') {
    await exportToDOCX(storage);
  }
}

// 注意：所有导出函数已移至 common.js

// 注意：所有导出函数已移至 common.js
