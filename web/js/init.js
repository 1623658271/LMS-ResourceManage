// ============================================================
// 初始化
// ============================================================
(async function init() {
  loadSettings(); // 加载用户设置到 _currentSettings
  initMonthPickers();
  await initQcSwitch();
  await loadMembers();
  document.getElementById('topbarHint').textContent = '立杰人力资源管理系统 v2.0';
  // 加载保存的设置，再应用（触发 CSS 变量生效）
  loadSettings();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyAllSettings());
  } else {
    applyAllSettings();
  }
  // 隐藏加载遮罩
  hideLoadingOverlay();
})();

// 隐藏加载遮罩
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}
