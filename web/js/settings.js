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
  'card-gap': '14',
  'window-width': '1400',
  'window-height': '900',
  'window-resolution': '1400x900',
  'window-fullscreen': false,
  'window-maximized': false
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
        root.style.setProperty('--table-font-size', '11px');
      } else {
        root.style.setProperty('--content-padding', _currentSettings['content-padding'] + 'px');
        root.style.setProperty('--card-gap', _currentSettings['card-gap'] + 'px');
        root.style.setProperty('--table-font-size', _currentSettings['table-fontSize'] + 'px');
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

// 双击滑块数值输入自定义值
function editSliderVal(key, el) {
  const currentVal = parseInt(el.textContent) || 13;
  const input = document.createElement('input');
  input.type = 'number';
  input.value = currentVal;
  input.style.cssText = 'width:60px;padding:2px 4px;border:1px solid var(--primary);border-radius:4px;font-size:12px;text-align:center;';
  
  // 根据设置项设置不同的最小最大值
  if (key === 'table-groupSize') {
    input.min = 5;
    input.max = 50;
  } else if (key === 'window-width') {
    input.min = 800;
    input.max = 3840;
  } else if (key === 'window-height') {
    input.min = 600;
    input.max = 2160;
  } else if (key === 'sidebar-width') {
    input.min = 150;
    input.max = 400;
  } else if (key === 'content-padding' || key === 'card-gap') {
    input.min = 0;
    input.max = 50;
  } else if (key === 'table-rowHeight') {
    input.min = 24;
    input.max = 80;
  } else {
    input.min = 8;
    input.max = 32;
  }
  
  const saveValue = () => {
    let val = parseInt(input.value);
    if (isNaN(val)) val = currentVal;
    // 限制范围
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    val = Math.max(min, Math.min(max, val));
    
    // 更新显示
    const suffix = key === 'table-groupSize' ? '人' : 'px';
    el.textContent = val + suffix;
    
    // 同步更新滑块
    const slider = document.getElementById('s-' + key);
    if (slider) {
      slider.value = val;
    }
    
    // 应用设置
    applySetting(key, val);
    _currentSettings[key] = val;
    saveSettings();
  };
  
  input.onblur = saveValue;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      const suffix = key === 'table-groupSize' ? '人' : 'px';
      el.textContent = currentVal + suffix;
      el.style.display = '';
    }
  };
  
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();
}

// 分辨率预设列表
const RESOLUTION_PRESETS = [
  { w: 2560, h: 1600, label: '2560 × 1600 (推荐)' },
  { w: 2560, h: 1440, label: '2560 × 1440' },
  { w: 2048, h: 1536, label: '2048 × 1536' },
  { w: 2048, h: 1152, label: '2048 × 1152' },
  { w: 1920, h: 1440, label: '1920 × 1440' },
  { w: 1920, h: 1200, label: '1920 × 1200' },
  { w: 1920, h: 1080, label: '1920 × 1080' },
  { w: 1856, h: 1392, label: '1856 × 1392' },
  { w: 1792, h: 1344, label: '1792 × 1344' },
  { w: 1680, h: 1050, label: '1680 × 1050' },
  { w: 1600, h: 1200, label: '1600 × 1200' },
  { w: 1600, h: 900, label: '1600 × 900' },
  { w: 1440, h: 900, label: '1440 × 900' },
  { w: 1400, h: 1050, label: '1400 × 1050' },
  { w: 1366, h: 768, label: '1366 × 768' },
  { w: 1360, h: 768, label: '1360 × 768' },
  { w: 1280, h: 1024, label: '1280 × 1024' },
  { w: 1280, h: 960, label: '1280 × 960' },
  { w: 1280, h: 800, label: '1280 × 800' },
  { w: 1280, h: 768, label: '1280 × 768' },
  { w: 1280, h: 720, label: '1280 × 720' },
  { w: 1280, h: 600, label: '1280 × 600' },
  { w: 1152, h: 864, label: '1152 × 864' },
  { w: 1024, h: 768, label: '1024 × 768' },
  { w: 800, h: 600, label: '800 × 600' }
];

// 分辨率下拉框变化
function onResolutionChange(value) {
  if (value === 'custom') {
    // 保持当前值，等待用户双击自定义
    return;
  }
  const [w, h] = value.split('x').map(Number);
  if (w && h) {
    // 更新显示
    const valEl = document.getElementById('s-window-res-val');
    if (valEl) {
      valEl.textContent = `${w} × ${h}`;
    }
    // 更新设置
    _currentSettings['window-width'] = w;
    _currentSettings['window-height'] = h;
    _currentSettings['window-resolution'] = value;
    // 保存设置
    saveSettings();
    // 立即应用窗口设置
    applyWindowSettings();
  }
}

