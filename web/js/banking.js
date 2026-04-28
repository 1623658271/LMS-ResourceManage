// ============================================================
// 银行卡管理
// ============================================================

const ALIPAY_WEB_URL = 'https://www.alipay.com/';
let _bankAccountRows = [];

function getBankSalarySource() {
  return localStorage.getItem('useQcSalary') === 'true' ? 'qc' : 'work';
}

function getBankSalarySourceLabel(source) {
  return source === 'qc' ? '快捷计算数据' : '做货编辑数据';
}

function getBankAccountRow(empId) {
  return (_bankAccountRows || []).find(item => item.emp_id === empId) || null;
}

function maskBankCard(cardNo) {
  const clean = String(cardNo || '').replace(/\s+/g, '');
  if (!clean) return '未填写银行卡';
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

function getBankTargetMonth() {
  const year = parseInt(document.getElementById('bankYear')?.value, 10);
  const month = parseInt(document.getElementById('bankMonth')?.value, 10);
  const today = new Date();
  return {
    year: year || today.getFullYear(),
    month: month || (today.getMonth() + 1),
  };
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (copyErr) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }
}

function buildTransferSummary(item, amount, note, year, month, source) {
  const lines = [
    `成员：${item.name || ''}`,
    `收款人：${item.account_name || item.name || ''}`,
    `开户行：${item.bank_name || ''}`,
    `银行卡号：${item.card_no || ''}`,
    `打款金额：${Number(amount || 0).toFixed(2)}`,
    `工资月份：${year}-${pad(month)}`,
    `工资数据源：${getBankSalarySourceLabel(source)}`,
  ];
  if (item.reserved_phone) lines.push(`预留手机：${item.reserved_phone}`);
  if (note) lines.push(`备注：${note}`);
  return lines.join('\n');
}

async function copyBankModalField(inputId, label) {
  const el = document.getElementById(inputId);
  const text = el ? el.value : '';
  if (!text) {
    showToast(`暂无可复制的${label}`, 'info');
    return;
  }
  const ok = await copyTextToClipboard(text);
  showToast(ok ? `${label}已复制` : `${label}复制失败`, ok ? 'success' : 'error');
}

function renderBankCards(rows, year, month, source) {
  const container = document.getElementById('bankingContent');
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">暂无成员数据</div>';
    return;
  }

  container.innerHTML = rows.map(item => `
    <div class="bank-card">
      <div class="bank-card-header">
        <div>
          <div class="bank-card-title">
            <span class="member-list-name-color" onclick="navigateToMemberDetail(${item.emp_id})" title="点击查看成员详情">${escHtml(item.name)}</span>
            <span class="bank-source-pill">${getBankSalarySourceLabel(source)}</span>
          </div>
          <div class="bank-card-meta">
            <span class="dept-large">${escHtml(item.dept_name)}</span>
            <span class="dept-sub">/ ${escHtml(item.sub_dept_name)}</span>
          </div>
        </div>
        <div class="bank-card-amount">
          <div class="bank-card-amount-label">${year}-${pad(month)} 应打金额</div>
          <div class="bank-card-amount-value">¥${fmt(item.total || 0)}</div>
        </div>
      </div>
      <div class="bank-card-body">
        <div class="bank-info-grid">
          <div class="bank-info-item">
            <span class="bank-info-label">收款人</span>
            <span class="bank-info-value">${escHtml(item.account_name || item.name || '-')}</span>
          </div>
          <div class="bank-info-item">
            <span class="bank-info-label">开户行</span>
            <span class="bank-info-value">${escHtml(item.bank_name || '未填写')}</span>
          </div>
          <div class="bank-info-item">
            <span class="bank-info-label">银行卡号</span>
            <span class="bank-info-value bank-card-no">${escHtml(maskBankCard(item.card_no))}</span>
          </div>
          <div class="bank-info-item">
            <span class="bank-info-label">预留手机</span>
            <span class="bank-info-value">${escHtml(item.reserved_phone || '未填写')}</span>
          </div>
        </div>
        ${item.note ? `<div class="bank-note">备注：${escHtml(item.note)}</div>` : ''}
        <div class="bank-stats">
          <div class="bank-stat">
            <span class="bank-stat-label">做货对数</span>
            <span class="bank-stat-value">${fmt(item.pairs || 0)}</span>
          </div>
          <div class="bank-stat">
            <span class="bank-stat-label">做货工资</span>
            <span class="bank-stat-value">¥${fmt(item.wage || 0)}</span>
          </div>
          <div class="bank-stat">
            <span class="bank-stat-label">人工增扣</span>
            <span class="bank-stat-value bank-stat-warn">¥${fmt(item.adj_amount || 0)}</span>
          </div>
        </div>
      </div>
      <div class="bank-actions">
        <button class="btn btn-sm btn-secondary" onclick="showEditBankAccountModal(${item.emp_id})">编辑银行卡</button>
        <button class="btn btn-sm btn-primary" onclick="showBankPayoutModal(${item.emp_id})">工资打款</button>
      </div>
    </div>
  `).join('');
}

