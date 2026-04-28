// ============================================================
// 银行卡管理
// ============================================================

const ALIPAY_WEB_URL = 'https://shenghuo.alipay.com/transfercore/fill.htm?_tosheet=true&_pdType=afcabecbcahiibffiiih';
let _bankAccountRows = [];
const _bankAutoSaveTimers = {};

function getBankSalarySource() {
  return localStorage.getItem('useQcSalary') === 'true' ? 'qc' : 'work';
}

function getBankSalarySourceLabel(source) {
  return source === 'qc' ? '快捷计算数据' : '做货编辑数据';
}

function getBankAccountRow(empId) {
  return (_bankAccountRows || []).find(item => item.emp_id === empId) || null;
}

function getBankDefaultNote(year, month) {
  return `${year}-${pad(month)}-工资`;
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

function updateBankRowCache(empId, payload) {
  const row = getBankAccountRow(empId);
  if (!row) return;
  row.account_name = payload.account_name;
  row.bank_name = payload.bank_name;
  row.card_no = payload.card_no;
  row.note = payload.note;
  row.reserved_phone = payload.reserved_phone;
}

function setBankAutoSaveHint(text, type = 'info') {
  const hint = document.getElementById('bank-auto-save-hint');
  if (!hint) return;
  hint.textContent = text;
  hint.style.color = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--text-muted)';
}

function buildModalBankPayload(empId, year, month) {
  const item = getBankAccountRow(empId) || {};
  return {
    account_name: (document.getElementById('bank-account-name')?.value || item.account_name || item.name || '').trim(),
    bank_name: (document.getElementById('bank-bank-name')?.value || item.bank_name || '').trim(),
    card_no: (document.getElementById('bank-card-no')?.value || item.card_no || '').trim(),
    reserved_phone: (document.getElementById('bank-phone')?.value || item.reserved_phone || '').trim(),
    note: (document.getElementById('bank-note')?.value || item.note || getBankDefaultNote(year, month)).trim(),
  };
}

async function autoSaveBankAccount(empId, year, month, options = {}) {
  const { silent = true } = options;
  const payload = buildModalBankPayload(empId, year, month);
  setBankAutoSaveHint('正在自动保存...', 'info');
  const result = await post(`/api/bank-accounts/${empId}`, payload);
  if (result && result.ok) {
    updateBankRowCache(empId, payload);
    setBankAutoSaveHint('已自动保存', 'success');
    if (!silent) showToast('银行卡信息已保存', 'success');
  } else {
    setBankAutoSaveHint((result && result.error) || '自动保存失败', 'error');
    if (!silent) showToast((result && result.error) || '保存失败', 'error');
  }
}

function queueAutoSaveBankAccount(empId, year, month) {
  if (_bankAutoSaveTimers[empId]) clearTimeout(_bankAutoSaveTimers[empId]);
  setBankAutoSaveHint('检测到修改，准备自动保存...', 'info');
  _bankAutoSaveTimers[empId] = setTimeout(() => {
    autoSaveBankAccount(empId, year, month);
  }, 500);
}

function showEditBankAccountModal(empId) {
  const item = getBankAccountRow(empId);
  if (!item) {
    showToast('未找到该成员的银行卡信息', 'error');
    return;
  }

  const { year, month } = getBankTargetMonth();
  openModal(`
    <div class="modal-title">编辑银行卡信息</div>
    <div class="form-row">
      <div class="form-group">
        <label>成员姓名</label>
        <input type="text" value="${escHtml(item.name)}" disabled>
      </div>
      <div class="form-group">
        <label>收款人姓名</label>
        <input id="bank-account-name" type="text" value="${escHtml(item.account_name || item.name || '')}" placeholder="默认使用成员姓名" oninput="queueAutoSaveBankAccount(${empId}, ${year}, ${month})">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>开户行</label>
        <input id="bank-bank-name" type="text" value="${escHtml(item.bank_name || '')}" placeholder="例如：中国农业银行" oninput="queueAutoSaveBankAccount(${empId}, ${year}, ${month})">
      </div>
      <div class="form-group">
        <label>银行卡号</label>
        <input id="bank-card-no" type="text" value="${escHtml(item.card_no || '')}" placeholder="请输入银行卡号" oninput="queueAutoSaveBankAccount(${empId}, ${year}, ${month})">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>预留手机</label>
        <input id="bank-phone" type="text" value="${escHtml(item.reserved_phone || '')}" placeholder="选填" oninput="queueAutoSaveBankAccount(${empId}, ${year}, ${month})">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input id="bank-note" type="text" value="${escHtml(item.note || getBankDefaultNote(year, month))}" placeholder="默认日期-工资" oninput="queueAutoSaveBankAccount(${empId}, ${year}, ${month})">
      </div>
    </div>
    <div id="bank-auto-save-hint" class="bank-auto-save-hint">修改后将自动保存</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal(); loadBankAccounts();">关闭</button>
    </div>
  `);
}