// 双击分辨率数值自定义
function editResolutionVal(el) {
  const currentText = el.textContent.trim();
  const match = currentText.match(/(\d+)\s*×\s*(\d+)/);
  const currentW = match ? parseInt(match[1]) : 1400;
  const currentH = match ? parseInt(match[2]) : 900;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = `${currentW}x${currentH}`;
  input.placeholder = '宽x高，如 1920x1080';
  input.style.cssText = 'width:100px;padding:4px 6px;border:1px solid var(--primary);border-radius:4px;font-size:13px;text-align:center;';
  
  const saveValue = () => {
    const val = input.value.trim();
    const parts = val.split(/[xX×,，\s]+/).map(Number);
    let w = parts[0] || currentW;
    let h = parts[1] || currentH;
    
    // 限制范围
    w = Math.max(800, Math.min(3840, w));
    h = Math.max(600, Math.min(2160, h));
    
    // 更新显示
    el.textContent = `${w} × ${h}`;
    
    // 查找是否匹配预设
    const preset = RESOLUTION_PRESETS.find(r => r.w === w && r.h === h);
    const select = document.getElementById('s-window-resolution');
    if (select) {
      if (preset) {
        select.value = `${w}x${h}`;
        _currentSettings['window-resolution'] = `${w}x${h}`;
      } else {
        select.value = 'custom';
        _currentSettings['window-resolution'] = 'custom';
      }
    }
    
    // 更新宽高设置
    _currentSettings['window-width'] = w;
    _currentSettings['window-height'] = h;
    saveSettings();
    applyWindowSettings();
    
    el.style.display = '';
  };
  
  input.onblur = saveValue;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      el.textContent = currentText;
      el.style.display = '';
    }
  };
  
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();
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

async function loadWindowSettingsFromFile() {
  // 从 window_settings.json 文件读取窗口设置并更新分辨率显示
  try {
    const result = await get('/api/window/settings');
    // 后端返回的是 result.config，不是 result.data
    const settings = result.config || result.data;
    if (result.ok && settings) {
      const width = settings.width || 1400;
      const height = settings.height || 900;
      
      // 更新当前设置
      _currentSettings['window-width'] = width;
      _currentSettings['window-height'] = height;
      
      // 更新分辨率显示
      const valEl = document.getElementById('s-window-res-val');
      if (valEl) {
        valEl.textContent = `${width} × ${height}`;
      }
      
      // 查找是否匹配预设分辨率
      const select = document.getElementById('s-window-resolution');
      if (select) {
        const presetKey = `${width}x${height}`;
        const hasPreset = Array.from(select.options).some(opt => opt.value === presetKey);
        if (hasPreset) {
          select.value = presetKey;
          _currentSettings['window-resolution'] = presetKey;
        } else {
          select.value = 'custom';
          _currentSettings['window-resolution'] = 'custom';
        }
      }
      
      // 更新全屏和最大化开关（互斥：只有一个能为 true）
      const fullscreen = settings.fullscreen || false;
      const maximized = settings.maximized || false;
      
      _currentSettings['window-fullscreen'] = fullscreen;
      _currentSettings['window-maximized'] = maximized;
      
      // 直接设置 checkbox 的 checked 状态
      const fsEl = document.getElementById('s-window-fullscreen');
      const maxEl = document.getElementById('s-window-maximized');
      
      if (fsEl) fsEl.checked = fullscreen;
      if (maxEl) maxEl.checked = maximized;
    }
  } catch (err) {
    console.log('读取窗口设置失败:', err);
  }
}

async function initSettingsPage() {
  // 先从文件加载窗口设置（这会更新 _currentSettings 中的宽高值）
  await loadWindowSettingsFromFile();
  
  // 然后同步所有控件的值到 UI
  for (const key in _currentSettings) {
    updateControlDisplay(key, _currentSettings[key]);
  }
}

// 最大化窗口开关变化（与全屏模式互斥）
async function onMaximizedChange(checked) {
  _currentSettings['window-maximized'] = checked;
  
  // 如果开启最大化，关闭全屏模式
  if (checked) {
    _currentSettings['window-fullscreen'] = false;
    const fsEl = document.getElementById('s-window-fullscreen');
    if (fsEl) fsEl.checked = false;
  }
  
  // 立即保存到文件
  await saveWindowSettings();
  
  // 调试：确认保存的值
  console.log('最大化开关变化:', {maximized: checked, fullscreen: _currentSettings['window-fullscreen']});
}