async function loadBankAccounts() {
  const { year, month } = getBankTargetMonth();
  const source = getBankSalarySource();
  const container = document.getElementById('bankingContent');
  if (!container) return;

  container.innerHTML = '<div class="empty-state">加载中...</div>';
  const data = await get(`/api/bank-accounts?year=${year}&month=${month}&source=${source}`);
  _bankAccountRows = Array.isArray(data) ? data : [];
  renderBankCards(_bankAccountRows, year, month, source);
}

function showEditBankAccountModal(empId) {
  const item = getBankAccountRow(empId);
  if (!item) {
    showToast('未找到该成员的银行卡信息', 'error');
    return;
  }

  openModal(`
    <div class="modal-title">编辑银行卡信息</div>
    <div class="form-row">
      <div class="form-group">
        <label>成员姓名</label>
        <input type="text" value="${escHtml(item.name)}" disabled>
      </div>
      <div class="form-group">
        <label>收款人姓名</label>
        <input id="bank-account-name" type="text" value="${escHtml(item.account_name || item.name || '')}" placeholder="默认使用成员姓名">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>开户行</label>
        <input id="bank-bank-name" type="text" value="${escHtml(item.bank_name || '')}" placeholder="例如：中国农业银行">
      </div>
      <div class="form-group">
        <label>银行卡号</label>
        <input id="bank-card-no" type="text" value="${escHtml(item.card_no || '')}" placeholder="请输入银行卡号">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>预留手机</label>
        <input id="bank-phone" type="text" value="${escHtml(item.reserved_phone || '')}" placeholder="选填">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input id="bank-note" type="text" value="${escHtml(item.note || '')}" placeholder="选填">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveBankAccount(${empId})">保存</button>
    </div>
  `);
}

async function saveBankAccount(empId) {
  const payload = {
    account_name: document.getElementById('bank-account-name')?.value.trim() || '',
    bank_name: document.getElementById('bank-bank-name')?.value.trim() || '',
    card_no: document.getElementById('bank-card-no')?.value.trim() || '',
    reserved_phone: document.getElementById('bank-phone')?.value.trim() || '',
    note: document.getElementById('bank-note')?.value.trim() || '',
  };

  const result = await post(`/api/bank-accounts/${empId}`, payload);
  if (result && result.ok) {
    closeModal();
    showToast('银行卡信息已保存', 'success');
    loadBankAccounts();
  } else {
    showToast((result && result.error) || '保存失败', 'error');
  }
}

