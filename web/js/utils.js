// ============================================================
// 工具函数
// ============================================================
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function roundNumber(n, digits = 2) {
  const value = Number(n) || 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function fmt(n) {
  if (n == null) return '0.00';
  return roundNumber(n).toFixed(2);
}
// 紧凑数字格式：用于工资显示，避免列宽溢出
// < 10000: ¥1234.56  |  >= 10000: ¥1.2万  |  >= 100000: ¥10.1万  |  >= 1000000: ¥100.0万
function fmtCompact(n) {
  if (n == null || n === 0) return '';
  n = roundNumber(n);
  const abs = Math.abs(n);
  if (abs < 10000) return '¥' + n.toFixed(2);
  if (abs < 1000000) return '¥' + (n / 10000).toFixed(1) + '万';
  return '¥' + (n / 10000).toFixed(1) + '万';
}
function pad(n) { return String(n).padStart(2, '0'); }

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:10px 20px;border-radius:8px;font-size:var(--font-size-13);z-index:9999;animation:slideIn 0.3s ease;background:${type==='success'?'#22c55e':type==='error'?'#ef4444':'#3b82f6'};color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>document.body.removeChild(toast), 300); }, 2000);
}

function adjustColor(hex, amount, lighten = false) {
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const num = parseInt(color, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  if (lighten) {
    r = Math.min(255, r);
    g = Math.min(255, g);
    b = Math.min(255, b);
  } else {
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
  }
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function animateElementEntrance(el, className = 'content-fade-in', duration = 220) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function beginContentRefresh(container, options = {}) {
  if (!container) return () => {};

  const loadingText = options.loadingText || '加载中...';
  const minHeight = options.minHeight || 120;
  const allowEntrance = options.allowEntrance !== false;
  const prevPosition = container.style.position;
  const prevMinHeight = container.style.minHeight;
  const rect = container.getBoundingClientRect();
  const targetHeight = Math.max(Math.ceil(rect.height || 0), minHeight);
  const existingText = (container.textContent || '').trim();
  const hasContent = container.children.length > 0 && existingText && !existingText.includes('加载中');

  if (!hasContent) {
    return () => {
      if (allowEntrance) animateElementEntrance(container, 'content-fade-in-soft', 180);
    };
  }

  if (!container.style.position) container.style.position = 'relative';
  container.style.minHeight = `${targetHeight}px`;
  container.classList.add('content-refreshing');

  let overlay = container.querySelector('.content-refresh-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'content-refresh-overlay';
    container.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="content-refresh-spinner" aria-hidden="true"></div>
    <div class="content-refresh-text">${escHtml(loadingText)}</div>
  `;

  requestAnimationFrame(() => overlay.classList.add('show'));

  return () => {
    overlay.classList.remove('show');
    container.classList.remove('content-refreshing');
    setTimeout(() => {
      if (overlay.parentNode === container) overlay.remove();
      container.style.minHeight = prevMinHeight;
      container.style.position = prevPosition;
      if (allowEntrance) animateElementEntrance(container);
    }, 160);
  };
}

function beginButtonLoading(button, loadingText = '处理中...') {
  if (!button) return () => {};

  const previousHtml = button.innerHTML;
  const previousDisabled = button.disabled;
  const previousWidth = button.style.width;
  const rect = button.getBoundingClientRect();
  if (rect.width) button.style.width = `${Math.ceil(rect.width)}px`;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-loading');
  button.innerHTML = `<span class="btn-loading-spinner" aria-hidden="true"></span>${escHtml(loadingText)}`;

  return () => {
    button.innerHTML = previousHtml;
    button.disabled = previousDisabled;
    button.style.width = previousWidth;
    button.removeAttribute('aria-busy');
    button.classList.remove('is-loading');
  };
}