// 全屏模式开关变化（与最大化窗口互斥）
async function onFullscreenChange(checked) {
  _currentSettings['window-fullscreen'] = checked;
  
  // 如果开启全屏，关闭最大化窗口
  if (checked) {
    _currentSettings['window-maximized'] = false;
    const maxEl = document.getElementById('s-window-maximized');
    if (maxEl) maxEl.checked = false;
  }
  
  // 立即保存到文件
  await saveWindowSettings();
  
  // 调试：确认保存的值
  console.log('全屏开关变化:', {fullscreen: checked, maximized: _currentSettings['window-maximized']});
}

// 保存窗口设置到文件
async function saveWindowSettings() {
  try {
    const settings = {
      width: parseInt(_currentSettings['window-width']) || 1400,
      height: parseInt(_currentSettings['window-height']) || 900,
      fullscreen: _currentSettings['window-fullscreen'] || false,
      maximized: _currentSettings['window-maximized'] || false
    };
    
    console.log('保存窗口设置:', settings);
    
    const result = await post('/api/window/settings', settings);
    if (result.ok) {
      showToast('窗口设置已保存', 'success');
    } else {
      showToast('保存窗口设置失败', 'error');
    }
  } catch (err) {
    console.error('保存窗口设置失败:', err);
    showToast('保存窗口设置失败', 'error');
  }
}

