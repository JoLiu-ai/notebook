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
const copyNoteBtn = document.getElementById('copyNoteBtn');
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
const notesTab = document.getElementById('notesTab');
const libraryTab = document.getElementById('libraryTab');
const notesView = document.getElementById('notesView');
const libraryView = document.getElementById('libraryView');

// 文档库元素
const totalNotesEl = document.getElementById('totalNotes');
const totalImagesEl = document.getElementById('totalImages');
const storageSizeEl = document.getElementById('storageSize');
const libraryList = document.getElementById('libraryList');
const libraryCategories = document.getElementById('libraryCategories');
let currentCategoryFilter = null; // 当前选中的分类

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
let categoryColorMap = {}; // 分类名称到颜色索引的映射

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadNotes();
  await cloudServices.init(); // 初始化云服务
  setupEventListeners();
  loadCurrentPageInfo();
  loadCloudServiceStatus(); // 加载云服务状态
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

  if (notesTab) {
    notesTab.addEventListener('click', () => switchView('notes'));
  }
  if (libraryTab) {
    libraryTab.addEventListener('click', () => {
      switchView('library');
      loadLibraryView();
    });
  }

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
      const noteId = currentViewingNoteId;
      closeViewNoteModal();
      editNote(noteId);
    });
  }
  if (copyNoteBtn) {
    copyNoteBtn.addEventListener('click', async () => {
      if (!currentViewingNoteId) return;
      const note = await storage.getNote(currentViewingNoteId);
      if (note && note.text) {
        const success = await copyTextWithLinks(note.text, 'markdown');
        if (success) {
          if (typeof errorHandler !== 'undefined') {
            errorHandler.showSuccess('已复制到剪贴板');
          } else {
            alert('已复制到剪贴板');
          }
        } else {
          if (typeof errorHandler !== 'undefined') {
            errorHandler.showError('复制失败');
          } else {
            alert('复制失败');
          }
        }
      }
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
  selectImageBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', (e) => handleImageSelect(e.target.files));

  // 捕获当前页面
  capturePageBtn.addEventListener('click', captureCurrentPage);

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

  // 云服务相关事件
  if (cloudSettingsBtn) {
    cloudSettingsBtn.addEventListener('click', openCloudSettingsModal);
  }
  if (closeCloudSettingsBtn) {
    closeCloudSettingsBtn.addEventListener('click', closeCloudSettingsModal);
  }
  if (closeCloudSettingsBtn2) {
    closeCloudSettingsBtn2.addEventListener('click', closeCloudSettingsModal);
  }
  if (cloudSettingsModal) {
    cloudSettingsModal.addEventListener('click', (e) => {
      if (e.target === cloudSettingsModal) {
        closeCloudSettingsModal();
      }
    });
  }
  if (exportToGoogleDriveBtn) {
    exportToGoogleDriveBtn.addEventListener('click', async () => {
      await handleCloudExport('googleDrive');
    });
  }
  if (exportToNotionBtn) {
    exportToNotionBtn.addEventListener('click', async () => {
      await handleCloudExport('notion');
    });
  }
  if (exportToObsidianBtn) {
    exportToObsidianBtn.addEventListener('click', async () => {
      await handleCloudExport('obsidian');
    });
  }

  // 云服务设置事件
  setupCloudSettingsListeners();
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

async function requestCurrentPageCapture({
  silent = false,
  overwriteText = false,
  includeImages = false
} = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('未找到当前标签页');
    }

    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('捕获超时'));
      }, 2000);

      chrome.tabs.sendMessage(tab.id, { action: 'capturePage' }, (result) => {
        clearTimeout(timer);
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result || null);
      });
    });

    if (!response || !response.success) {
      throw new Error(response?.error || '无法捕获页面内容');
    }

    if (response.text && (overwriteText || !noteText.value.trim())) {
      noteText.value = response.text;
    }

    if (includeImages && Array.isArray(response.images) && response.images.length > 0) {
      response.images.forEach((imageData) => {
        const file = base64ToFile(imageData, 'screenshot.png');
        selectedImages.push(file);
        addImagePreview(file);
      });
    }

    return true;
  } catch (error) {
    if (!silent) {
      alert('无法捕获页面内容，请确保页面已完全加载');
    }
    console.error('捕获页面失败:', error);
    return false;
  }
}

function autoFillCurrentPageContent() {
  return requestCurrentPageCapture({
    silent: true,
    overwriteText: false,
    includeImages: false
  });
}

