const pickFolderBtn = document.getElementById('pickFolderBtn');
const closeBtn = document.getElementById('closeBtn');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = isError ? 'status error' : 'status';
}

async function handlePickFolder() {
  if (!pickFolderBtn) return;
  pickFolderBtn.disabled = true;
  setStatus('等待选择文件夹...');

  try {
    const handle = await backupManager.selectBackupFolder();
    if (handle) {
      chrome.runtime.sendMessage({
        type: 'backupFolderSelected',
        folderName: handle.name
      });
      setStatus('已选择文件夹，窗口将自动关闭。');
      setTimeout(() => window.close(), 500);
    } else {
      setStatus('已取消选择。');
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    setStatus(`选择失败: ${error.message}`, true);
  } finally {
    pickFolderBtn.disabled = false;
  }
}

if (pickFolderBtn) {
  pickFolderBtn.addEventListener('click', handlePickFolder);
}

if (closeBtn) {
  closeBtn.addEventListener('click', () => window.close());
}
