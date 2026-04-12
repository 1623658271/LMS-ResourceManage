// ============================================================
// 系统设置
// ============================================================
const DEFAULT_SETTINGS = {
  darkmode: false,
  radius: '8px',
  shadow: '0 2px 8px rgba(0,0,0,0.08)',
  'fontSize-base': '13',
  'fontSize-title': '14',
  'fontSize-h1': '20',
  fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  'table-fontSize': '13',
  'table-rowHeight': '40',
  'table-zebra': false,
  'table-compact': false,
  'table-groupSize': '8',
  'table-displayMode': 'single',  // 固定为单表格模式
  primary: '#3b82f6',
  'sidebar-bg': '#1e293b',
  bg: '#f1f5f9',
  'card-bg': '#ffffff',
  text: '#1e293b',
  'sidebar-width': '220',
  'content-padding': '18',
  'card-gap': '14'
};

const COLOR_PRESETS = {
  blue: { primary: '#3b82f6', 'sidebar-bg': '#1e293b', bg: '#f1f5f9', 'card-bg': '#ffffff', text: '#1e293b' },
  green: { primary: '#22c55e', 'sidebar-bg': '#14532d', bg: '#f0fdf4', 'card-bg': '#ffffff', text: '#166534' },
  purple: { primary: '#8b5cf6', 'sidebar-bg': '#4c1d95', bg: '#f5f3ff', 'card-bg': '#ffffff', text: '#4c1d95' },
  orange: { primary: '#f59e0b', 'sidebar-bg': '#78350f', bg: '#fffbeb', 'card-bg': '#ffffff', text: '#78350f' },
  red: { primary: '#ef4444', 'sidebar-bg': '#7f1d1d', bg: '#fef2f2', 'card-bg': '#ffffff', text: '#7f1d1d' }
};

let _currentSettings = { ...DEFAULT_SETTINGS };
let _savedDarkColors = {};  // 深色模式切换时保存浅色模式颜色

