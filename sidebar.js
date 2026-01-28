// 侧边栏主逻辑
const storage = noteStorage;
let currentViewingNoteId = null;
let selectedImages = [];
let downloadContext = { scope: 'all', note: null };
let isResizing = false;
let sidebarWidth = 400;
let sidebarPosition = 'right'; // 'left' or 'right'
let autoSaveTimer = null; // 自动保存定时器
let isTextExpanded = false; // 文本内容展开状态

// DOM 元素
const sidebarContainer = document.getElementById('sidebarContainer');
const resizeHandle = document.getElementById('resizeHandle');
const positionBtn = document.getElementById('positionBtn');
const importBtn = document.getElementById('importBtn');
const closeBtn = document.getElementById('closeBtn');
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
const cloudServiceRow = document.getElementById('cloudServiceRow');
const cloudSettingsBtn = document.getElementById('cloudSettingsBtn');
const cloudSettingsModal = document.getElementById('cloudSettingsModal');
const closeCloudSettingsBtn = document.getElementById('closeCloudSettingsBtn');
const closeCloudSettingsBtn2 = document.getElementById('closeCloudSettingsBtn2');
const exportToGoogleDriveBtn = document.getElementById('exportToGoogleDriveBtn');
const exportToNotionBtn = document.getElementById('exportToNotionBtn');
const exportToObsidianBtn = document.getElementById('exportToObsidianBtn');
const notesTab = document.getElementById('notesTab');
const libraryTab = document.getElementById('libraryTab');
const notesView = document.getElementById('notesView');
const libraryView = document.getElementById('libraryView');

// 备份相关元素（使用安全的获取方式）
const backupSettingsBtn = document.getElementById('backupSettingsBtn');
const restoreBtn = document.getElementById('restoreBtn');
const backupSettingsModal = document.getElementById('backupSettingsModal');
const closeBackupSettingsBtn = document.getElementById('closeBackupSettingsBtn');
const closeBackupSettingsBtn2 = document.getElementById('closeBackupSettingsBtn2');
const autoBackupEnabled = document.getElementById('autoBackupEnabled');
const backupLocation = document.getElementById('backupLocation');
const selectBackupFolderBtn = document.getElementById('selectBackupFolderBtn');
const backupFrequency = document.getElementById('backupFrequency');
const cloudBackupEnabled = document.getElementById('cloudBackupEnabled');
const createBackupBtn = document.getElementById('createBackupBtn');
const saveBackupSettingsBtn = document.getElementById('saveBackupSettingsBtn');
const backupStatus = document.getElementById('backupStatus');

// 恢复相关元素
const restoreModal = document.getElementById('restoreModal');
const closeRestoreModalBtn = document.getElementById('closeRestoreModalBtn');
const restoreDropZone = document.getElementById('restoreDropZone');
const restoreFileInput = document.getElementById('restoreFileInput');
const selectRestoreFileBtn = document.getElementById('selectRestoreFileBtn');
const restoreMergeMode = document.getElementById('restoreMergeMode');
const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
const restoreStatus = document.getElementById('restoreStatus');

// 首次启动相关元素
const firstLaunchModal = document.getElementById('firstLaunchModal');
const firstLaunchRestoreBtn = document.getElementById('firstLaunchRestoreBtn');
const firstLaunchSkipBtn = document.getElementById('firstLaunchSkipBtn');
const emptyStateRestore = document.getElementById('emptyStateRestore');
const emptyStateRestoreBtn = document.getElementById('emptyStateRestoreBtn');

// 表单元素
const noteTitle = document.getElementById('noteTitle');
const noteUrl = document.getElementById('noteUrl');
const noteText = document.getElementById('noteText');
const noteCategory = document.getElementById('noteCategory');
const noteTagsInput = document.getElementById('noteTagsInput');
const tagsDisplay = document.getElementById('tagsDisplay');
const categoryList = document.getElementById('categoryList');
const toggleTextExpandBtn = document.getElementById('toggleTextExpandBtn');
const imageInput = document.getElementById('imageInput');
const selectImageBtn = document.getElementById('selectImageBtn');
const imagePreview = document.getElementById('imagePreview');
const capturePageBtn = document.getElementById('capturePageBtn');

// 标签管理
let currentTags = [];
let allCategories = [];

