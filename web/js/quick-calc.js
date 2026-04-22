// ============================================================
// 快捷计算 - 按大部门分组的多表格（无型号，纯手工输入）
// ============================================================

// ---- 初始化 ----
async function initQuickCalc() {
  const [emps, depts, subs] = await Promise.all([
    get('/api/employees'),
    get('/api/departments'),
    get('/api/sub-departments'),
  ]);
  _qcState.employees = emps || [];
  _qcState.departments = depts || [];
  _qcState.subDepartments = subs || [];
  _qcState.qtyData = {};
  _qcState.qcViewMode = 'qty';
  _qcState.qcWageDetail = null;

  // 自动加载上次保存的状态
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  const saved = await get(`/api/quick-calc-save?year=${year}&month=${month}`);

  if (saved && saved.dept_rows && Object.keys(saved.dept_rows).length > 0) {
    _qcDeptRows = { ...saved.dept_rows };
    _qcState.qtyData = { ...saved.qty_data };
  } else {
    // 默认初始状态：每个大部门初始化一行空行
    _qcDeptRows = {};
    _qcState.qtyData = {};
    for (const dept of _qcState.departments) {
      const rowKey = `${dept.id}_0`;
      const row = {};
      // 该大部门下的所有小部门，单价初始化为0
      const deptSubs = _qcState.subDepartments.filter(s => s.dept_id === dept.id);
      for (const sub of deptSubs) {
        row[sub.id] = 0;
      }
      _qcDeptRows[rowKey] = row;
    }
  }

  // 重置工资视角按钮
  const btn = document.getElementById('qcViewModeBtn');
  if (btn) {
    btn.textContent = '切换工资视角';
    btn.style.background = '#fef3c7';
    btn.style.color = '#92400e';
  }

  // 保存初始状态到历史栈（清空之前的历史）
  clearHistory();
  pushHistory('quick-calc');

  renderQcDeptTables();
}