async function lookupBankName(empId, options = {}) {
  const { silent = false } = options;
  const item = getBankAccountRow(empId);
  const cardNo = (item?.card_no || '').trim();
  if (!cardNo) {
    if (!silent) showToast('该成员还没有保存银行卡号', 'info');
    return { ok: false };
  }

  const result = await get(`/api/bank-lookup?card_no=${encodeURIComponent(cardNo)}`);
  if (result && result.ok) {
    const payload = {
      account_name: item.account_name || item.name || '',
      bank_name: result.bank_name || result.bank_code || '',
      card_no: item.card_no || '',
      reserved_phone: item.reserved_phone || '',
      note: item.note || '',
    };
    const saveResult = await post(`/api/bank-accounts/${empId}`, payload);
    if (saveResult && saveResult.ok) {
      updateBankRowCache(empId, payload);
      if (!silent) showToast(`已识别开户行：${payload.bank_name}`, 'success');
      return { ok: true, bank_name: payload.bank_name };
    }
    if (!silent) showToast((saveResult && saveResult.error) || '开户行保存失败', 'error');
    return { ok: false, error: (saveResult && saveResult.error) || '开户行保存失败' };
  } else {
    if (!silent) showToast((result && result.error) || '开户行查询失败', 'error');
    return { ok: false, error: (result && result.error) || '开户行查询失败' };
  }
}

async function bulkLookupBankNames() {
  const rows = (_bankAccountRows || []).filter(item => (item.card_no || '').trim());
  if (!rows.length) {
    showToast('暂无可更新开户行的银行卡号', 'info');
    return;
  }

  let success = 0;
  let failed = 0;
  showToast(`开始更新 ${rows.length} 条开户行信息`, 'info');
  for (const row of rows) {
    const result = await lookupBankName(row.emp_id, { silent: true });
    if (result && result.ok) success += 1;
    else failed += 1;
  }
  await loadBankAccounts();
  showToast(`开户行更新完成：成功 ${success} 条，失败 ${failed} 条`, failed ? 'info' : 'success');
}

function showBankPayoutModal(empId) {
  const item = getBankAccountRow(empId);
  if (!item) {
    showToast('未找到该成员', 'error');
    return;
  }

  const { year, month } = getBankTargetMonth();
  const source = getBankSalarySource();
  const amount = fmt(item.total || 0);
  const accountName = item.account_name || item.name || '';
  const bankName = item.bank_name || '';
  const cardNo = item.card_no || '';
  const note = item.note || getBankDefaultNote(year, month);

  openModal(`
    <div class="modal-title">工资打款辅助</div>
    <div class="bank-pay-tip">
      将直接打开你电脑的默认浏览器，并按支付宝转账页的表单元素自动填写银行、卡号、开户人、金额和付款说明，方便复用你平时已经登录好的支付宝。自动填写时请暂时不要操作鼠标和键盘，最终付款仍需你手动确认。
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
        <input id="pay-account-name" type="text" value="${escHtml(accountName)}">
      </div>
      <div class="form-group">
        <label>开户行</label>
        <input id="pay-bank-name" type="text" value="${escHtml(bankName)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>银行卡号</label>
        <input id="pay-card-no" type="text" value="${escHtml(cardNo)}">
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
        <input id="pay-note" type="text" value="${escHtml(note)}" placeholder="例如：${year}-${pad(month)}-工资">
      </div>
    </div>
    <div class="bank-copy-actions">
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-account-name', '收款人姓名')">复制姓名</button>
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-card-no', '银行卡号')">复制卡号</button>
      <button class="btn btn-sm btn-secondary" onclick="copyBankModalField('pay-amount', '打款金额')">复制金额</button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="openAlipayForPayout(${empId}, ${year}, ${month}, '${source}')">自动填表并打开支付宝</button>
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
  const payload = {
    emp_id: empId,
    year,
    month,
    source,
    account_name: accountName,
    bank_name: bankName,
    card_no: cardNo,
    reserved_phone: phone,
    note,
    amount,
  };

  const result = await post('/api/alipay-transfer/autofill', payload);
  closeModal();

  if (result && result.ok) {
    showToast(result.message || '已自动填写支付宝表单', 'success');
    return;
  }

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

  if (opened) {
    showToast((result && result.error) ? `${result.error}，已回退到手动页面` : '已打开支付宝页面，请手动填写', 'info');
  } else {
    showToast((result && result.error) || '未能自动打开支付宝页面', 'error');
  }

  if (!copied) {
    showToast('自动填表失败时，打款信息复制也失败了', 'error');
  }
}

const _bankYearEl = document.getElementById('bankYear');
const _bankMonthEl = document.getElementById('bankMonth');
if (_bankYearEl) _bankYearEl.addEventListener('change', loadBankAccounts);
if (_bankMonthEl) _bankMonthEl.addEventListener('change', loadBankAccounts);