// 文档库元素
const totalNotesEl = document.getElementById('totalNotes');
const totalImagesEl = document.getElementById('totalImages');
const storageSizeEl = document.getElementById('storageSize');
const clearAllBtn = document.getElementById('clearAllBtn');
const libraryList = document.getElementById('libraryList');

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'backupFolderSelected') {
    if (backupLocation && message.folderName) {
      backupLocation.value = message.folderName;
    }
    if (typeof backupHandleStorage !== 'undefined' && backupManager) {
      backupHandleStorage.getHandle(backupManager.handleStorageKey).then((handle) => {
        backupManager.backupFolderHandle = handle;
      }).catch(error => {
        console.warn('恢复备份文件夹句柄失败:', error);
      });
    }
    showNotification('备份文件夹已选择', false);
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await backupManager.init(); // 初始化备份管理器
  await loadNotes();
  await cloudServices.init(); // 初始化云服务
  setupEventListeners();
  setupResize();
  loadCurrentPageInfo();
  updateSidebarSize();
  loadCloudServiceStatus(); // 加载云服务状态
  checkFirstLaunch(); // 检查是否首次启动
});

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['sidebarWidth', 'sidebarPosition']);
    if (result.sidebarWidth) {
      sidebarWidth = result.sidebarWidth;
    }
    if (result.sidebarPosition) {
      sidebarPosition = result.sidebarPosition;
    }
    updateSidebarPosition();
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings() {
  try {
    await chrome.storage.local.set({
      sidebarWidth: sidebarWidth,
      sidebarPosition: sidebarPosition
    });
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 更新侧边栏位置
function updateSidebarPosition() {
  if (sidebarPosition === 'left') {
    sidebarContainer.classList.add('left');
  } else {
    sidebarContainer.classList.remove('left');
  }
  // 通知父窗口更新位置
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'updateSidebarPosition',
      position: sidebarPosition
    }, '*');
  }
}

// 更新侧边栏大小
function updateSidebarSize() {
  sidebarContainer.style.width = `${sidebarWidth}px`;
  // 通知父窗口调整容器大小
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'resizeSidebar',
      width: sidebarWidth,
      position: sidebarPosition
    }, '*');
  }
}

// 设置调整大小功能
function setupResize() {
  if (!resizeHandle) return;

  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebarWidth;
    resizeHandle.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
    
    // 通知父窗口开始调整大小
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'startResize'
      }, '*');
    }
  });

  // 使用 window 级别的 mousemove 和 mouseup，确保即使鼠标移出 iframe 也能工作
  const handleMouseMove = (e) => {
    if (!isResizing) return;

    const minWidth = 300;
    const maxWidth = window.innerWidth * 0.8;
    
    let newWidth;
    if (sidebarPosition === 'right') {
      // 在右侧时，resize-handle在左侧，向左拖拽减小宽度
      const deltaX = startX - e.clientX; // 向左拖拽时 deltaX 为正（鼠标X减小）
      newWidth = startWidth + deltaX;
    } else {
      // 在左侧时，resize-handle在右侧，向右拖拽增加宽度
      const deltaX = e.clientX - startX; // 向右拖拽时 deltaX 为正（鼠标X增大）
      newWidth = startWidth + deltaX;
    }

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      sidebarWidth = newWidth;
      updateSidebarSize();
    }
  };

  const handleMouseUp = () => {
    if (isResizing) {
      isResizing = false;
      resizeHandle.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveSettings();
      
      // 通知父窗口结束调整大小
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'endResize'
        }, '*');
      }
    }
  };

  // 在 iframe 内部监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  // 也在父窗口监听（通过 postMessage）
  window.addEventListener('message', (event) => {
    if (event.data.type === 'mousemove' && isResizing) {
      handleMouseMove(event.data.event);
    } else if (event.data.type === 'mouseup' && isResizing) {
      handleMouseUp();
    }
  });

  // 确保 resize handle 可以接收鼠标事件
  resizeHandle.style.pointerEvents = 'auto';
  resizeHandle.style.zIndex = '9999';
}