// ---- 渲染所有大部门表格 ----
function renderQcDeptTables() {
  const wrap = document.getElementById('qcDeptTablesWrap');
  if (!wrap) return;

  const { departments, subDepartments, employees } = _qcState;
  const isWage = _qcState.qcViewMode === 'wage';

  if (!departments.length) {
    wrap.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请先在部门管理中添加大部门</div></div>';
    document.getElementById('qcGrandTotal').textContent = '¥0.00';
    return;
  }

  let html = '';
  let grandTotal = 0;

  for (const dept of departments) {
    const deptSubs = subDepartments.filter(s => s.dept_id === dept.id);
    const deptEmps = employees.filter(e => e.dept_id === dept.id);

    if (!deptSubs.length && !deptEmps.length) continue;

    // 收集该大部门的所有行
    const deptRowKeys = Object.keys(_qcDeptRows).filter(k => k.startsWith(dept.id + '_'));
    const sortedRowKeys = deptRowKeys.sort((a, b) => {
      const ra = parseInt(a.split('_')[1]);
      const rb = parseInt(b.split('_')[1]);
      return ra - rb;
    });

    // 大部门标题
    html += `<div class="qc-dept-section">`;
    html += `<div class="qc-dept-header">
      <span class="qc-dept-name">${escHtml(dept.name)}</span>
      <span class="qc-dept-subs">单价：${deptSubs.map(s => escHtml(s.name)).join('、')}</span>
      <span class="qc-dept-emps">成员：${deptEmps.map(e => escHtml(e.name)).join('、')}</span>
    </div>`;

    if (sortedRowKeys.length === 0) {
      html += `<div style="padding:16px;color:var(--text-muted);font-size:var(--font-size-12);text-align:center;">暂无行数据，请点击下方按钮添加</div>`;
    } else {
      html += `<div class="spreadsheet-wrap qc-dept-table-wrap"><table class="spreadsheet${isWage ? ' wage-view' : ''}">`;

      // 表头 - 只有单价列和成员列，没有型号列，操作列在最左边
      html += '<thead><tr>';
      html += `<th style="min-width:60px;background:#059669;color:#fff;position:sticky;top:0;z-index:10;text-align:center;">操作</th>`;
      for (const sub of deptSubs) {
        html += `<th style="min-width:75px;background:#d1fae5;color:#065f46;position:sticky;top:0;z-index:10;text-align:center;">
          ${escHtml(sub.name)}<br><span style="font-size:var(--font-size-10);font-weight:400;color:#6b7280;">单价</span>
        </th>`;
      }
      for (const emp of deptEmps) {
        html += `<th style="min-width:75px;background:#e0e7ff;color:#3730a3;position:sticky;top:0;z-index:10;text-align:center;">
          <span class="member-list-name-color" onclick="showEmployeeDetail(${emp.id})">${escHtml(emp.name)}</span>
          <br><span style="font-size:var(--font-size-10);font-weight:400;color:#6b7280;">${escHtml(emp.sub_dept_name)}</span>
        </th>`;
      }
      html += `<th style="min-width:70px;background:#fef9c3;color:#92400e;position:sticky;top:0;z-index:10;text-align:center;">行合计</th>`;
      html += '</tr></thead>';

      // 表体
      html += '<tbody>';
      for (const rowKey of sortedRowKeys) {
        const row = _qcDeptRows[rowKey];
        const rowIdx = rowKey.split('_')[1];

        // 计算行合计
        let rowTotal = 0;
        for (const emp of deptEmps) {
          const qtyKey = `${rowKey},${emp.id}`;
          const qty = _qcState.qtyData[qtyKey] || 0;
          const empSubPrice = row[emp.sub_dept_id] || 0;
          rowTotal += qty * empSubPrice;
        }
        const rowDisplay = rowTotal > 0 ? fmtCompact(rowTotal) : '';
        const rowCompact = String(rowDisplay).length > 8 ? ' compact' : '';

        html += '<tr>';

        // 操作列（删除按钮）- 移到最左边
        html += `<td style="text-align:center;">
          <button class="btn btn-sm" style="padding:4px 10px;font-size:var(--font-size-11);background:#fee2e2;color:#dc2626;" onclick="removeQcDeptRow('${escHtml(rowKey)}')">删除</button>
        </td>`;

        // 各小部门单价列（纯手动输入）
        for (const sub of deptSubs) {
          const priceVal = row[sub.id] || 0;
          if (isWage) {
            html += `<td class="qc-price-cell" style="text-align:center;background:#f0fdf4;">
              <div class="cell-input" style="width:65px;color:#374151;" title="￥${priceVal.toFixed(2)}">￥${priceVal.toFixed(2)}</div>
            </td>`;
          } else {
            html += `<td class="qc-price-cell" style="text-align:center;background:#f0fdf4;">
              <input type="number" min="0" step="0.01" class="cell-input qc-price-input"
                style="width:65px;text-align:center;"
                value="${priceVal || ''}" placeholder="0"
                data-row-key="${escHtml(rowKey)}" data-sub-id="${sub.id}"
                onfocus="onQcCellFocus(this, 'price')"
                onblur="onQcCellBlur(this, 'price')"
                oninput="onQcPriceInput(this)"
                onkeydown="onQcPriceTab(event, this)">
            </td>`;
          }
        }

        // 成员对数列
        for (const emp of deptEmps) {
          const qtyKey = `${rowKey},${emp.id}`;
          const qty = _qcState.qtyData[qtyKey] || 0;
          const empSubPrice = row[emp.sub_dept_id] || 0;
          const wage = qty * empSubPrice;

          if (isWage) {
            const displayVal = qty > 0 ? fmtCompact(wage) : '';
            const compactClass = String(displayVal).length > 6 ? ' compact' : '';
            html += `<td class="emp-cell">
              <div class="cell-input wage-cell-display${compactClass}" style="width:65px;"
                data-key="${qtyKey}"
                title="${qty > 0 ? '¥' + fmt(wage) : ''}">${displayVal}</div>
            </td>`;
          } else {
            // 非0值 → 浅蓝色；0值或空值 → 默认颜色
            const hasQty = qty > 0;
            const bgStyle = hasQty ? 'background:#bfdbfe;' : '';
            html += `<td class="emp-cell" style="text-align:center;">
              <input type="number" min="0" class="cell-input qc-qty-input"
                style="width:65px;text-align:center;${bgStyle}"
                value="${qty || ''}" placeholder="0"
                data-key="${qtyKey}"
                data-row-key="${escHtml(rowKey)}"
                data-emp-id="${emp.id}"
                data-sub-id="${emp.sub_dept_id}"
                onfocus="onQcCellFocus(this, 'qty')"
                onblur="onQcCellBlur(this, 'qty')"
                oninput="onQcQtyInput(this)"
                onkeydown="onQcQtyTab(event, this)">
            </td>`;
          }
        }

        // 行合计
        html += `<td class="row-total-display${isWage ? ' wage' : ''}${rowCompact}" style="background:#fef9c3;font-weight:700;color:#92400e;text-align:center;">${rowDisplay}</td>`;

        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    // 添加行按钮
    html += `<button class="row-add-btn" onclick="addQcDeptRow(${dept.id})">+ 添加一行</button>`;
    html += '</div>'; // qc-dept-section end

    // 累加该大部门的合计
    for (const rowKey of sortedRowKeys) {
      const row = _qcDeptRows[rowKey];
      const deptEmps2 = employees.filter(e => e.dept_id === dept.id);
      for (const emp of deptEmps2) {
        const qtyKey = `${rowKey},${emp.id}`;
        const qty = _qcState.qtyData[qtyKey] || 0;
        const subPrice = row[emp.sub_dept_id] || 0;
        grandTotal += qty * subPrice;
      }
    }
  }

  wrap.innerHTML = html;
  document.getElementById('qcGrandTotal').textContent = '¥' + fmt(grandTotal);
}

// ---- 单元格获得焦点 ----
function onQcCellFocus(el, type) {
  if (type === 'price') {
    const rowKey = el.dataset.rowKey;
    const subId = parseInt(el.dataset.subId);
    const currentVal = _qcDeptRows[rowKey]?.[subId] || 0;
    
    _editSession = {
      type: 'quick-calc-price',
      rowKey: rowKey,
      subId: subId,
      originalValue: currentVal
    };
  } else if (type === 'qty') {
    const qtyKey = el.dataset.key;
    const currentVal = _qcState.qtyData[qtyKey] || 0;
    
    _editSession = {
      type: 'quick-calc-qty',
      qtyKey: qtyKey,
      originalValue: currentVal
    };
  }
  
  // 如果值为0或空，清空输入框方便输入
  if (el.value === '0' || el.value === '') {
    el.value = '';
  }
}

// ---- 单元格失去焦点 ----
function onQcCellBlur(el, type) {
  const rawVal = el.value.trim();
  const val = rawVal === '' ? 0 : (parseInt(rawVal) || 0);
  
  // 检查值是否变化，变化才保存历史（按单元格撤销）
  let hasChanged = false;
  if (_editSession) {
    if (type === 'price' && _editSession.type === 'quick-calc-price') {
      const rowKey = el.dataset.rowKey;
      const subId = parseInt(el.dataset.subId);
      if (_editSession.rowKey === rowKey && _editSession.subId === subId) {
        if (val !== _editSession.originalValue) {
          pushHistory('quick-calc');
          hasChanged = true;
        }
      }
    } else if (type === 'qty' && _editSession.type === 'quick-calc-qty') {
      const qtyKey = el.dataset.key;
      if (_editSession.qtyKey === qtyKey) {
        if (val !== _editSession.originalValue) {
          pushHistory('quick-calc');
          hasChanged = true;
        }
      }
    }
  }
  
  _editSession = null;
  
  // 如果值为0，显示0
  if (val === 0) {
    el.value = '0';
  }

  // 值变化时触发自动保存
  if (hasChanged) {
    clearTimeout(window._qcAutoSaveTimer);
    window._qcAutoSaveTimer = setTimeout(() => autoSaveQc(), 500);
  }
}

// ---- 单价输入变化 ----
function onQcPriceInput(el) {
  const rowKey = el.dataset.rowKey;
  const subId = parseInt(el.dataset.subId);
  const val = parseFloat(el.value) || 0;

  if (!_qcDeptRows[rowKey]) return;

  // 实时更新显示，但不保存历史
  if (val === 0) {
    _qcDeptRows[rowKey][subId] = 0;
    el.style.background = '';
  } else {
    _qcDeptRows[rowKey][subId] = val;
    el.style.background = '#fef9c3';
  }

  // 更新所有员工列（因为单价变了，工资会变）
  updateDeptRowTotals(rowKey);

  // 防抖自动保存
  clearTimeout(window._qcAutoSaveTimer);
  window._qcAutoSaveTimer = setTimeout(() => autoSaveQc(), 500);
}

// ---- 单价 Tab 导航 ----
function onQcPriceTab(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowKey = el.dataset.rowKey;
    const allCells = Array.from(
      document.querySelectorAll(`.qc-price-input[data-row-key="${rowKey}"]`)
    );
    const curIdx = allCells.indexOf(el);
    if (curIdx >= 0 && curIdx < allCells.length - 1) {
      allCells[curIdx + 1].focus();
      return;
    }
    // 最后一个单价格 -> 跳到第一个成员对数格
    const allQtyCells = Array.from(
      document.querySelectorAll(`.qc-qty-input[data-row-key="${rowKey}"]`)
    );
    if (allQtyCells.length > 0) {
      allQtyCells[0].focus();
    }
  }
}

// ---- 对数输入变化 ----
function onQcQtyInput(el) {
  const key = el.dataset.key;
  if (!key) return;
  const val = parseInt(el.value) || 0;
  const rowKey = el.dataset.rowKey;

  // 实时更新显示，但不保存历史
  if (val === 0) {
    delete _qcState.qtyData[key];
    el.style.background = '';  // 0值恢复默认颜色
  } else {
    _qcState.qtyData[key] = val;
    el.style.background = '#bfdbfe';  // 非0值浅蓝色（与做货编辑一致）
  }

  updateDeptRowTotals(rowKey);

  // 防抖自动保存
  clearTimeout(window._qcAutoSaveTimer);
  window._qcAutoSaveTimer = setTimeout(() => autoSaveQc(), 500);
}

// ---- 对数 Tab 导航（在该行所有成员格之间循环） ----
function onQcQtyTab(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowKey = el.dataset.rowKey;
    const allInputs = Array.from(
      document.querySelectorAll(`.qc-qty-input[data-row-key="${rowKey}"]`)
    );
    const curIdx = allInputs.indexOf(el);
    if (curIdx >= 0) {
      const nextIdx = (curIdx + 1) % allInputs.length;
      allInputs[nextIdx].focus();
    }
  }
}

