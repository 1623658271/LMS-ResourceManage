// ============================================================
// 月份选择器
// ============================================================
function buildMonthPickers(ids, yearIds) {
  const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
  (yearIds || ids).forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '';
    for (let i = y - 2; i <= y + 1; i++)
      el.innerHTML += `<option value="${i}"${i === y ? ' selected' : ''}>${i}</option>`;
  });
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '';
    for (let i = 1; i <= 12; i++)
      el.innerHTML += `<option value="${i}"${i === m ? ' selected' : ''}>${pad(i)}</option>`;
  });
}
function initMonthPickers() {
  buildMonthPickers(['memberMonth','workMonth','salaryMonth','orderMonth','qcMonth'],
                    ['memberYear','workYear','salaryYear','orderYear','qcYear']);
}

// ============================================================
// 导航
// ============================================================
function navigateTo(view) {
  // 离开做货编辑页面时自动保存
  if (_currentView === 'work' && view !== 'work') {
    autoSaveWorkRecords();
  }
  // 离开快捷计算页面时自动保存
  if (_currentView === 'quickcalc' && view !== 'quickcalc') {
    autoSaveQc();
  }
  _currentView = view; // 跟踪当前视图
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  const titles = { overview:'资源总览', members:'成员管理', departments:'部门管理',
    orders:'订单管理', prices:'型号单价表', work:'做货编辑', salary:'总工资表', quickcalc:'快捷计算', 'member-detail':'成员详情', settings:'系统设置' };
  document.getElementById('topbarTitle').textContent = titles[view] || view;
  if (view === 'members') loadMembers();
  else if (view === 'departments') loadDepartments();
  else if (view === 'orders') loadOrders();
  else if (view === 'prices') loadPriceTable();
  else if (view === 'work') { _state.viewMode = 'qty'; loadWorkRecords(); }
  else if (view === 'salary') loadSalary();
  else if (view === 'quickcalc') initQuickCalc();
  else if (view === 'settings') initSettingsPage();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.view));
});

// 获取当前视图
function getCurrentView() { return _currentView; }

// 点击员工姓名跳转到详情页
function showEmployeeDetail(empId) {
  navigateToMemberDetail(empId);
}

// ============================================================
// 模态框
// ============================================================
function openModal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); }
function closeModalOnOverlay(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

// ============================================================
// 成员详情页
// ============================================================
async function navigateToMemberDetail(empId) {
  _currentView = 'member-detail';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-member-detail').classList.add('active');
  document.getElementById('topbarTitle').textContent = '成员详情';
  await loadMemberDetail(empId);
}

async function loadMemberDetail(empId) {
  const header = document.getElementById('mdHeader');
  const content = document.getElementById('mdContent');
  header.innerHTML = `<span>成员详情</span><button class="btn btn-sm btn-secondary" onclick="navigateTo('members')">← 返回成员列表</button>`;
  content.innerHTML = '<div class="empty-state">加载中…</div>';

  const source = localStorage.getItem('useQcSalary') === 'true' ? 'qc' : 'work';
  const data = await get(`/api/employees/${empId}/work-history?source=${source}`);
  if (!data) { content.innerHTML = '<div class="empty-state">未找到该成员</div>'; return; }

  const emp = data.employee;
  const history = data.history;

  // 汇总所有记录
  const totalWage = history.reduce((s, h) => s + h.month_wage, 0);
  const totalPairs = history.reduce((s, h) => s + h.total_pairs, 0);
  const totalAdj = history.reduce((s, h) => s + h.adj_amount, 0);
  const totalAll = history.reduce((s, h) => s + h.total, 0);

  // 汇总卡片
  const summaryCard = `
  <div class="md-summary-card">
    <div class="md-summary-info">
      <div class="md-summary-name">${escHtml(emp.name)}</div>
      <div class="md-summary-meta">
        <span class="member-gender-badge">${emp.gender === '女' ? '♀' : '♂'}</span>
        &nbsp;
        <span class="dept-large">${escHtml(emp.dept_name)}</span>
        <span class="dept-sub">/ ${escHtml(emp.sub_dept_name)}</span>
        &nbsp;|&nbsp;
        共 ${history.length} 个月有做货记录
      </div>
    </div>
    <div class="md-summary-stats">
      <div class="md-summary-stat">
        <div class="md-summary-stat-val orange">${totalPairs}</div>
        <div class="md-summary-stat-label">累计做货对数</div>
      </div>
      <div class="md-summary-stat">
        <div class="md-summary-stat-val">¥${fmt(totalWage)}</div>
        <div class="md-summary-stat-label">累计做货工资</div>
      </div>
      <div class="md-summary-stat">
        <div class="md-summary-stat-val orange">¥${fmt(totalAdj)}</div>
        <div class="md-summary-stat-label">累计人工增扣</div>
      </div>
      <div class="md-summary-stat">
        <div class="md-summary-stat-val green">¥${fmt(totalAll)}</div>
        <div class="md-summary-stat-label">累计总收入</div>
      </div>
    </div>
  </div>`;

  // 月份历史记录
  let historyHtml = '';
  if (!history.length) {
    historyHtml = '<div class="md-history-empty">暂无做货记录</div>';
  } else {
    historyHtml = history.map(m => {
      const recs = m.records;
      let recRows = '';
      if (!recs || !recs.length) {
        recRows = '<tr class="md-no-records"><td colspan="5">暂无做货明细</td></tr>';
      } else {
        recRows = recs.map(r => `
          <tr>
            <td>${escHtml(r.order_no || '—')}</td>
            <td>${escHtml(r.model_no || '—')}</td>
            <td style="text-align:right;">${r.quantity}</td>
            <td style="text-align:right;">¥${fmt(r.unit_price || 0)}</td>
            <td style="text-align:right; font-weight:600;">¥${fmt(r.line_wage || 0)}</td>
          </tr>`).join('');
      }
      const adjRow = m.adj_amount !== 0
        ? `<tr style="background:#fef9c3;">
            <td colspan="4" style="color:#92400e;">📌 人工增扣：${escHtml(m.adj_reason || '')}</td>
            <td style="text-align:right; color:#92400e; font-weight:600;">¥${fmt(m.adj_amount)}</td>
          </tr>` : '';
      return `
      <div class="md-month-block">
        <div class="md-month-header">
          <span>${m.year} 年 ${pad(m.month)} 月</span>
          <div class="md-month-totals">
            <span>做货对数：<b>${m.total_pairs}</b></span>
            <span>做货工资：<b style="color:var(--primary);">¥${fmt(m.month_wage)}</b></span>
            ${m.adj_amount !== 0 ? `<span>增扣：<b style="color:#d97706;">¥${fmt(m.adj_amount)}</b></span>` : ''}
            <span>本月合计：<b style="color:var(--success);">¥${fmt(m.total)}</b></span>
          </div>
        </div>
        <table class="md-records-table">
          <thead><tr><th>订单号</th><th>型号</th><th style="text-align:right;">做货对数</th><th style="text-align:right;">单价</th><th style="text-align:right;">工资</th></tr></thead>
          <tbody>${recRows}${adjRow}</tbody>
        </table>
      </div>`;
    }).join('');
  }

  content.innerHTML = summaryCard + `<div class="md-history-section">${historyHtml}</div>`;
}