// 设置事件监听
function setupEventListeners() {
  // 切换位置
  positionBtn.addEventListener('click', () => {
    sidebarPosition = sidebarPosition === 'right' ? 'left' : 'right';
    updateSidebarPosition();
    saveSettings();
  });

  // 关闭侧边栏
  closeBtn.addEventListener('click', () => {
    sidebarContainer.classList.add('hidden');
    // 通知父窗口隐藏侧边栏
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'hideSidebar'
      }, '*');
    }
    // 通知 background script 侧边栏已关闭
    chrome.runtime.sendMessage({ action: 'sidebarClosed' });
  });

  // 视图切换
  notesTab.addEventListener('click', () => switchView('notes'));

  libraryTab.addEventListener('click', () => {
    switchView('library');
    loadLibraryView();
  });

  // 添加笔记按钮
  addNoteBtn.addEventListener('click', openAddNoteModal);

  // 导入数据按钮
  importBtn.addEventListener('click', importData);

  // 导出数据按钮
  exportBtn.addEventListener('click', () => openDownloadModal({ scope: 'all' }));

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

  // 文本内容展开/收起
  if (toggleTextExpandBtn) {
    toggleTextExpandBtn.addEventListener('click', () => setTextExpandState(!isTextExpanded));
  }

  // 删除笔记
  deleteNoteBtn.addEventListener('click', async () => {
    if (currentViewingNoteId) {
      if (confirm('确定要删除这条笔记吗？')) {
        await storage.deleteNote(currentViewingNoteId);
        closeViewNoteModal();
        await loadNotes();
        if (libraryView.classList.contains('active')) {
          loadLibraryView();
        }
      }
    }
  });

  // 选择图片
  selectImageBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', (e) => handleImageSelect(e.target.files));

  // 捕获当前页面
  capturePageBtn.addEventListener('click', captureCurrentPage);

  // 文档库操作
  clearAllBtn.addEventListener('click', async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      await chrome.storage.local.clear();
      await loadNotes();
      loadLibraryView();
      alert('所有数据已清空');
    }
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
    exportToGoogleDriveBtn.addEventListener('click', () => handleCloudExport('googleDrive'));
  }
  if (exportToNotionBtn) {
    exportToNotionBtn.addEventListener('click', () => handleCloudExport('notion'));
  }
  if (exportToObsidianBtn) {
    exportToObsidianBtn.addEventListener('click', () => handleCloudExport('obsidian'));
  }

  // 云服务设置事件
  setupCloudSettingsListeners();

  // 备份设置事件
  if (backupSettingsBtn) {
    backupSettingsBtn.addEventListener('click', openBackupSettingsModal);
  }
  if (closeBackupSettingsBtn) {
    closeBackupSettingsBtn.addEventListener('click', closeBackupSettingsModal);
  }
  if (closeBackupSettingsBtn2) {
    closeBackupSettingsBtn2.addEventListener('click', closeBackupSettingsModal);
  }
  if (backupSettingsModal) {
    backupSettingsModal.addEventListener('click', (e) => {
      if (e.target === backupSettingsModal) {
        closeBackupSettingsModal();
      }
    });
  }
  if (autoBackupEnabled) {
    autoBackupEnabled.addEventListener('change', updateBackupSettingsVisibility);
  }
  if (selectBackupFolderBtn) {
    selectBackupFolderBtn.addEventListener('click', selectBackupFolder);
  }
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', handleCreateBackup);
  }
  if (saveBackupSettingsBtn) {
    saveBackupSettingsBtn.addEventListener('click', saveBackupSettings);
  }

  // 恢复数据事件
  if (restoreBtn) {
    restoreBtn.addEventListener('click', openRestoreModal);
  }
  if (closeRestoreModalBtn) {
    closeRestoreModalBtn.addEventListener('click', closeRestoreModal);
  }
  if (cancelRestoreBtn) {
    cancelRestoreBtn.addEventListener('click', closeRestoreModal);
  }
  if (restoreModal) {
    restoreModal.addEventListener('click', (e) => {
      if (e.target === restoreModal) {
        closeRestoreModal();
      }
    });
  }
  if (selectRestoreFileBtn) {
    selectRestoreFileBtn.addEventListener('click', () => restoreFileInput.click());
  }
  if (restoreFileInput) {
    restoreFileInput.addEventListener('change', handleRestoreFileSelect);
  }
  if (confirmRestoreBtn) {
    confirmRestoreBtn.addEventListener('click', handleRestoreConfirm);
  }

  // 拖拽导入功能
  setupDragAndDrop();

  // 首次启动相关事件
  if (firstLaunchRestoreBtn) {
    firstLaunchRestoreBtn.addEventListener('click', () => {
      closeFirstLaunchModal();
      openRestoreModal();
    });
  }
  if (firstLaunchSkipBtn) {
    firstLaunchSkipBtn.addEventListener('click', closeFirstLaunchModal);
  }
  if (emptyStateRestoreBtn) {
    emptyStateRestoreBtn.addEventListener('click', openRestoreModal);
  }
}

// 设置文本内容展开状态
function setTextExpandState(expanded) {
  isTextExpanded = expanded;
  addNoteModal.classList.toggle('expand-text', expanded);
  if (toggleTextExpandBtn) {
    toggleTextExpandBtn.textContent = expanded ? '收起' : '展开';
    toggleTextExpandBtn.setAttribute('aria-pressed', String(expanded));
  }
}