// ---- 更新某行所有合计（行合计 + 全厂合计） ----
function updateDeptRowTotals(rowKey) {
  const deptId = parseInt(rowKey.split('_')[0]);
  const row = _qcDeptRows[rowKey];
  const deptEmps = _qcState.employees.filter(e => e.dept_id === deptId);

  let rowTotal = 0;
  for (const emp of deptEmps) {
    const qtyKey = `${rowKey},${emp.id}`;
    const qty = _qcState.qtyData[qtyKey] || 0;
    const empSubPrice = row[emp.sub_dept_id] || 0;
    rowTotal += qty * empSubPrice;

    // 更新该成员的工资显示（工资视角下）
    if (_qcState.qcViewMode === 'wage') {
      const wage = qty * empSubPrice;
      const displayVal = qty > 0 ? fmtCompact(wage) : '';
      const allDisplays = document.querySelectorAll(`.wage-cell-display[data-key="${qtyKey}"]`);
      for (const d of allDisplays) {
        d.textContent = displayVal;
        d.title = qty > 0 ? '¥' + fmt(wage) : '';
      }
    }
  }

  // 更新行合计 - 通过 rowKey 找到对应行的第一个 td（在同一个 table 中按行序号定位）
  const wrap = document.getElementById('qcDeptTablesWrap');
  if (!wrap) return;
  const tables = wrap.querySelectorAll('.spreadsheet');
  for (const table of tables) {
    const rows = table.querySelectorAll('tbody tr');
    // 找出 rowKey 对应的行（通过 data-row-key 属性在单价 input 上匹配）
    for (const tr of rows) {
      const priceInput = tr.querySelector(`.qc-price-input[data-row-key="${rowKey}"]`);
      if (priceInput) {
        const totalEl = tr.querySelector('.row-total-display');
        if (totalEl) {
          const rowDisplay = rowTotal > 0 ? fmtCompact(rowTotal) : '';
          const rowCompact = String(rowDisplay).length > 8 ? ' compact' : '';
          totalEl.textContent = rowDisplay;
          totalEl.className = `row-total-display${_qcState.qcViewMode === 'wage' ? ' wage' : ''}${rowCompact}`;
        }
        break;
      }
    }
  }

  // 更新全厂合计
  let grandTotal = 0;
  for (const dept of _qcState.departments) {
    const dEmps = _qcState.employees.filter(e => e.dept_id === dept.id);
    const dRowKeys = Object.keys(_qcDeptRows).filter(k => k.startsWith(dept.id + '_'));
    for (const rk of dRowKeys) {
      const r = _qcDeptRows[rk];
      for (const emp of dEmps) {
        const qtyKey = `${rk},${emp.id}`;
        const qty = _qcState.qtyData[qtyKey] || 0;
        const subPrice = r[emp.sub_dept_id] || 0;
        grandTotal += qty * subPrice;
      }
    }
  }
  document.getElementById('qcGrandTotal').textContent = '¥' + fmt(grandTotal);
}