function loadSettings() {
  try {
    const saved = localStorage.getItem('li_jie_hr_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      _currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    _currentSettings = { ...DEFAULT_SETTINGS };
  }
}

function applyAllSettings() {
  for (const key in _currentSettings) {
    applySetting(key, _currentSettings[key], true);
  }
}

function applySetting(key, value, skipSave = false) {
  _currentSettings[key] = value;
  const root = document.documentElement;

  switch (key) {
    case 'darkmode':
      if (value) {
        root.style.setProperty('--bg', '#0f172a');
        root.style.setProperty('--card-bg', '#1e293b');
        root.style.setProperty('--text', '#f1f5f9');
        root.style.setProperty('--text-muted', '#94a3b8');
        root.style.setProperty('--border', '#334155');
      } else {
        // 保存深色模式的颜色值
        _savedDarkColors = {
          bg: root.style.getPropertyValue('--bg'),
          'card-bg': root.style.getPropertyValue('--card-bg'),
          text: root.style.getPropertyValue('--text')
        };
        // 恢复浅色模式颜色
        root.style.setProperty('--bg', _currentSettings.bg || '#f1f5f9');
        root.style.setProperty('--card-bg', _currentSettings['card-bg'] || '#ffffff');
        root.style.setProperty('--text', _currentSettings.text || '#1e293b');
        root.style.setProperty('--text-muted', '#64748b');
        root.style.setProperty('--border', '#e2e8f0');
      }
      break;
    case 'radius':
    case 'shadow':
    case 'sidebar-width':
    case 'content-padding':
    case 'card-gap':
      root.style.setProperty('--' + key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      if (key === 'sidebar-width') root.style.setProperty('--sidebar-width', value + 'px');
      if (key === 'content-padding') root.style.setProperty('--content-padding', value + 'px');
      if (key === 'card-gap') root.style.setProperty('--card-gap', value + 'px');
      break;
    case 'fontFamily':
      // 字体族需要加引号
      root.style.setProperty('--font-family', "'" + value.replace(/'/g, "\\'") + "'");
      break;
    case 'fontSize-base':
    case 'fontSize-title':
    case 'fontSize-h1':
      root.style.setProperty('--font-size-' + key.split('-')[1], value + 'px');
      break;
    case 'table-fontSize':
      root.style.setProperty('--table-font-size', value + 'px');
      document.querySelectorAll('.settings-preview-table').forEach(t => t.style.fontSize = value + 'px');
      break;
    case 'table-rowHeight':
      root.style.setProperty('--table-row-height', value + 'px');
      break;
    case 'table-zebra':
      // 移除旧斑马纹规则
      if (window._zebraRuleIdx !== undefined) {
        try { document.styleSheets[0].deleteRule(window._zebraRuleIdx); } catch(e) {}
        window._zebraRuleIdx = undefined;
      }
      if (value) {
        // 在样式表开头插入斑马纹规则
        document.styleSheets[0].insertRule('tbody tr:nth-child(odd) td { background: var(--bg); }', 0);
        window._zebraRuleIdx = 0;
      }
      break;
    case 'table-compact':
      if (value) {
        root.style.setProperty('--content-padding', '10px');
        root.style.setProperty('--card-gap', '8px');
        document.querySelectorAll('.spreadsheet, .settings-preview-table').forEach(t => t.style.fontSize = '11px');
      } else {
        root.style.setProperty('--content-padding', _currentSettings['content-padding'] + 'px');
        root.style.setProperty('--card-gap', _currentSettings['card-gap'] + 'px');
        document.querySelectorAll('.spreadsheet, .settings-preview-table').forEach(t => t.style.fontSize = _currentSettings['table-fontSize'] + 'px');
      }
      break;
    case 'table-displayMode':
      // 显示/隐藏分组数量控件
      const groupRow = document.getElementById('table-groupSize-row');
      if (groupRow) groupRow.style.display = value === 'single' ? 'none' : 'flex';
      break;
    case 'table-groupSize':
      // 仅记录设置值，不要在这里渲染，渲染只在用户切换页面时发生
      break;
    case 'primary':
    case 'sidebar-bg':
    case 'bg':
    case 'card-bg':
    case 'text':
      root.style.setProperty('--' + key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
      if (!_currentSettings.darkmode) {
        if (key === 'bg') root.style.setProperty('--bg', value);
        if (key === 'card-bg') root.style.setProperty('--card-bg', value);
        if (key === 'text') root.style.setProperty('--text', value);
      }
      // 更新 primary 相关的派生色
      if (key === 'primary') {
        root.style.setProperty('--primary-dark', adjustColor(value, -20));
        root.style.setProperty('--primary-light', adjustColor(value, 60, true));
        root.style.setProperty('--sidebar-active', value);
      }
      break;
  }

  // 更新控件显示
  updateControlDisplay(key, value);
  if (!skipSave) saveSettingsDebounced();
}

function updateControlDisplay(key, value) {
  const el = document.getElementById('s-' + key);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = value;
  } else if (el.tagName === 'SELECT') {
    el.value = value;
  } else if (el.type === 'range') {
    el.value = value;
    updateSliderVal(key, value);
  } else if (el.type === 'color') {
    el.value = value;
    updateColorHex(key, value);
  }
}

function updateSliderVal(key, value) {
  const valEl = document.getElementById('s-' + key + '-val');
  if (valEl) {
    const suffix = key === 'table-groupSize' ? '人' : 'px';
    valEl.textContent = value + suffix;
  }
}

function updateColorHex(key, value) {
  const hexEl = document.getElementById('s-' + key + '-hex');
  if (hexEl) hexEl.textContent = value;
}

function applyColorPreset(preset) {
  if (preset === 'custom') return;
  const colors = COLOR_PRESETS[preset];
  if (colors) {
    for (const [key, value] of Object.entries(colors)) {
      applySetting(key, value, true);
      _currentSettings[key] = value;
    }
    saveSettings();
  }
}

let _saveTimer = null;
function saveSettingsDebounced() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveSettings, 300);
}

function saveSettings(silent = false) {
  localStorage.setItem('li_jie_hr_settings', JSON.stringify(_currentSettings));
  if (!silent) showToast('设置已保存', 'success');
}

function resetSettings() {
  _currentSettings = { ...DEFAULT_SETTINGS };
  applyAllSettings();
  saveSettings();
  showToast('已恢复默认设置', 'info');
}

function resetAllSettings() {
  if (confirm('确定要重置所有设置吗？这将恢复所有设置为默认值。')) {
    resetSettings();
  }
}

function exportSettings() {
  const data = JSON.stringify(_currentSettings, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lijie_hr_settings_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('设置已导出', 'success');
}

function importSettings(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      _currentSettings = { ...DEFAULT_SETTINGS, ...data };
      applyAllSettings();
      saveSettings();
      showToast('设置已导入', 'success');
    } catch (err) {
      showToast('导入失败：文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function clearQuickCalcSaves() {
  if (confirm('确定要清除快捷计算的自动保存数据吗？')) {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('li_jie_hr_qc_')) localStorage.removeItem(k);
    });
    showToast('快捷计算保存数据已清除', 'success');
  }
}

// ── 数据库导入导出 ─────────────────────────────────────────

async function exportDatabase() {
  try {
    const result = await get('/api/database/export');
    if (result.ok) {
      // 将 base64 数据转换为文件下载
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/x-sqlite3' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `li_jie_hr_backup_${new Date().toISOString().slice(0,10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast('数据库已导出', 'success');
    } else {
      showToast('导出失败：' + result.error, 'error');
    }
  } catch (err) {
    showToast('导出失败：' + err.message, 'error');
  }
}

async function importDatabase(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (!confirm('警告：导入数据库将覆盖当前所有数据！\n\n建议先导出当前数据库作为备份。\n\n确定要继续吗？')) {
    input.value = '';
    return;
  }
  
  try {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        // 将文件转换为 base64
        const arrayBuffer = e.target.result;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        // 调用 API 导入
        const result = await post('/api/database/import', { data: base64Data });
        
        if (result.ok) {
          showToast('数据库导入成功，请刷新页面', 'success');
          // 延迟刷新页面
          setTimeout(() => {
            location.reload();
          }, 1500);
        } else {
          showToast('导入失败：' + result.error, 'error');
        }
      } catch (err) {
        showToast('导入失败：' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    showToast('读取文件失败：' + err.message, 'error');
  }
  
  input.value = '';
}

function initSettingsPage() {
  // 设置页面初始化时，同步所有控件的值
  for (const key in _currentSettings) {
    updateControlDisplay(key, _currentSettings[key]);
  }
}

// 设置导航切换
document.querySelectorAll('.settings-nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    const section = el.dataset.settings;
    document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById('settings-' + section);
    if (target) target.style.display = 'block';
  });
});