function showBankPayoutModal(empId) {
  const item = getBankAccountRow(empId);
  if (!item) {
    showToast('未找到该成员', 'error');
    return;
  }

  const { year, month } = getBankTargetMonth();
  const source = getBankSalarySource();
  const amount = Number(item.total || 0).toFixed(2);

  openModal(`
    <div class="modal-title">工资打款辅助</div>
    <div class="bank-pay-tip">
      将复制打款信息并打开支付宝网页。为了稳定和免接口使用，最终付款仍需你在支付宝里手动确认完成。
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>成员姓名</label>
        <input type="text" value="${escHtml(item.name)}" disabled>
      </div>
      <div class="form-group">
        <label>工资月份 / 数据源</label>
        <input type="text" value="${year}-${pad(month)} / ${escHtml(getBankSalarySourceLabel(source))}" disabled>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>收款人姓名</label>
        <input id="pay-account-name" type="text" value="${escHtml(item.account_name || item.name || '')}">
      </div>
      <div class="form-group">
        <label>开户行</label>
        <input id="pay-bank-name" type="text" value="${escHtml(item.bank_name || '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>银行卡号</label>
        <input id="pay-card-no" type="text" value="${escHtml(item.card_no || '')}">
      </div>
      <div class="form-group">
        <label>打款金额</label>
        <input id="pay-amount" type="number" step="0.01" value="${amount}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>预留手机</label>
        <input id="pay-phone" type="text" value="${escHtml(item.reserved_phone || '')}" placeholder="选填">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input id="pay-note" type="text" value="${escHtml(item.note || '')}" placeholder="例如：${year}-${pad(month)} 工资">
      </div>
    </div>
    <div class="bank-copy-actions">
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-account-name', '收款人姓名')">复制姓名</button>
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-card-no', '银行卡号')">复制卡号</button>
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-amount', '打款金额')">复制金额</button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="openAlipayForPayout(${empId}, ${year}, ${month}, '${source}')">复制信息并打开支付宝</button>
    </div>
  `);
}

async function openAlipayForPayout(empId, year, month, source) {
  const item = getBankAccountRow(empId);
  if (!item) {
    showToast('未找到该成员', 'error');
    return;
  }

  const accountName = document.getElementById('pay-account-name')?.value.trim() || '';
  const bankName = document.getElementById('pay-bank-name')?.value.trim() || '';
  const cardNo = document.getElementById('pay-card-no')?.value.trim() || '';
  const phone = document.getElementById('pay-phone')?.value.trim() || '';
  const note = document.getElementById('pay-note')?.value.trim() || '';
  const amount = parseFloat(document.getElementById('pay-amount')?.value || '0');

  if (!accountName || !bankName || !cardNo) {
    showToast('请先补全收款人、开户行和银行卡号', 'error');
    return;
  }

  if (!Number.isFinite(amount)) {
    showToast('请输入有效的打款金额', 'error');
    return;
  }

  if (amount < 0) {
    showToast('打款金额不能小于 0', 'error');
    return;
  }

  const transferInfo = buildTransferSummary(
    {
      ...item,
      account_name: accountName,
      bank_name: bankName,
      card_no: cardNo,
      reserved_phone: phone,
    },
    amount,
    note,
    year,
    month,
    source
  );

  const copied = await copyTextToClipboard(transferInfo);

  let opened = false;
  try {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.open_external_url === 'function') {
      opened = await window.pywebview.api.open_external_url(ALIPAY_WEB_URL);
    } else {
      const win = window.open(ALIPAY_WEB_URL, '_blank', 'noopener');
      opened = !!win;
    }
  } catch (err) {
    const win = window.open(ALIPAY_WEB_URL, '_blank', 'noopener');
    opened = !!win;
  }

  closeModal();
  if (!opened) {
    showToast('未能自动打开支付宝网页，请手动打开支付宝官网', 'error');
    return;
  }

  if (copied) {
    showToast('已复制打款信息并打开支付宝网页', 'success');
  } else {
    showToast('已打开支付宝网页，请手动复制打款信息', 'info');
  }
}

const _bankYearEl = document.getElementById('bankYear');
const _bankMonthEl = document.getElementById('bankMonth');
if (_bankYearEl) _bankYearEl.addEventListener('change', loadBankAccounts);
if (_bankMonthEl) _bankMonthEl.addEventListener('change', loadBankAccounts);