// ---- 添加行 ----
function addQcDeptRow(deptId) {
  const deptRowKeys = Object.keys(_qcDeptRows).filter(k => k.startsWith(deptId + '_'));
  const maxIdx = deptRowKeys.length > 0
    ? Math.max(...deptRowKeys.map(k => parseInt(k.split('_')[1])))
    : -1;
  const newRowIdx = maxIdx + 1;
  const rowKey = `${deptId}_${newRowIdx}`;

  const deptSubs = _qcState.subDepartments.filter(s => s.dept_id === deptId);
  const row = {};
  for (const sub of deptSubs) {
    row[sub.id] = 0;
  }
  _qcDeptRows[rowKey] = row;

  // 保存历史记录（添加行后保存，确保包含新行）
  pushHistory('quick-calc');

  renderQcDeptTables();
  autoSaveQc(); // 添加行后自动保存
}

// ---- 删除行 ----
function removeQcDeptRow(rowKey) {
  const deptId = rowKey.split('_')[0];
  const deptRowKeys = Object.keys(_qcDeptRows).filter(k => k.startsWith(deptId + '_'));

  if (deptRowKeys.length <= 1) {
    // 至少保留一行，清空该行数据
    const row = _qcDeptRows[rowKey];
    const deptEmps = _qcState.employees.filter(e => e.dept_id === parseInt(deptId));
    for (const emp of deptEmps) {
      delete _qcState.qtyData[`${rowKey},${emp.id}`];
    }
    const deptSubs = _qcState.subDepartments.filter(s => s.dept_id === parseInt(deptId));
    for (const sub of deptSubs) {
      row[sub.id] = 0;
    }
    // 保存历史记录（清空行后保存）
    pushHistory('quick-calc');
    renderQcDeptTables();
    autoSaveQc(); // 清空行后自动保存
    return;
  }

  // 删除该行的对数数据
  const row = _qcDeptRows[rowKey];
  for (const emp of _qcState.employees) {
    delete _qcState.qtyData[`${rowKey},${emp.id}`];
  }

  delete _qcDeptRows[rowKey];

  // 保存历史记录（删除行后保存，确保不包含已删除的行）
  pushHistory('quick-calc');

  renderQcDeptTables();
  saveQcState();
}

