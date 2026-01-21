// 侧边栏主逻辑
const storage = noteStorage;
let currentViewingNoteId = null;
let selectedImages = [];
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
const closeViewModal = document.getElementById('closeViewModal');
const cancelBtn = document.getElementById('cancelBtn');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const closeViewBtn = document.getElementById('closeViewBtn');
const notesTab = document.getElementById('notesTab');
const libraryTab = document.getElementById('libraryTab');
const notesView = document.getElementById('notesView');
const libraryView = document.getElementById('libraryView');

// 表单元素
const noteTitle = document.getElementById('noteTitle');
const noteUrl = document.getElementById('noteUrl');
const noteText = document.getElementById('noteText');
const toggleTextExpandBtn = document.getElementById('toggleTextExpandBtn');
const imageInput = document.getElementById('imageInput');
const selectImageBtn = document.getElementById('selectImageBtn');
const imagePreview = document.getElementById('imagePreview');
const capturePageBtn = document.getElementById('capturePageBtn');

// 文档库元素
const totalNotesEl = document.getElementById('totalNotes');
const totalImagesEl = document.getElementById('totalImages');
const storageSizeEl = document.getElementById('storageSize');
const importAllBtn = document.getElementById('importAllBtn');
const exportAllBtn = document.getElementById('exportAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const libraryList = document.getElementById('libraryList');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadNotes();
  setupEventListeners();
  setupResize();
  loadCurrentPageInfo();
  updateSidebarSize();
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
  notesTab.addEventListener('click', () => {
    switchView('notes');
  });

  libraryTab.addEventListener('click', () => {
    switchView('library');
    loadLibraryView();
  });

  // 添加笔记按钮
  addNoteBtn.addEventListener('click', () => {
    openAddNoteModal();
  });

  // 导出数据按钮
  exportBtn.addEventListener('click', async () => {
    await showExportFormatDialog();
  });

  // 搜索
  searchInput.addEventListener('input', async (e) => {
    await loadNotes(e.target.value);
  });

  // 模态框关闭
  closeModal.addEventListener('click', closeAddNoteModal);
  closeViewModal.addEventListener('click', closeViewNoteModal);
  cancelBtn.addEventListener('click', closeAddNoteModal);
  closeViewBtn.addEventListener('click', closeViewNoteModal);

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

  // 文本内容展开/收起
  if (toggleTextExpandBtn) {
    toggleTextExpandBtn.addEventListener('click', () => {
      setTextExpandState(!isTextExpanded);
    });
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

  // 文档库操作
  importAllBtn.addEventListener('click', async () => {
    await importData();
  });

  exportAllBtn.addEventListener('click', async () => {
    await exportData();
  });

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
    notesTab.classList.add('active');
    libraryTab.classList.remove('active');
    notesView.classList.remove('hidden');
    libraryView.classList.add('hidden');
  } else {
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

  const url = document.createElement('div');
  url.className = 'note-url';
  url.textContent = note.url || '';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  
  const date = document.createElement('span');
  date.textContent = formatDate(note.createdAt);

  const imagesCount = document.createElement('span');
  imagesCount.className = 'note-images-count';
  if (note.images && note.images.length > 0) {
    imagesCount.innerHTML = `🖼️ ${note.images.length}`;
  }

  meta.appendChild(date);
  meta.appendChild(imagesCount);

  card.appendChild(title);
  card.appendChild(preview);
  if (note.url) {
    card.appendChild(url);
  }
  card.appendChild(meta);

  return card;
}

// 打开添加笔记模态框
function openAddNoteModal(note = null) {
  addNoteModal.classList.add('show');
  setTextExpandState(false);
  
  if (note) {
    // 编辑模式
    noteTitle.value = note.title || '';
    noteUrl.value = note.url || '';
    noteText.value = note.text || '';
    selectedImages = [];
    imagePreview.innerHTML = '';
    
    // 显示原有图片（只读预览）
    if (note.images && note.images.length > 0) {
      note.images.forEach((imageData, index) => {
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
    selectedImages = [];
    imagePreview.innerHTML = '';
    saveNoteBtn.textContent = '保存';
    document.querySelector('#addNoteModal .modal-header h2').textContent = '添加笔记';
    currentViewingNoteId = null;
  }
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
  selectedImages = [];
  imagePreview.innerHTML = '';
}

// 保存笔记
async function saveNote() {
  const title = noteTitle.value.trim();
  const url = noteUrl.value.trim();
  const text = noteText.value.trim();

  if (!title && !text && selectedImages.length === 0) {
    alert('请至少填写标题、文本或添加图片');
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

    const note = {
      id: currentViewingNoteId,
      title: title || '无标题',
      url: url,
      text: text,
      images: finalImages,
      updatedAt: new Date().toISOString()
    };

    if (!currentViewingNoteId) {
      note.createdAt = new Date().toISOString();
    } else {
      const existingNote = await storage.getNote(currentViewingNoteId);
      if (existingNote) {
        note.createdAt = existingNote.createdAt;
      } else {
        note.createdAt = new Date().toISOString();
      }
    }

    await storage.saveNote(note);
    closeAddNoteModal();
    await loadNotes();
    if (libraryView.classList.contains('active') || !libraryView.classList.contains('hidden')) {
      loadLibraryView();
    }
  } catch (error) {
    console.error('保存笔记失败:', error);
    alert('保存失败，请重试');
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

  // 添加编辑按钮
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-secondary';
  editBtn.textContent = '编辑';
  editBtn.style.marginTop = '16px';
  editBtn.addEventListener('click', () => {
    closeViewNoteModal();
    editNote(noteId);
  });
  viewBody.appendChild(editBtn);

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

// 显示导出格式选择对话框
async function showExportFormatDialog() {
  const format = prompt(
    '请选择导出格式：\n\n' +
    '1. JSON - 原始数据格式（支持导入）\n' +
    '2. Markdown - Markdown 格式\n' +
    '3. PDF - PDF 文档\n' +
    '4. DOCX - Word 文档\n\n' +
    '请输入数字 (1-4):',
    '1'
  );

  if (!format) return;

  switch (format.trim()) {
    case '1':
      await exportToJSON();
      break;
    case '2':
      await exportToMarkdown();
      break;
    case '3':
      await exportToPDF();
      break;
    case '4':
      await exportToDOCX();
      break;
    default:
      alert('无效的格式选择');
  }
}

// 导出为 JSON
async function exportToJSON() {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      totalNotes: notes.length,
      notes: notes.map(note => ({
        id: note.id,
        title: note.title,
        url: note.url,
        text: note.text,
        imageCount: note.images ? note.images.length : 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const includeImages = confirm('是否导出包含图片的完整数据？\n（文件会很大，建议先导出简化版本）');
    
    if (includeImages) {
      const fullExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalNotes: notes.length,
        notes: notes
      };
      
      const fullJsonString = JSON.stringify(fullExportData, null, 2);
      const fullBlob = new Blob([fullJsonString], { type: 'application/json' });
      const fullUrl = URL.createObjectURL(fullBlob);
      const fullA = document.createElement('a');
      fullA.href = fullUrl;
      fullA.download = `fact-notebook-full-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(fullA);
      fullA.click();
      document.body.removeChild(fullA);
      URL.revokeObjectURL(fullUrl);
    }
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
}

// 导出为 Markdown
async function exportToMarkdown() {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    let markdown = `# 事实笔记本导出\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**笔记总数**: ${notes.length}\n\n`;
    markdown += `---\n\n`;

    notes.forEach((note, index) => {
      markdown += `## ${index + 1}. ${note.title || '无标题'}\n\n`;
      
      if (note.url) {
        markdown += `**来源**: [${note.url}](${note.url})\n\n`;
      }
      
      if (note.text) {
        markdown += `### 内容\n\n`;
        markdown += `${note.text}\n\n`;
      }
      
      if (note.images && note.images.length > 0) {
        markdown += `### 图片 (${note.images.length} 张)\n\n`;
        note.images.forEach((imageData, imgIndex) => {
          // Markdown 中直接嵌入 base64 图片
          markdown += `![图片 ${imgIndex + 1}](${imageData})\n\n`;
        });
      }
      
      if (note.createdAt) {
        markdown += `**创建时间**: ${new Date(note.createdAt).toLocaleString('zh-CN')}\n`;
      }
      if (note.updatedAt) {
        markdown += `**更新时间**: ${new Date(note.updatedAt).toLocaleString('zh-CN')}\n`;
      }
      
      markdown += `\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
}

// 导出为 PDF
async function exportToPDF() {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    // 创建打印用的 HTML 内容
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
          img { max-width: 100%; height: auto; margin: 10px 0; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <h1>事实笔记本导出</h1>
        <p><strong>导出时间</strong>: ${new Date().toLocaleString('zh-CN')}</p>
        <p><strong>笔记总数</strong>: ${notes.length}</p>
        <hr>
    `;

    notes.forEach((note, index) => {
      htmlContent += `<div class="note ${index > 0 ? 'page-break' : ''}">`;
      htmlContent += `<h2>${index + 1}. ${escapeHtml(note.title || '无标题')}</h2>`;
      
      if (note.url) {
        htmlContent += `<p class="url"><strong>来源</strong>: <a href="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a></p>`;
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
        htmlContent += `创建时间: ${new Date(note.createdAt).toLocaleString('zh-CN')} `;
      }
      if (note.updatedAt) {
        htmlContent += `更新时间: ${new Date(note.updatedAt).toLocaleString('zh-CN')}`;
      }
      htmlContent += `</div>`;
      htmlContent += `</div>`;
    });

    htmlContent += `</body></html>`;

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
    alert('导出失败，请重试');
  }
}

// 导出为 DOCX
async function exportToDOCX() {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    // DOCX 文件实际上是 ZIP 文件，包含 XML
    // 这里我们创建一个简单的 HTML 文件，用户可以在 Word 中打开并另存为 DOCX
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
          img { max-width: 100%; height: auto; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>事实笔记本导出</h1>
        <p><strong>导出时间</strong>: ${new Date().toLocaleString('zh-CN')}</p>
        <p><strong>笔记总数</strong>: ${notes.length}</p>
        <hr>
    `;

    notes.forEach((note, index) => {
      htmlContent += `<div class="note">`;
      htmlContent += `<h2>${index + 1}. ${escapeHtml(note.title || '无标题')}</h2>`;
      
      if (note.url) {
        htmlContent += `<p class="url"><strong>来源</strong>: <a href="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a></p>`;
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
        htmlContent += `创建时间: ${new Date(note.createdAt).toLocaleString('zh-CN')} `;
      }
      if (note.updatedAt) {
        htmlContent += `更新时间: ${new Date(note.updatedAt).toLocaleString('zh-CN')}`;
      }
      htmlContent += `</div>`;
      htmlContent += `</div>`;
    });

    htmlContent += `</body></html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('已导出为 Word 格式文件。\n注意：这是一个 HTML 文件，可以在 Word 中打开并另存为真正的 DOCX 格式。');
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
}

// HTML 转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