// 加载笔记列表
async function loadNotes(searchQuery = '') {
  const notes = await storage.searchNotes(searchQuery);
  // 初始化分类颜色映射（如果还没有初始化）
  if (Object.keys(categoryColorMap).length === 0) {
    const allNotes = await storage.getAllNotes();
    const categories = new Set();
    allNotes.forEach(note => {
      if (note.category && note.category.trim()) {
        categories.add(note.category.trim());
      }
    });
    const categoryArray = Array.from(categories).sort();
    categoryArray.forEach((category, index) => {
      categoryColorMap[category] = index;
    });
  }
  renderNotes(notes);
  if (libraryView && !libraryView.classList.contains('hidden')) {
    await loadLibraryView();
  }
}

// 切换视图
function switchView(view) {
  if (view === 'notes') {
    notesTab?.classList.add('active');
    libraryTab?.classList.remove('active');
    notesView?.classList.remove('hidden');
    libraryView?.classList.add('hidden');
  } else {
    notesTab?.classList.remove('active');
    libraryTab?.classList.add('active');
    notesView?.classList.add('hidden');
    libraryView?.classList.remove('hidden');
  }
}

// 加载文档库视图
async function loadLibraryView() {
  if (!libraryList) return;
  const notes = await storage.getAllNotes();

  if (totalNotesEl) totalNotesEl.textContent = notes.length;

  let totalImages = 0;
  notes.forEach(note => {
    if (note.images && note.images.length > 0) {
      totalImages += note.images.length;
    } else if (note.imageIds && note.imageIds.length > 0) {
      totalImages += note.imageIds.length;
    }
  });
  if (totalImagesEl) totalImagesEl.textContent = totalImages;

  const data = await chrome.storage.local.get(null);
  const size = JSON.stringify(data).length;
  const sizeKB = (size / 1024).toFixed(2);
  if (storageSizeEl) storageSizeEl.textContent = `${sizeKB} KB`;

  // 渲染分类按钮
  renderCategoryButtons(notes);
  
  // 渲染笔记列表（根据当前分类筛选）
  renderLibraryList(notes);
}

// 获取分类的颜色索引
function getCategoryColorIndex(categoryName) {
  if (!categoryName || !categoryColorMap[categoryName]) {
    return 0; // 默认颜色
  }
  return categoryColorMap[categoryName] % 8;
}

// 渲染分类按钮
function renderCategoryButtons(notes) {
  if (!libraryCategories) return;
  
  // 提取所有分类
  const categories = new Set();
  notes.forEach(note => {
    if (note.category && note.category.trim()) {
      categories.add(note.category.trim());
    }
  });
  
  const categoryArray = Array.from(categories).sort();
  
  // 更新分类颜色映射
  categoryColorMap = {};
  categoryArray.forEach((category, index) => {
    categoryColorMap[category] = index;
  });
  
  libraryCategories.innerHTML = '';
  
  // 添加"全部"按钮
  const allBtn = document.createElement('button');
  allBtn.className = `category-btn all ${currentCategoryFilter === null ? 'active' : ''}`;
  allBtn.textContent = '全部';
  allBtn.addEventListener('click', async () => {
    currentCategoryFilter = null;
    const allNotes = await storage.getAllNotes();
    renderCategoryButtons(allNotes);
    renderLibraryList(allNotes);
  });
  libraryCategories.appendChild(allBtn);
  
  // 添加分类按钮
  categoryArray.forEach((category, index) => {
    const btn = document.createElement('button');
    btn.className = `category-btn ${currentCategoryFilter === category ? 'active' : ''}`;
    btn.setAttribute('data-category-index', index % 8); // 循环使用8种颜色
    btn.textContent = category;
    btn.addEventListener('click', async () => {
      currentCategoryFilter = category;
      const allNotes = await storage.getAllNotes();
      renderCategoryButtons(allNotes);
      renderLibraryList(allNotes);
    });
    libraryCategories.appendChild(btn);
  });
}

