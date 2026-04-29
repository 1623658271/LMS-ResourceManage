// ============================================================
// 总工资表
// ============================================================

function getSalarySource() {
  return localStorage.getItem('useQcSalary') === 'true' ? 'qc' : 'work';
}

function getSalarySourceLabel(source) {
  return source === 'qc' ? '快捷计算数据' : '做货编辑数据';
}

async function loadSalary(options = {}) {
  const { animate = true } = options;
  const year = parseInt(document.getElementById('salaryYear').value, 10);
  const month = parseInt(document.getElementById('salaryMonth').value, 10);
  const source = getSalarySource();
  const content = document.getElementById('salaryContent');
  const queryBtn = document.getElementById('salaryQueryBtn');
  const sourceLabel = source === 'qc' ? '（快捷计算）' : '';
  const finishButton = animate
    ? beginButtonLoading(queryBtn, '正在查询...')
    : () => {};
  const finishRefresh = animate
    ? beginContentRefresh(content, {
        loadingText: `正在刷新 ${year}-${pad(month)} 工资汇总...`,
        minHeight: 240,
      })
    : () => {};

  try {
    const data = await get(`/api/salary-summary?year=${year}&month=${month}&source=${source}`);

    if (!data || !data.length) {
      content.innerHTML = '<div class="empty-state">暂无工资数据</div>';
      return;
    }

    const grandTotalWage = data.reduce((sum, dept) => sum + dept.total_wage, 0);
    const grandTotalPairs = data.reduce((sum, dept) => sum + dept.total_pairs, 0);
    const printedAt = new Date().toLocaleString('zh-CN', { hour12: false });

    let html = `<div class="salary-report">
      <div class="salary-print-header">
        <div>
          <div class="salary-print-title">${year} 年 ${pad(month)} 月总工资汇总表</div>
          <div class="salary-print-meta">数据源：${getSalarySourceLabel(source)}</div>
        </div>
        <div class="salary-print-meta">生成时间：${printedAt}</div>
      </div>
      <div class="grand-total">
        <span>全厂合计${sourceLabel ? ` <span class="qc-badge">${sourceLabel}</span>` : ''}</span>
        <span>对数：<strong>${fmt(grandTotalPairs)}</strong> &nbsp;|&nbsp; 总工资：<strong>¥${fmt(grandTotalWage)}</strong></span>
      </div>`;

    data.forEach(dept => {
      html += `<div class="dept-block">
        <div class="dept-block-header">
          <span><span class="dept-large">${escHtml(dept.dept_name)}</span></span>
          <span class="dept-totals">对数合计：${fmt(dept.total_pairs)} &nbsp;|&nbsp; 部门工资合计：¥${fmt(dept.total_wage)}</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>姓名</th><th>小部门</th><th class="text-right">做货对数</th><th class="text-right">做货工资</th><th class="text-right">人工增扣</th><th class="text-right">总工资</th></tr></thead>
          <tbody>${dept.employees.map(emp => `<tr>
            <td><span class="member-name-color" onclick="navigateToMemberDetail(${emp.emp_id})" title="点击查看详情">${escHtml(emp.name)}</span></td>
            <td><span class="dept-sub">${escHtml(emp.sub_dept_name)}</span></td>
            <td class="text-right table-num">${fmt(emp.pairs)}</td>
            <td class="text-right table-num">¥${fmt(emp.wage)}</td>
            <td class="text-right table-num text-danger">¥${fmt(emp.adj_amount)}</td>
            <td class="text-right table-num" style="font-weight:700;color:var(--success);">¥${fmt(emp.total)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    });

    html += '</div>';
    content.innerHTML = html;
  } finally {
    finishRefresh();
    finishButton();
  }
}

function printSalary(mode = 'color') {
  const content = document.getElementById('salaryContent');
  if (!content || !content.textContent.trim()) {
    showToast('请先查询工资数据再打印', 'info');
    return;
  }

  document.body.classList.add('salary-print-mode');
  document.body.classList.toggle('print-mono', mode === 'mono');
  const cleanup = () => {
    document.body.classList.remove('salary-print-mode');
    document.body.classList.remove('print-mono');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
}

document.getElementById('salaryYear').addEventListener('change', loadSalary);
document.getElementById('salaryMonth').addEventListener('change', loadSalary);