// 切换视图
function switchView(view) {
  if (view === 'notes') {
    sidebarContainer.classList.remove('library-active');
    notesTab.classList.add('active');
    libraryTab.classList.remove('active');
    notesView.classList.remove('hidden');
    libraryView.classList.add('hidden');
  } else {
    sidebarContainer.classList.add('library-active');
    notesTab.classList.remove('active');
    libraryTab.classList.add('active');
    notesView.classList.add('hidden');
    libraryView.classList.remove('hidden');
  }
}

// 加载文档库视图
async function loadLibraryView() {
  const notes = await storage.getAllNotes();
  
  // 更新统计信息
  totalNotesEl.textContent = notes.length;
  
  let totalImages = 0;
  notes.forEach(note => {
    if (note.images && note.images.length > 0) {
      totalImages += note.images.length;
    }
  });
  totalImagesEl.textContent = totalImages;

  // 计算存储大小（粗略估算）
  const data = await chrome.storage.local.get(null);
  const size = JSON.stringify(data).length;
  const sizeKB = (size / 1024).toFixed(2);
  storageSizeEl.textContent = `${sizeKB} KB`;

  // 渲染文档库列表
  renderLibraryList(notes);
}

// 渲染文档库列表
function renderLibraryList(notes) {
  libraryList.innerHTML = '';
  
  if (notes.length === 0) {
    libraryList.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无笔记</div>';
    return;
  }

  notes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-card';
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      viewNote(note.id);
    });

    const title = document.createElement('div');
    title.className = 'note-title';
    title.textContent = note.title || '无标题';

    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.style.marginTop = '8px';
    
    const date = document.createElement('span');
    date.textContent = formatDate(note.createdAt);
    
    const info = document.createElement('span');
    const parts = [];
    if (note.url) parts.push('🔗');
    if (note.text) parts.push(`📄 ${note.text.length}字`);
    if (note.images && note.images.length > 0) parts.push(`🖼️ ${note.images.length}`);
    info.textContent = parts.join(' ');

    meta.appendChild(date);
    meta.appendChild(info);

    item.appendChild(title);
    item.appendChild(meta);
    libraryList.appendChild(item);
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
  date.textContent = formatDate(note.createdAt);

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
  setTextExpandState(false);
  
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
    document.querySelector('#addNoteModal .modal-header h2').textContent = '编辑笔记';
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
    document.querySelector('#addNoteModal .modal-header h2').textContent = '添加笔记';
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
  setTextExpandState(false);
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
    
    // 触发自动备份
    await triggerAutoBackup();
    
    if (typeof errorHandler !== 'undefined') {
      errorHandler.showSuccess('保存成功');
    }
    
    closeAddNoteModal();
    await loadNotes();
    if (libraryView.classList.contains('active') || !libraryView.classList.contains('hidden')) {
      loadLibraryView();
    }
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

    let finalImages = newImages;

    // 如果是编辑模式，保留未替换的原有图片
    if (currentViewingNoteId) {
      const existingNote = await storage.getNote(currentViewingNoteId);
      if (existingNote && existingNote.images && existingNote.images.length > 0) {
        if (newImages.length > 0) {
          finalImages = newImages;
        } else {
          finalImages = existingNote.images;
        }
      }
    }

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
      images: finalImages,
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
    
    // 触发自动备份
    await triggerAutoBackup();
    
    // 更新 currentViewingNoteId 为保存后的 ID（如果是新建）
    if (currentViewingNoteId && currentViewingNoteId.startsWith('temp_')) {
      currentViewingNoteId = note.id;
    }
    // 静默刷新笔记列表，不关闭模态框
    await loadNotes();
    if (libraryView.classList.contains('active') || !libraryView.classList.contains('hidden')) {
      loadLibraryView();
    }
  } catch (error) {
    console.error('自动保存笔记失败:', error);
    // 自动保存失败时不显示错误提示，避免打扰用户
  }
}