// 渲染文档库列表
function renderLibraryList(notes) {
  if (!libraryList) return;
  libraryList.innerHTML = '';

  // 根据分类筛选笔记
  let filteredNotes = notes;
  if (currentCategoryFilter !== null) {
    filteredNotes = notes.filter(note => note.category === currentCategoryFilter);
  }

  if (filteredNotes.length === 0) {
    const emptyText = currentCategoryFilter 
      ? `分类"${currentCategoryFilter}"下暂无笔记`
      : '暂无笔记';
    libraryList.innerHTML = `<div style="text-align: center; padding: 40px; color: #999;">${emptyText}</div>`;
    return;
  }

  filteredNotes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-card';
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      viewNote(note.id);
    });

    const title = document.createElement('div');
    title.className = 'note-title';
    title.textContent = note.title || '无标题';

    // 显示分类标签
    if (note.category) {
      const categoryBadge = document.createElement('div');
      categoryBadge.className = 'note-category-badge';
      const colorIndex = getCategoryColorIndex(note.category);
      categoryBadge.setAttribute('data-color-index', colorIndex);
      categoryBadge.textContent = note.category;
      categoryBadge.style.marginTop = '8px';
      categoryBadge.style.marginBottom = '4px';
      item.appendChild(categoryBadge);
    }

    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.style.marginTop = '8px';

    const date = document.createElement('span');
    date.textContent = formatDate(note.createdAt);

    const info = document.createElement('span');
    const parts = [];
    if (note.url) parts.push('🔗');
    if (note.text) parts.push(`📄 ${note.text.length}字`);
    const imageCount = (note.images && note.images.length) || (note.imageIds && note.imageIds.length) || 0;
    if (imageCount > 0) parts.push(`🖼️ ${imageCount}`);
    info.textContent = parts.join(' ');

    meta.appendChild(date);
    meta.appendChild(info);

    item.appendChild(title);
    item.appendChild(meta);
    libraryList.appendChild(item);
  });
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
    const colorIndex = getCategoryColorIndex(note.category);
    categorySpan.setAttribute('data-color-index', colorIndex);
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
    await loadCurrentPageInfo();
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

    // 自动填充当前页面正文（仅在文本为空时填充，不覆盖用户输入）
    autoFillCurrentPageContent();
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
      const colorIndex = getCategoryColorIndex(note.category);
      categorySpan.setAttribute('data-color-index', colorIndex);
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

  // 文本（支持 Markdown：代码块、标题、加粗/斜体、列表、链接及正文内图片占位符）
  if (note.text) {
    const textDiv = document.createElement('div');
    textDiv.className = 'note-detail-text';
    const htmlContent = renderTextWithLinks(note.text, 'html', note.images);
    textDiv.innerHTML = htmlContent;
    // 确保链接在新标签页打开
    const links = textDiv.querySelectorAll('a');
    links.forEach(link => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
    viewBody.appendChild(textDiv);
  }

  // 图片（正文无占位符时才显示独立图片区，避免与正文内图片重复）
  const hasInlineImages = note.text && /\{\{IMAGE_\d+\}\}/.test(note.text);
  if (note.images && note.images.length > 0 && !hasInlineImages) {
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
  await requestCurrentPageCapture({
    silent: false,
    overwriteText: true,
    includeImages: true
  });
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
  const baseOptions = [
    { value: 'json', label: 'JSON - 原始数据格式' },
    { value: 'md', label: 'Markdown - Markdown 格式' }
  ];

  const extendedOptions = [
    ...baseOptions,
    { value: 'pdf', label: 'PDF - PDF 文档' },
    { value: 'docx', label: 'DOCX - Word 文档' }
  ];

  if (mode === 'batch') {
    return baseOptions;
  }

  return extendedOptions;
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

  if (scope === 'single' && !downloadContext.note) {
    alert('未找到要下载的笔记');
    return;
  }

  closeDownloadModal();

  if (scope === 'single') {
    const note = downloadContext.note;
    switch (format) {
      case 'json':
        await downloadNoteAsJSON(note, includeImages);
        break;
      case 'md':
        await downloadNoteAsMarkdown(note, includeImages);
        break;
      case 'pdf':
        await exportSingleNoteToPDF(note);
        break;
      case 'docx':
        await exportSingleNoteToDOCX(note);
        break;
    }
    return;
  }

  if (mode === 'batch') {
    switch (format) {
      case 'json':
        await batchDownloadNotesAsJSON(storage, includeImages);
        break;
      case 'md':
        await batchDownloadNotesAsMarkdown(storage, includeImages);
        break;
    }
    return;
  }

  switch (format) {
    case 'json':
      await exportToJSON(storage, { includeImages });
      break;
    case 'md':
      await exportToMarkdown(storage, includeImages);
      break;
    case 'pdf':
      await exportToPDF(storage);
      break;
    case 'docx':
      await exportToDOCX(storage);
      break;
  }
}

// 注意：所有导出函数已移至 common.js

// ==================== 云服务功能 ====================

// 设置服务状态显示的辅助函数
function setServiceStatus(element, isConnected, text) {
  if (!element) return;
  element.textContent = text;
  element.className = isConnected
    ? 'service-status status-connected'
    : 'service-status status-disconnected';
}

// 获取 Notion 状态信息
function getNotionStatusInfo() {
  if (cloudServices.mcpNotion.isEnabled()) {
    const isConfigured = cloudServices.mcpNotion.isConfigured();
    return {
      isConnected: isConfigured,
      text: isConfigured ? '✓ 已配置（MCP）' : 'MCP 未配置'
    };
  }

  const isConfigured = cloudServices.notion.isConfigured();
  return {
    isConnected: isConfigured,
    text: isConfigured ? '✓ 已配置' : '未配置'
  };
}

/**
 * 加载云服务状态
 */
async function loadCloudServiceStatus() {
  const googleDriveStatus = document.getElementById('googleDriveStatus');
  const isGoogleAuthenticated = cloudServices.googleDrive.isAuthenticated();
  setServiceStatus(
    googleDriveStatus,
    isGoogleAuthenticated,
    isGoogleAuthenticated ? '✓ 已认证' : '未认证'
  );

  const notionStatus = document.getElementById('notionStatus');
  const notionInfo = getNotionStatusInfo();
  setServiceStatus(notionStatus, notionInfo.isConnected, notionInfo.text);
}

/**
 * 打开云服务设置弹窗
 */
function openCloudSettingsModal() {
  if (!cloudSettingsModal) return;
  loadCloudServiceConfig();
  loadCloudServiceStatus();
  cloudSettingsModal.classList.add('show');
}

/**
 * 关闭云服务设置弹窗
 */
function closeCloudSettingsModal() {
  if (cloudSettingsModal) {
    cloudSettingsModal.classList.remove('show');
  }
}

/**
 * 加载云服务配置
 */
async function loadCloudServiceConfig() {
  const config = await chrome.storage.local.get([
    'notionApiKey',
    'mcpNotionServerUrl',
    'mcpNotionApiKey',
    'mcpNotionToolName',
    'mcpNotionEnabled'
  ]);

  const notionApiKey = document.getElementById('notionApiKey');
  if (notionApiKey) {
    notionApiKey.value = config.notionApiKey || '';
  }

  const notionUseMcp = document.getElementById('notionUseMcp');
  if (notionUseMcp) {
    notionUseMcp.checked = !!config.mcpNotionEnabled;
  }

  const notionMcpServerUrl = document.getElementById('notionMcpServerUrl');
  if (notionMcpServerUrl) {
    notionMcpServerUrl.value = config.mcpNotionServerUrl || '';
  }

  const notionMcpApiKey = document.getElementById('notionMcpApiKey');
  if (notionMcpApiKey) {
    notionMcpApiKey.value = config.mcpNotionApiKey || '';
  }

  const notionMcpToolName = document.getElementById('notionMcpToolName');
  if (notionMcpToolName) {
    notionMcpToolName.value = config.mcpNotionToolName || 'notion-create-pages';
  }
}

/**
 * 设置云服务事件监听器
 */
function setupCloudSettingsListeners() {
  const googleDriveAuthBtn = document.getElementById('googleDriveAuthBtn');
  if (googleDriveAuthBtn) {
    googleDriveAuthBtn.addEventListener('click', async () => {
      const config = await chrome.storage.local.get(['googleDriveClientId']);
      if (!config.googleDriveClientId) {
        alert('请先在侧边栏中配置 Google Drive Client ID');
        return;
      }

      try {
        await cloudServices.googleDrive.init(config.googleDriveClientId);
        await cloudServices.googleDrive.authenticate();
        loadCloudServiceStatus();
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showSuccess('Google Drive 认证成功');
        } else {
          alert('Google Drive 认证成功');
        }
      } catch (error) {
        console.error('Google Drive 认证失败:', error);
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showError('Google Drive 认证失败: ' + error.message);
        } else {
          alert('Google Drive 认证失败: ' + error.message);
        }
      }
    });
  }

  const saveNotionConfigBtn = document.getElementById('saveNotionConfigBtn');
  if (saveNotionConfigBtn) {
    saveNotionConfigBtn.addEventListener('click', async () => {
      const apiKey = document.getElementById('notionApiKey')?.value;
      const useMcp = document.getElementById('notionUseMcp')?.checked;
      const mcpServerUrl = document.getElementById('notionMcpServerUrl')?.value?.trim();
      const mcpApiKey = document.getElementById('notionMcpApiKey')?.value;
      const mcpToolName = document.getElementById('notionMcpToolName')?.value?.trim();

      if (useMcp) {
        if (!mcpServerUrl) {
          alert('请输入 MCP Server URL');
          return;
        }
      } else if (!apiKey) {
        alert('请输入 Notion Integration Token');
        return;
      }

      try {
        if (apiKey) {
          await cloudServices.notion.init(apiKey);
        }
        await cloudServices.mcpNotion.init({
          serverUrl: mcpServerUrl || null,
          apiKey: mcpApiKey || null,
          toolName: mcpToolName || 'notion-create-pages',
          enabled: !!useMcp
        });
        loadCloudServiceStatus();
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showSuccess('Notion 配置已保存');
        } else {
          alert('Notion 配置已保存');
        }
      } catch (error) {
        console.error('保存 Notion 配置失败:', error);
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showError('保存 Notion 配置失败: ' + error.message);
        } else {
          alert('保存 Notion 配置失败: ' + error.message);
        }
      }
    });
  }
}