// ---- 自动保存快捷计算状态 ----
async function autoSaveQc() {
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  await post('/api/quick-calc-save', {
    year, month,
    dept_rows: _qcDeptRows,
    qty_data: _qcState.qtyData,
  });
}

// ---- 手动保存 ----
async function saveQcState() {
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  await post('/api/quick-calc-save', {
    year, month,
    dept_rows: _qcDeptRows,
    qty_data: _qcState.qtyData,
  });
  const btn = document.getElementById('qcSaveBtn');
  if (btn) {
    btn.textContent = '✓ 已保存';
    btn.style.background = '#d1fae5';
    btn.style.color = '#065f46';
    setTimeout(() => {
      btn.textContent = '💾 保存';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  }
  toast('保存成功', 'success');
}

// ---- 清空对数 ----
function clearQcInputs() {
  _qcState.qtyData = {};
  renderQcDeptTables();
  saveQcState();
}

// ---- 清空单价 ----
function clearQcPrices() {
  // 遍历所有行的单价，重置为0
  for (const rowKey in _qcDeptRows) {
    const row = _qcDeptRows[rowKey];
    for (const subDeptId in row) {
      row[subDeptId] = 0;
    }
  }
  renderQcDeptTables();
  saveQcState();
}

// ---- 切换工资视角 ----
async function qcToggleViewMode() {
  await autoSaveQc();
  if (_qcState.qcViewMode === 'qty') {
    _qcState.qcViewMode = 'wage';
    const btn = document.getElementById('qcViewModeBtn');
    if (btn) {
      btn.textContent = '切换对数视角';
      btn.style.background = '#dcfce7';
      btn.style.color = '#15803d';
    }
    toast('工资视角：对数 × 单价', 'info');
  } else {
    _qcState.qcViewMode = 'qty';
    _qcState.qcWageDetail = null;
    const btn = document.getElementById('qcViewModeBtn');
    if (btn) {
      btn.textContent = '切换工资视角';
      btn.style.background = '#fef3c7';
      btn.style.color = '#92400e';
    }
    toast('对数视角', 'info');
  }
  renderQcDeptTables();
}

// ---- 年月变化时重新加载 ----
document.getElementById('qcYear').addEventListener('change', initQuickCalc);
document.getElementById('qcMonth').addEventListener('change', initQuickCalc);