// 应用窗口设置
async function applyWindowSettings() {
  const width = parseInt(_currentSettings['window-width']) || 1400;
  const height = parseInt(_currentSettings['window-height']) || 900;
  const fullscreen = _currentSettings['window-fullscreen'] || false;
  const maximized = _currentSettings['window-maximized'] || false;

  try {
    // 调用后端 API 设置窗口大小
    const result = await post('/api/window/settings', {
      width: width,
      height: height,
      fullscreen: fullscreen,
      maximized: maximized
    });

    if (result.ok) {
      showToast('窗口设置已保存，重启程序后生效', 'success');
    } else {
      showToast('设置失败：' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('设置失败：' + err.message, 'error');
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

// ── 清理业务数据 ─────────────────────────────────────────

async function showCleanDataModal() {
  // 加载员工列表，用于成员选择器
  let employees = [];
  try { employees = await get('/api/employees'); } catch (e) { employees = []; }

  const empOptions = employees.map(e =>
    `<option value="${e.id}">${escHtml(e.name)}（${escHtml(e.sub_dept_name || '')}）</option>`
  ).join('');

  // 当前年月，供默认值
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const monthOpts = Array.from({length:12}, (_,i) =>
    `<option value="${i+1}"${i+1===curMonth?' selected':''}>${i+1}</option>`
  ).join('');

  openModal(`
    <div class="modal-title">清理业务数据</div>

    <!-- 清理模式 -->
    <div style="margin-bottom:14px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">选择清理范围</div>
      <div style="display:flex;flex-direction:column;gap:7px;" id="cleanModeGroup">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);transition:border-color .15s;">
          <input type="radio" name="cleanMode" value="emp" style="accent-color:var(--primary)" onchange="_onCleanModeChange()">
          <span style="font-size:13px;">指定成员的所有月份数据</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);transition:border-color .15s;">
          <input type="radio" name="cleanMode" value="ym" style="accent-color:var(--primary)" onchange="_onCleanModeChange()">
          <span style="font-size:13px;">指定年月的所有成员数据</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);transition:border-color .15s;">
          <input type="radio" name="cleanMode" value="empym" style="accent-color:var(--primary)" onchange="_onCleanModeChange()">
          <span style="font-size:13px;">指定成员 × 指定年月</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);transition:border-color .15s;">
          <input type="radio" name="cleanMode" value="all" style="accent-color:var(--primary)" onchange="_onCleanModeChange()">
          <span style="font-size:13px;font-weight:600;color:#ef4444;">清空所有业务数据</span>
        </label>
      </div>
    </div>

    <!-- 成员选择器 -->
    <div id="cleanEmpRow" style="display:none;margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">选择成员</div>
      <select id="cleanEmpSel" style="width:100%;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card-bg);color:var(--text);">
        <option value="">-- 请选择成员 --</option>
        ${empOptions}
      </select>
    </div>

    <!-- 年月选择器 -->
    <div id="cleanYmRow" style="display:none;margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">选择年月</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="number" id="cleanYear" value="${curYear}" min="2000" max="2099"
          style="width:90px;padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card-bg);color:var(--text);text-align:center;">
        <span style="color:var(--text-muted);font-size:13px;">年</span>
        <select id="cleanMonth" style="width:70px;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card-bg);color:var(--text);">
          ${monthOpts}
        </select>
        <span style="color:var(--text-muted);font-size:13px;">月</span>
      </div>
    </div>

    <!-- 提示区 -->
    <div id="cleanHint" style="display:none;padding:10px 12px;border-radius:var(--radius);font-size:12px;margin-bottom:12px;"></div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" id="confirmCleanBtn" disabled onclick="doCleanData()">确认清理</button>
    </div>
  `);
}

function _onCleanModeChange() {
  const mode = document.querySelector('input[name="cleanMode"]:checked')?.value;
  const empRow = document.getElementById('cleanEmpRow');
  const ymRow = document.getElementById('cleanYmRow');
  const hint = document.getElementById('cleanHint');
  const btn = document.getElementById('confirmCleanBtn');

  empRow.style.display = (mode === 'emp' || mode === 'empym') ? 'block' : 'none';
  ymRow.style.display  = (mode === 'ym'  || mode === 'empym') ? 'block' : 'none';

  // 提示文案
  const hintMap = {
    emp:   { bg: '#fef3c7', color: '#92400e', text: '将删除该成员所有月份的做货记录和工资增扣，不可恢复。' },
    ym:    { bg: '#fef3c7', color: '#92400e', text: '将删除指定年月内所有人的做货记录、工资增扣及快捷计算保存，不可恢复。' },
    empym: { bg: '#fef3c7', color: '#92400e', text: '将删除该成员在指定年月的做货记录和工资增扣，不可恢复。' },
    all:   { bg: '#fee2e2', color: '#991b1b', text: '⚠ 将删除所有成员所有月份的做货记录、工资增扣及快捷计算保存！此操作不可恢复，请谨慎操作！' }
  };
  if (mode && hintMap[mode]) {
    const h = hintMap[mode];
    hint.style.display = 'block';
    hint.style.background = h.bg;
    hint.style.color = h.color;
    hint.textContent = h.text;
  } else {
    hint.style.display = 'none';
  }

  btn.disabled = !mode;
}

async function doCleanData() {
  const mode = document.querySelector('input[name="cleanMode"]:checked')?.value;
  if (!mode) return;

  const empId = (mode === 'emp' || mode === 'empym') ? document.getElementById('cleanEmpSel').value : null;
  const year  = (mode === 'ym'  || mode === 'empym') ? document.getElementById('cleanYear').value  : null;
  const month = (mode === 'ym'  || mode === 'empym') ? document.getElementById('cleanMonth').value : null;

  // 验证
  if ((mode === 'emp' || mode === 'empym') && !empId) {
    showToast('请先选择成员', 'error'); return;
  }
  if ((mode === 'ym' || mode === 'empym') && (!year || !month)) {
    showToast('请填写年份和月份', 'error'); return;
  }

  // 二次确认
  let confirmMsg = '';
  if (mode === 'all') {
    confirmMsg = '您确定要清空所有业务数据吗？此操作不可撤销！';
  } else {
    const empName = empId ? document.getElementById('cleanEmpSel').options[document.getElementById('cleanEmpSel').selectedIndex].text : '';
    const ymStr = (year && month) ? `${year}年${month}月` : '';
    if (mode === 'emp')   confirmMsg = `确定删除【${empName}】的所有做货数据吗？`;
    if (mode === 'ym')    confirmMsg = `确定删除【${ymStr}】的所有业务数据吗？`;
    if (mode === 'empym') confirmMsg = `确定删除【${empName}】在【${ymStr}】的做货数据吗？`;
  }

  if (!confirm(confirmMsg)) return;

  // 构造查询参数
  const params = new URLSearchParams();
  if (empId) params.append('emp_id', empId);
  if (year)  params.append('year',   year);
  if (month) params.append('month',  month);

  try {
    const res = await fetch(`/api/data/clean?${params.toString()}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      closeModal();
      showToast('数据清理完成', 'success');
    } else {
      showToast('清理失败：' + (data.error || '未知错误'), 'error');
    }
  } catch (e) {
    showToast('请求失败：' + e.message, 'error');
  }
}