// 查看笔记详情
async function viewNote(noteId) {
  const note = await storage.getNote(noteId);
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
    
    chrome.tabs.sendMessage(tab.id, { action: 'capturePage' }, async (response) => {
      if (response && response.success) {
        if (response.text) {
          noteText.value = response.text;
        }
        
        if (response.images && response.images.length > 0) {
          response.images.forEach(imageData => {
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

// 文件转 base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// base64 转 File
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

// 格式化日期
function formatDate(dateString) {
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

// 导入数据
async function importData() {
  try {
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importData = JSON.parse(event.target.result);
          
          if (!importData.notes || !Array.isArray(importData.notes)) {
            alert('无效的导入文件格式');
            return;
          }

          // 询问用户导入方式
          const importMode = confirm(
            '选择导入方式：\n' +
            '确定 = 合并导入（保留现有笔记）\n' +
            '取消 = 替换导入（清空后导入）'
          );

          let existingNotes = [];
          if (importMode) {
            // 合并模式：保留现有笔记
            existingNotes = await storage.getAllNotes();
          } else {
            // 替换模式：清空现有数据
            await chrome.storage.local.clear();
            existingNotes = [];
          }

          // 导入笔记
          let importedCount = 0;
          let skippedCount = 0;

          for (const note of importData.notes) {
            // 检查是否已存在（根据ID或标题+URL）
            const exists = existingNotes.some(existing => 
              existing.id === note.id || 
              (existing.title === note.title && existing.url === note.url)
            );

            if (!exists) {
              // 如果没有ID，生成新ID
              if (!note.id) {
                note.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
              }
              
              // 确保时间字段存在
              if (!note.createdAt) {
                note.createdAt = new Date().toISOString();
              }
              if (!note.updatedAt) {
                note.updatedAt = new Date().toISOString();
              }

              await storage.saveNote(note);
              importedCount++;
            } else {
              skippedCount++;
            }
          }

          alert(
            `导入完成！\n` +
            `成功导入：${importedCount} 条\n` +
            `跳过重复：${skippedCount} 条`
          );

          // 刷新视图
          await loadNotes();
          if (!libraryView.classList.contains('hidden')) {
            loadLibraryView();
          }
        } catch (error) {
          console.error('导入失败:', error);
          alert('导入失败：文件格式错误或数据损坏');
        }
      };

      reader.onerror = () => {
        alert('读取文件失败');
      };

      reader.readAsText(file);
      document.body.removeChild(input);
    });

    document.body.appendChild(input);
    input.click();
  } catch (error) {
    console.error('导入失败:', error);
    alert('导入失败，请重试');
  }
}



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
  const isGoogleAuth = cloudServices.googleDrive.isAuthenticated();
  setServiceStatus(googleDriveStatus, isGoogleAuth, isGoogleAuth ? '✓ 已认证' : '未认证');

  const notionStatus = document.getElementById('notionStatus');
  const notionInfo = getNotionStatusInfo();
  setServiceStatus(notionStatus, notionInfo.isConnected, notionInfo.text);

  const obsidianStatus = document.getElementById('obsidianStatus');
  const isObsidianConfigured = cloudServices.obsidian.isConfigured();
  setServiceStatus(obsidianStatus, isObsidianConfigured, isObsidianConfigured ? '✓ 已配置' : '未配置');
}

/**
 * 打开云服务设置弹窗
 */
function openCloudSettingsModal() {
  if (!cloudSettingsModal) return;
  
  // 加载当前配置
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
    'googleDriveClientId',
    'notionApiKey',
    'notionDatabaseId',
    'obsidianVaultPath',
    'mcpNotionServerUrl',
    'mcpNotionApiKey',
    'mcpNotionToolName',
    'mcpNotionEnabled'
  ]);

  const googleDriveClientId = document.getElementById('googleDriveClientId');
  if (googleDriveClientId) {
    googleDriveClientId.value = config.googleDriveClientId || '';
  }

  const notionApiKey = document.getElementById('notionApiKey');
  if (notionApiKey) {
    notionApiKey.value = config.notionApiKey || '';
  }

  const notionDatabaseId = document.getElementById('notionDatabaseId');
  if (notionDatabaseId) {
    notionDatabaseId.value = config.notionDatabaseId || '';
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

  const obsidianVaultPath = document.getElementById('obsidianVaultPath');
  if (obsidianVaultPath) {
    obsidianVaultPath.value = config.obsidianVaultPath || '';
  }
}

/**
 * 设置云服务事件监听器
 */
function setupCloudSettingsListeners() {
  // Google Drive 认证
  const googleDriveAuthBtn = document.getElementById('googleDriveAuthBtn');
  if (googleDriveAuthBtn) {
    googleDriveAuthBtn.addEventListener('click', async () => {
      const clientId = document.getElementById('googleDriveClientId')?.value;
      if (!clientId) {
        alert('请先输入 Google Drive Client ID');
        return;
      }

      try {
        await cloudServices.googleDrive.init(clientId);
        await chrome.storage.local.set({ googleDriveClientId: clientId });
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

  // Google Drive 登出
  const googleDriveLogoutBtn = document.getElementById('googleDriveLogoutBtn');
  if (googleDriveLogoutBtn) {
    googleDriveLogoutBtn.addEventListener('click', async () => {
      await cloudServices.googleDrive.logout();
      loadCloudServiceStatus();
      if (typeof errorHandler !== 'undefined') {
        errorHandler.showSuccess('已登出 Google Drive');
      } else {
        alert('已登出 Google Drive');
      }
    });
  }

  // Notion 配置保存
  const saveNotionConfigBtn = document.getElementById('saveNotionConfigBtn');
  if (saveNotionConfigBtn) {
    saveNotionConfigBtn.addEventListener('click', async () => {
      const apiKey = document.getElementById('notionApiKey')?.value;
      const databaseId = document.getElementById('notionDatabaseId')?.value;
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
          await cloudServices.notion.init(apiKey, databaseId || null);
        } else {
          await chrome.storage.local.set({ notionDatabaseId: databaseId || null });
        }
        await cloudServices.mcpNotion.init({
          serverUrl: mcpServerUrl || null,
          apiKey: mcpApiKey || null,
          databaseId: databaseId || null,
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

  // Obsidian 配置保存
  const saveObsidianConfigBtn = document.getElementById('saveObsidianConfigBtn');
  if (saveObsidianConfigBtn) {
    saveObsidianConfigBtn.addEventListener('click', async () => {
      const vaultPath = document.getElementById('obsidianVaultPath')?.value;

      try {
        await cloudServices.obsidian.init(vaultPath || null);
        loadCloudServiceStatus();
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showSuccess('Obsidian 配置已保存');
        } else {
          alert('Obsidian 配置已保存');
        }
  } catch (error) {
        console.error('保存 Obsidian 配置失败:', error);
        if (typeof errorHandler !== 'undefined') {
          errorHandler.showError('保存 Obsidian 配置失败: ' + error.message);
        } else {
          alert('保存 Obsidian 配置失败: ' + error.message);
        }
      }
    });
  }
}

// 按钮状态管理辅助函数
function setButtonLoading(button) {
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
 * @param {string} service - 服务名称（'googleDrive', 'notion', 'obsidian'）
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

  setButtonLoading(button);

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

// ==================== 备份和恢复功能 ====================

let selectedRestoreFile = null;

/**
 * 检查是否首次启动
 */
async function checkFirstLaunch() {
  try {
    const notes = await storage.getAllNotes();
    const hasSeenFirstLaunch = await chrome.storage.local.get(['hasSeenFirstLaunch']);
    
    if (notes.length === 0 && !hasSeenFirstLaunch.hasSeenFirstLaunch) {
      // 显示首次启动提示
      if (firstLaunchModal) {
        firstLaunchModal.classList.add('show');
      }
      // 在空状态中显示恢复按钮
      if (emptyStateRestore) {
        emptyStateRestore.style.display = 'block';
      }
    } else if (notes.length === 0) {
      // 如果已经看过提示但数据为空，显示恢复按钮
      if (emptyStateRestore) {
        emptyStateRestore.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('检查首次启动失败:', error);
  }
}

/**
 * 关闭首次启动提示
 */
function closeFirstLaunchModal() {
  if (firstLaunchModal) {
    firstLaunchModal.classList.remove('show');
    chrome.storage.local.set({ hasSeenFirstLaunch: true });
  }
}

/**
 * 打开备份设置弹窗
 */
async function openBackupSettingsModal() {
  if (!backupSettingsModal) return;
  
  // 加载当前设置
  await loadBackupSettings();
  updateBackupSettingsVisibility();
  
  backupSettingsModal.classList.add('show');
}

/**
 * 关闭备份设置弹窗
 */
function closeBackupSettingsModal() {
  if (backupSettingsModal) {
    backupSettingsModal.classList.remove('show');
  }
}

/**
 * 加载备份设置
 */
async function loadBackupSettings() {
  const config = await chrome.storage.local.get([
    'autoBackupEnabled',
    'backupFrequency',
    'cloudBackupEnabled',
    'backupFolderPath'
  ]);

  if (autoBackupEnabled) {
    autoBackupEnabled.checked = config.autoBackupEnabled || false;
  }
  if (backupFrequency) {
    backupFrequency.value = config.backupFrequency || 'every-save';
  }
  if (cloudBackupEnabled) {
    cloudBackupEnabled.checked = config.cloudBackupEnabled || false;
  }
  if (backupLocation && config.backupFolderPath) {
    backupLocation.value = config.backupFolderPath;
  }
}

/**
 * 更新备份设置可见性
 */
function updateBackupSettingsVisibility() {
  const enabled = autoBackupEnabled && autoBackupEnabled.checked;
  const locationGroup = document.getElementById('backupLocationGroup');
  const frequencyGroup = document.getElementById('backupFrequencyGroup');
  
  if (locationGroup) {
    locationGroup.classList.toggle('show', enabled);
  }
  if (frequencyGroup) {
    frequencyGroup.classList.toggle('show', enabled);
  }
}

async function openBackupPickerWindow() {
  const url = chrome.runtime.getURL('backup-picker.html');
  try {
    await chrome.windows.create({
      url,
      type: 'popup',
      width: 460,
      height: 320
    });
  } catch (error) {
    console.warn('打开备份选择窗口失败，尝试新标签页:', error);
    await chrome.tabs.create({ url });
  }
  showNotification('请在新窗口中选择备份文件夹', false);
}

/**
 * 选择备份文件夹
 */
async function selectBackupFolder() {
  try {
    if (window.top !== window) {
      await openBackupPickerWindow();
      return;
    }
    const handle = await backupManager.selectBackupFolder();
    if (handle) {
      if (backupLocation) {
        backupLocation.value = handle.name;
      }
      showNotification('备份文件夹已选择', false);
    }
  } catch (error) {
    console.error('选择备份文件夹失败:', error);
    showNotification('选择文件夹失败: ' + error.message, true);
  }
}

/**
 * 保存备份设置
 */
async function saveBackupSettings() {
  try {
    backupManager.autoBackupEnabled = autoBackupEnabled ? autoBackupEnabled.checked : false;
    backupManager.backupFrequency = backupFrequency ? backupFrequency.value : 'every-save';
    backupManager.cloudBackupEnabled = cloudBackupEnabled ? cloudBackupEnabled.checked : false;
    
    await backupManager.saveSettings();
    
    // 保存到 chrome.storage
    await chrome.storage.local.set({
      autoBackupEnabled: backupManager.autoBackupEnabled,
      backupFrequency: backupManager.backupFrequency,
      cloudBackupEnabled: backupManager.cloudBackupEnabled
    });
    
    showNotification('备份设置已保存', false);
    closeBackupSettingsModal();
  } catch (error) {
    console.error('保存备份设置失败:', error);
    showNotification('保存设置失败: ' + error.message, true);
  }
}

/**
 * 创建备份
 */
async function handleCreateBackup() {
  if (!createBackupBtn) return;
  
  const originalText = createBackupBtn.textContent;
  createBackupBtn.disabled = true;
  createBackupBtn.textContent = '创建中...';
  
  if (backupStatus) {
    backupStatus.style.display = 'none';
  }
  
  try {
    const notes = await storage.getAllNotes();
    if (notes.length === 0) {
      showNotification('没有可备份的笔记', true);
      return;
    }
    
    const result = await backupManager.createBackup(notes, false);
    
    // 如果启用了云端备份
    if (backupManager.cloudBackupEnabled) {
      await backupManager.backupToCloud(notes);
    }
    
    if (backupStatus) {
      backupStatus.textContent = result;
      backupStatus.className = 'service-status status-connected';
      backupStatus.style.display = 'block';
    }
    
    showNotification('备份创建成功', false);
  } catch (error) {
    console.error('创建备份失败:', error);
    if (backupStatus) {
      backupStatus.textContent = '备份失败: ' + error.message;
      backupStatus.className = 'service-status status-disconnected';
      backupStatus.style.display = 'block';
    }
    showNotification('创建备份失败: ' + error.message, true);
  } finally {
    createBackupBtn.disabled = false;
    createBackupBtn.textContent = originalText;
  }
}

/**
 * 打开恢复数据弹窗
 */
function openRestoreModal() {
  if (!restoreModal) return;
  
  selectedRestoreFile = null;
  if (restoreDropZone) {
    restoreDropZone.classList.remove('drag-over');
  }
  if (confirmRestoreBtn) {
    confirmRestoreBtn.disabled = true;
  }
  if (restoreStatus) {
    restoreStatus.style.display = 'none';
  }
  
  restoreModal.classList.add('show');
}

/**
 * 关闭恢复数据弹窗
 */
function closeRestoreModal() {
  if (restoreModal) {
    restoreModal.classList.remove('show');
  }
  selectedRestoreFile = null;
  if (restoreFileInput) {
    restoreFileInput.value = '';
  }
  // 重置拖拽区域显示
  if (restoreDropZone) {
    restoreDropZone.innerHTML = `
      <p>📁 拖拽备份文件到这里</p>
      <p class="hint">或点击下方按钮选择文件</p>
    `;
  }
  if (confirmRestoreBtn) {
    confirmRestoreBtn.disabled = true;
  }
}

/**
 * 设置拖拽导入功能
 */
function setupDragAndDrop() {
  if (!restoreDropZone) return;
  
  restoreDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    restoreDropZone.classList.add('drag-over');
  });
  
  restoreDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    restoreDropZone.classList.remove('drag-over');
  });
  
  restoreDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    restoreDropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleRestoreFile(files[0]);
    }
  });
  
  restoreDropZone.addEventListener('click', () => {
    if (restoreFileInput) {
      restoreFileInput.click();
    }
  });
}

/**
 * 处理恢复文件选择
 */
function handleRestoreFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleRestoreFile(file);
  }
}

/**
 * 处理恢复文件
 */
function handleRestoreFile(file) {
  if (!file.name.endsWith('.json')) {
    showNotification('请选择 JSON 格式的备份文件', true);
    return;
  }
  
  selectedRestoreFile = file;
  
  if (restoreDropZone) {
    restoreDropZone.innerHTML = `<p>✓ ${file.name}</p>`;
  }
  
  if (confirmRestoreBtn) {
    confirmRestoreBtn.disabled = false;
  }
}

/**
 * 确认恢复数据
 */
async function handleRestoreConfirm() {
  if (!selectedRestoreFile) {
    showNotification('请先选择备份文件', true);
    return;
  }
  
  if (!confirmRestoreBtn) return;
  
  const originalText = confirmRestoreBtn.textContent;
  confirmRestoreBtn.disabled = true;
  confirmRestoreBtn.textContent = '恢复中...';
  
  if (restoreStatus) {
    restoreStatus.style.display = 'none';
  }
  
  try {
    const text = await selectedRestoreFile.text();
    const importData = JSON.parse(text);
    
    if (!importData.notes || !Array.isArray(importData.notes)) {
      throw new Error('无效的备份文件格式');
    }
    
    const mergeMode = restoreMergeMode ? restoreMergeMode.checked : true;
    let existingNotes = [];
    
    if (mergeMode) {
      existingNotes = await storage.getAllNotes();
    } else {
      await chrome.storage.local.clear();
      existingNotes = [];
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const note of importData.notes) {
      const exists = existingNotes.some(existing => 
        existing.id === note.id || 
        (existing.title === note.title && existing.url === note.url)
      );
      
      if (!exists) {
        if (!note.id) {
          note.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        }
        if (!note.createdAt) {
          note.createdAt = new Date().toISOString();
        }
        if (!note.updatedAt) {
          note.updatedAt = new Date().toISOString();
        }
        
        await storage.saveNote(note);
        importedCount++;
      } else {
        skippedCount++;
      }
    }
    
    if (restoreStatus) {
      restoreStatus.textContent = `成功恢复 ${importedCount} 条笔记，跳过 ${skippedCount} 条重复`;
      restoreStatus.className = 'service-status status-connected';
      restoreStatus.style.display = 'block';
    }
    
    showNotification(`恢复完成！成功导入 ${importedCount} 条笔记`, false);
    
    // 刷新视图
    await loadNotes();
    if (libraryView && !libraryView.classList.contains('hidden')) {
      loadLibraryView();
    }
    
    // 关闭弹窗
    setTimeout(() => {
      closeRestoreModal();
      closeFirstLaunchModal();
      if (emptyStateRestore) {
        emptyStateRestore.style.display = 'none';
      }
    }, 1500);
  } catch (error) {
    console.error('恢复数据失败:', error);
    if (restoreStatus) {
      restoreStatus.textContent = '恢复失败: ' + error.message;
      restoreStatus.className = 'service-status status-disconnected';
      restoreStatus.style.display = 'block';
    }
    showNotification('恢复失败: ' + error.message, true);
  } finally {
    confirmRestoreBtn.disabled = false;
    confirmRestoreBtn.textContent = originalText;
  }
}

/**
 * 触发自动备份（在保存笔记后调用）
 */
async function triggerAutoBackup() {
  try {
    if (!backupManager.shouldBackup()) {
      return;
    }
    
    const notes = await storage.getAllNotes();
    if (notes.length === 0) {
      return;
    }
    
    // 异步执行备份，不阻塞主流程
    backupManager.createBackup(notes, false).catch(error => {
      console.error('自动备份失败:', error);
    });
    
    // 云端备份
    if (backupManager.cloudBackupEnabled) {
      backupManager.backupToCloud(notes).catch(error => {
        console.error('云端自动备份失败:', error);
      });
    }
  } catch (error) {
    console.error('触发自动备份失败:', error);
  }
}
