// Popup 主逻辑
const storage = noteStorage;
let currentViewingNoteId = null;

// DOM 元素
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

// 表单元素
const noteTitle = document.getElementById('noteTitle');
const noteUrl = document.getElementById('noteUrl');
const noteText = document.getElementById('noteText');
const imageInput = document.getElementById('imageInput');
const selectImageBtn = document.getElementById('selectImageBtn');
const imagePreview = document.getElementById('imagePreview');
const capturePageBtn = document.getElementById('capturePageBtn');

let selectedImages = [];

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
    await exportData();
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
    await saveNote();
  });

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
    document.querySelector('.modal-header h2').textContent = '编辑笔记';
    currentViewingNoteId = note.id;
  } else {
    // 新建模式
    loadCurrentPageInfo();
    noteText.value = '';
    selectedImages = [];
    imagePreview.innerHTML = '';
    saveNoteBtn.textContent = '保存';
    document.querySelector('.modal-header h2').textContent = '添加笔记';
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
        // 如果用户选择了新图片，使用新图片；否则保留原有图片
        if (newImages.length > 0) {
          finalImages = newImages;
        } else {
          finalImages = existingNote.images;
        }
      }
    }

    const note = {
      id: currentViewingNoteId, // 如果是编辑模式，保留原有 ID
      title: title || '无标题',
      url: url,
      text: text,
      images: finalImages,
      updatedAt: new Date().toISOString()
    };

    // 如果是新建，设置创建时间
    if (!currentViewingNoteId) {
      note.createdAt = new Date().toISOString();
    } else {
      // 编辑时保留原有创建时间
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
  } catch (error) {
    console.error('保存笔记失败:', error);
    alert('保存失败，请重试');
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
      img.src = imageData;
      img.alt = `图片 ${index + 1}`;
      img.addEventListener('click', () => {
        // 在新窗口中打开大图
        window.open(imageData, '_blank');
      });
      imagesDiv.appendChild(img);
    });
    viewBody.appendChild(imagesDiv);
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

// 导出数据
async function exportData() {
  try {
    const notes = await storage.getAllNotes();
    
    if (notes.length === 0) {
      alert('没有可导出的笔记');
      return;
    }

    // 创建导出数据（不包含图片的 base64，因为太大）
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

    // 转换为 JSON 字符串
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // 创建 Blob 并下载
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fact-notebook-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 如果用户需要包含图片的完整导出，提供选项
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

