// ============================================================
// 工具函数
// ============================================================
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  return Number(n).toFixed(2);
}
// 紧凑数字格式：用于工资显示，避免列宽溢出
// < 10000: ¥1234.56  |  >= 10000: ¥1.2万  |  >= 100000: ¥10.1万  |  >= 1000000: ¥100.0万
function fmtCompact(n) {
  if (n == null || n === 0) return '';
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
