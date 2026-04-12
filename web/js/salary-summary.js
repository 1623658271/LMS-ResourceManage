// ============================================================
// 总工资表（支持做货编辑/快捷计算两种数据源）
// ============================================================

// 获取当前工资数据源设置
function getSalarySource() {
  return localStorage.getItem('useQcSalary') === 'true' ? 'qc' : 'work';
}

async function loadSalary() {
  const year = parseInt(document.getElementById('salaryYear').value);
  const month = parseInt(document.getElementById('salaryMonth').value);
  const source = getSalarySource();
  const data = await get(`/api/salary-summary?year=${year}&month=${month}&source=${source}`);
  const content = document.getElementById('salaryContent');
  const sourceLabel = source === 'qc' ? '（快捷计算数据）' : '';
  if (!data || !data.length) { content.innerHTML = '<div class="empty-state">暂无工资数据</div>'; return; }
  const grandTotalWage = data.reduce((s, d) => s + d.total_wage, 0);
  const grandTotalPairs = data.reduce((s, d) => s + d.total_pairs, 0);
  let html = `<div class="grand-total">
    <span>🏭 全厂合计${sourceLabel ? ' <span class="qc-badge">快捷计算</span>' : ''}</span>
    <span>对数：<strong>${grandTotalPairs}</strong> &nbsp;|&nbsp; 总工资：<strong>¥${fmt(grandTotalWage)}</strong></span>
  </div>`;
  data.forEach(dept => {
    html += `<div class="dept-block">
      <div class="dept-block-header">
        <span>📂 <span class="dept-large">${escHtml(dept.dept_name)}</span></span>
        <span class="dept-totals">对数合计：${dept.total_pairs} &nbsp;|&nbsp; 部门工资合计：¥${fmt(dept.total_wage)}</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>姓名</th><th>小部门</th><th class="text-right">做货对数</th><th class="text-right">做货工资</th><th class="text-right">人工增扣</th><th class="text-right">总工资</th></tr></thead>
        <tbody>${dept.employees.map(emp => `<tr>
          <td><span class="member-name-color">${escHtml(emp.name)}</span></td><td><span class="dept-sub">${escHtml(emp.sub_dept_name)}</span></td>
          <td class="text-right table-num">${emp.pairs}</td>
          <td class="text-right table-num">¥${fmt(emp.wage)}</td>
          <td class="text-right table-num text-danger">¥${fmt(emp.adj_amount)}</td>
          <td class="text-right table-num" style="font-weight:700;color:var(--success);">¥${fmt(emp.total)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  });
  content.innerHTML = html;
}
document.getElementById('salaryYear').addEventListener('change', loadSalary);
document.getElementById('salaryMonth').addEventListener('change', loadSalary);