// 按钮状态管理辅助函数
function setButtonLoading(button, originalText) {
  if (!button) return;
  button.disabled = true;
  button.classList.add('loading');
  button.textContent = '导出中...';
}

function setButtonSuccess(button, originalText) {
  if (!button) return;
  button.classList.add('success');
  setTimeout(() => {
    button.classList.remove('success', 'loading');
    button.disabled = false;
    button.textContent = originalText;
  }, 2000);
}

function setButtonError(button, originalText) {
  if (!button) return;
  button.classList.add('error');
  setTimeout(() => {
    button.classList.remove('error', 'loading');
    button.disabled = false;
    button.textContent = originalText;
  }, 2000);
}

function resetButton(button, originalText) {
  if (!button) return;
  button.disabled = false;
  button.classList.remove('loading');
  button.textContent = originalText;
}

function showNotification(message, isError = false) {
  if (typeof errorHandler !== 'undefined') {
    if (isError) {
      errorHandler.showError(message, 4000);
    } else {
      errorHandler.showSuccess(message, 3000);
    }
  } else {
    alert(message);
  }
}

/**
 * 处理云服务导出
 * @param {string} service - 服务名称
 */
async function handleCloudExport(service) {
  const scope = downloadContext.scope || 'all';
  const format = downloadFormatSelect ? downloadFormatSelect.value : 'md';
  const includeImages = downloadIncludeImages ? downloadIncludeImages.checked : false;

  const buttonMap = {
    googleDrive: exportToGoogleDriveBtn,
    notion: exportToNotionBtn,
    obsidian: exportToObsidianBtn
  };
  const serviceNames = {
    googleDrive: 'Google Drive',
    notion: 'Notion',
    obsidian: 'Obsidian'
  };

  const button = buttonMap[service];
  const serviceName = serviceNames[service];
  const originalText = button ? button.textContent : '';

  setButtonLoading(button, originalText);

  try {
    let notesData;
    let successMessage;

    if (scope === 'single') {
      const note = downloadContext.note;
      if (!note) {
        resetButton(button, originalText);
        alert('未找到要导出的笔记');
        return;
      }

      notesData = note;
      if (!note.images && note.id) {
        notesData = await storage.getNoteWithImages(note.id) || note;
      }
      successMessage = `已成功导出到 ${serviceName}`;
    } else {
      notesData = await storage.getAllNotesWithImages(includeImages);
      successMessage = `已成功导出 ${notesData.length} 条笔记到 ${serviceName}`;
    }

    if (service === 'googleDrive') {
      await cloudServices.exportToGoogleDrive(notesData, format, includeImages);
    } else if (service === 'notion') {
      const results = await cloudServices.exportToNotion(notesData);
      if (scope !== 'single') {
        const successCount = results.filter(r => !r.error).length;
        successMessage = `已成功导出 ${successCount}/${notesData.length} 条笔记到 ${serviceName}`;
      }
    } else if (service === 'obsidian') {
      await cloudServices.exportToObsidian(notesData);
    }

    setButtonSuccess(button, originalText);
    showNotification(`✓ ${successMessage}`);
  } catch (error) {
    console.error(`导出到 ${service} 失败:`, error);
    setButtonError(button, originalText);
    showNotification(`✗ 导出到 ${serviceName} 失败: ${error.message}`, true);
  }
}
