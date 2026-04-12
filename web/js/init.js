// ============================================================
// 初始化
// ============================================================
(async function init() {
  loadSettings(); // 加载用户设置到 _currentSettings
  initMonthPickers();
  await loadMembers();
  document.getElementById('topbarHint').textContent = '立杰人力资源管理系统 v2.0';
  // 加载保存的设置，再应用（触发 CSS 变量生效）
  loadSettings();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyAllSettings());
  } else {
    applyAllSettings();
  }
})();
