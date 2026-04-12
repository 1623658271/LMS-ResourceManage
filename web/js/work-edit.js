// ============================================================
// 做货编辑（按行存储数据结构）
// ============================================================

// 全局状态（按行存储）
let _workRowData = {};     // { rowIdx: {orderId, modelId, emps: {empId: qty}} }
let _workRowCounter = 0;   // 自增行ID，保证唯一性

async function loadWorkRecords() {
  const year = parseInt(document.getElementById('workYear').value);
  const month = parseInt(document.getElementById('workMonth').value);
  _state.currentYear = year;
  _state.currentMonth = month;

  const data = await get(`/api/work-records?year=${year}&month=${month}`);
  _state.workEmployees = data.employees || [];
  _state.workModels = data.models || [];
  _state.workOrders = data.orders || [];
  _state.workOrderModels = data.order_models || {};
  _state.workRecords = data.records || [];
  _state.wageDetail = null;

  // 重置状态
  _workRowData = {};
  _workRowCounter = 0;

  // 从数据库记录恢复（按行分组）
  const rowsMap = {};  // { "orderId,modelId": rowIdx }
  for (const r of _state.workRecords) {
    if (!r.order_id || !r.model_id) continue;
    const comboKey = `${r.order_id},${r.model_id}`;
    if (rowsMap[comboKey] === undefined) {
      rowsMap[comboKey] = _workRowCounter++;
      _workRowData[rowsMap[comboKey]] = {
        orderId: r.order_id,
        modelId: r.model_id,
        emps: {}
      };
    }
    // 恢复对数数据（绑定在行上）
    _workRowData[rowsMap[comboKey]].emps[r.emp_id] = r.quantity;
  }

  renderSpreadsheet();
}

// ============================================================
// 渲染表格（按行存储）
// ============================================================
function renderSpreadsheet() {
  const emps = _state.workEmployees;
  const orders = _state.workOrders;
  const models = _state.workModels;
  const isWage = _state.viewMode === 'wage';
  const isSingleMode = _currentSettings['table-displayMode'] === 'single';
  const empsPerGroup = isSingleMode ? emps.length : parseInt(_currentSettings['table-groupSize'] || 8);
  const wrap = document.getElementById('spreadsheetWrap');

  if (!emps.length) {
    wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请先在成员管理中添加员工</div></div>`;
    return;
  }

  const totalGroups = Math.ceil(emps.length / empsPerGroup);

  // 计算行合计（基于该行的 emps 数据）
  function calcRowTotal(rowData) {
    if (!rowData || !rowData.orderId || !rowData.modelId) return 0;
    let total = 0;
    const empsMap = rowData.emps || {};
    if (isWage && _state.wageDetail) {
      for (const emp of emps) {
        const key = `${String(rowData.orderId)},${String(rowData.modelId)},${String(emp.id)}`;
        total += _state.wageDetail.wages[key] || 0;
      }
    } else {
      for (const emp of emps) {
        total += empsMap[emp.id] || 0;
      }
    }
    return total;
  }

  // 构建单张分组表格
  function buildGroupTable(groupIdx, groupEmps, isOnlyGroup) {
    const stickyLeft = isOnlyGroup ? 'left:0;' : 'left:0;';

    const headerHtml = `<thead><tr>
      <th class="col-fixed" style="min-width:50px;background:#059669;color:#fff;${stickyLeft}z-index:21;">操作</th>
      <th class="col-fixed" style="min-width:100px;background:#059669;color:#fff;${stickyLeft}z-index:20;">订单号</th>
      <th class="col-fixed" style="min-width:90px;background:#059669;color:#fff;${stickyLeft}z-index:19;">型号</th>
      ${groupEmps.map(e => `<th style="min-width:70px;background:#d1fae5;color:#065f46;">
        <span class="member-list-name-color" onclick="showEmployeeDetail(${e.id})">${escHtml(e.name)}</span>
      </th>`).join('')}
      <th class="col-fixed" style="background:#fef9c3;color:#92400e;min-width:80px;${stickyLeft}z-index:19;">行合计</th>
    </tr></thead>`;

    let tbodyHtml = '<tbody>';
    Object.entries(_workRowData).forEach(([rowIdx, rowData]) => {
      const { orderId, modelId, emps: empsMap } = rowData;
      const rowTotal = calcRowTotal(rowData);

      const empCells = groupEmps.map(emp => {
        const qty = empsMap[emp.id] || 0;
        if (isWage && _state.wageDetail) {
          const key = `${String(orderId)},${String(modelId)},${String(emp.id)}`;
          const wage = _state.wageDetail.wages[key] || 0;
          const displayVal = wage > 0 ? fmtCompact(wage) : '';
          const compactClass = String(displayVal).length > 6 ? ' compact' : '';
          return `<td>
            <div class="cell-input wage-cell-display${compactClass}" style="width:65px;text-align:right;" data-key="${key}"
              title="${wage > 0 ? '¥' + fmt(wage) : ''}">${displayVal}</div>
          </td>`;
        } else {
          return `<td style="text-align:center;">
            <input type="number" min="0" class="cell-input" style="width:65px;"
              value="${qty || ''}" placeholder="0" data-row="${rowIdx}" data-emp="${emp.id}"
              oninput="onWorkCellChange(this)"
              onkeydown="onWorkCellKeydown(event,this)">
          </td>`;
        }
      }).join('');

      const orderOptions = orders.map(o =>
        `<option value="${o.id}"${o.id === orderId ? ' selected' : ''}>${escHtml(o.order_no)}</option>`
      ).join('');
      const modelOptions = models.map(m =>
        `<option value="${m.id}"${m.id === modelId ? ' selected' : ''}>${escHtml(m.model_no)}</option>`
      ).join('');

      const totalDisplay = isWage ? (rowTotal > 0 ? fmtCompact(rowTotal) : '') : rowTotal;
      const compactTotal = String(totalDisplay).length > 8 ? ' compact' : '';

      tbodyHtml += `<tr>
        <td class="col-fixed" style="text-align:center;${stickyLeft}z-index:7;">
          <button class="btn btn-sm" style="padding:4px 10px;font-size:11px;background:#fee2e2;color:#dc2626;"
            onclick="deleteWorkRow(${rowIdx})">删除</button>
        </td>
        <td class="col-fixed" style="background:#d1fae5;${stickyLeft}z-index:6;">
          <select class="cell-input" style="background:#d1fae5;font-weight:600;min-width:80px;"
            data-row="${rowIdx}" data-type="order" onchange="onWorkSelectChange(this)">
            ${orderOptions}
          </select>
        </td>
        <td class="col-fixed" style="background:#d1fae5;${stickyLeft}z-index:5;">
          <select class="cell-input" style="background:#d1fae5;font-weight:600;min-width:70px;"
            data-row="${rowIdx}" data-type="model" onchange="onWorkSelectChange(this)">
            ${modelOptions}
          </select>
        </td>
        ${empCells}
        <td class="col-fixed row-total${isWage ? ' wage' : ''}${compactTotal}"
          style="font-weight:700;text-align:center;background:#fef9c3;color:#92400e;${stickyLeft}z-index:5;">${totalDisplay}</td>
      </tr>`;
    });
    tbodyHtml += '</tbody>';
    return `<table class="spreadsheet${isWage?' wage-view':''}${isSingleMode?' single-table-mode':''}">${headerHtml}${tbodyHtml}</table>`;
  }

  // 组装所有分组表格
  let tablesHtml = '';
  for (let g = 0; g < totalGroups; g++) {
    const start = g * empsPerGroup;
    const end = Math.min(start + empsPerGroup, emps.length);
    const groupEmps = emps.slice(start, end);
    const isOnlyGroup = totalGroups === 1;
    if (!isSingleMode && g > 0) {
      tablesHtml += `<div class="table-group-label">
        <span class="group-tag">第 ${g + 1} 组 / 共 ${totalGroups} 组</span>
        <span style="color:#94a3b8;font-weight:400;">员工 ${start + 1} - ${end}（共 ${emps.length} 人）</span>
      </div>`;
    }
    tablesHtml += `<div class="table-group-wrap${isSingleMode?' single-scroll-wrap':''}">${buildGroupTable(g, groupEmps, isOnlyGroup)}</div>`;
  }

  wrap.innerHTML = `${tablesHtml}<button class="row-add-btn" onclick="addWorkRow()">+ 添加一行</button>`;
}

// ============================================================
// 单元格变更（按行存储）
// ============================================================
function onWorkCellChange(el) {
  const rowIdx = parseInt(el.dataset.row);
  const empId = parseInt(el.dataset.emp);
  const val = parseFloat(el.value) || 0;

  if (!_workRowData[rowIdx]) return;

  if (val === 0) {
    delete _workRowData[rowIdx].emps[empId];
    el.style.background = '';
  } else {
    _workRowData[rowIdx].emps[empId] = val;
    el.style.background = '#fef9c3';
  }

  // 更新该行的行合计（只更新当前表格）
  updateRowTotal(rowIdx);

  // 防抖自动保存
  clearTimeout(window._workAutoSaveTimer);
  window._workAutoSaveTimer = setTimeout(() => autoSaveWorkRecords(), 300);
}

// 更新行合计
function updateRowTotal(rowIdx) {
  const rowData = _workRowData[rowIdx];
  if (!rowData) return;

  const emps = _state.workEmployees || [];
  const isWage = _state.viewMode === 'wage';
  let rowTotal = 0;

  if (isWage && _state.wageDetail) {
    for (const emp of emps) {
      const key = `${String(rowData.orderId)},${String(rowData.modelId)},${String(emp.id)}`;
      rowTotal += _state.wageDetail.wages[key] || 0;
    }
  } else {
    const empsMap = rowData.emps || {};
    for (const emp of emps) {
      rowTotal += empsMap[emp.id] || 0;
    }
  }

  // 更新所有表格中的行合计
  const allTables = document.querySelectorAll('#spreadsheetWrap .spreadsheet');
  for (const tbl of allTables) {
    const rowTr = tbl.querySelector(`tr:has(input[data-row="${rowIdx}"])`);
    if (rowTr) {
      const totalEl = rowTr.querySelector('.row-total');
      if (totalEl) {
        const displayVal = isWage ? (rowTotal > 0 ? fmtCompact(rowTotal) : '') : rowTotal;
        totalEl.textContent = displayVal;
        totalEl.className = `col-fixed row-total${isWage ? ' wage' : ''}${String(displayVal).length > 8 ? ' compact' : ''}`;
      }
    }
  }
}

function onWorkCellKeydown(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowIdx = el.dataset.row;
    const allInputs = Array.from(
      document.querySelectorAll(`#spreadsheetWrap td input[data-row="${rowIdx}"]`)
    );
    const curIdx = allInputs.indexOf(el);
    if (curIdx >= 0) {
      const nextIdx = (curIdx + 1) % allInputs.length;
      allInputs[nextIdx].focus();
    }
  }
}

// ============================================================
// 下拉变更（订单/型号）- 切换时清空该行对数
// ============================================================
function onWorkSelectChange(el) {
  const rowIdx = parseInt(el.dataset.row);
  const type = el.dataset.type;
  const val = parseInt(el.value);

  if (!_workRowData[rowIdx]) {
    _workRowData[rowIdx] = { orderId: 0, modelId: 0, emps: {} };
  }

  // 切换订单或型号时，清空该行的所有对数（符合用户预期）
  _workRowData[rowIdx].emps = {};

  if (type === 'order') {
    _workRowData[rowIdx].orderId = val;
  } else if (type === 'model') {
    _workRowData[rowIdx].modelId = val;
  }

  // 重新渲染（显示空表格）
  renderSpreadsheet();

  // 立即保存（清空后的状态）
  autoSaveWorkRecords();
}

// ============================================================
// 添加/删除行（按行存储）
// ============================================================
function addWorkRow() {
  const rowIdx = _workRowCounter++;  // 使用自增ID
  _workRowData[rowIdx] = { orderId: 0, modelId: 0, emps: {} };  // 空行
  renderSpreadsheet();
  // 聚焦到新行的订单下拉
  setTimeout(() => {
    const sel = document.querySelector(`#spreadsheetWrap select[data-row="${rowIdx}"][data-type="order"]`);
    if (sel) sel.focus();
  }, 50);
}

function deleteWorkRow(rowIdx) {
  if (!confirm('确定删除这一行吗？')) return;
  if (!_workRowData[rowIdx]) return;

  // 删除该行（对数数据随之删除）
  delete _workRowData[rowIdx];

  renderSpreadsheet();
  autoSaveWorkRecords();
  toast('已删除', 'success');
}

// ============================================================
// 保存全部（备用函数，保留）
// ============================================================
async function saveAllWorkRecords() {
  await autoSaveWorkRecords();
  toast('已保存', 'success');
}

// ============================================================
// 自动保存（按行遍历）
// ============================================================
async function autoSaveWorkRecords() {
  const year = _state.currentYear;
  const month = _state.currentMonth;
  const toSave = [];
  const toDelete = [];

  // 遍历每一行
  for (const [rowIdx, rowData] of Object.entries(_workRowData)) {
    const { orderId, modelId, emps } = rowData;
    if (!orderId || !modelId) continue;

    // 遍历该行的每个员工对数
    for (const [empId, qty] of Object.entries(emps)) {
      const empIdNum = parseInt(empId);
      if (qty > 0) {
        toSave.push({ orderId, modelId, empId: empIdNum, qty });
      } else {
        toDelete.push({ orderId, modelId, empId: empIdNum });
      }
    }
  }

  // 批量保存
  for (const item of toSave) {
    try {
      await post('/api/work-records', {
        year, month,
        order_id: item.orderId,
        model_id: item.modelId,
        emp_id: item.empId,
        quantity: item.qty
      });
    } catch (e) { console.error('保存失败', e); }
  }

  // 批量删除
  for (const item of toDelete) {
    try {
      await del(`/api/work-records?year=${year}&month=${month}&order_id=${item.orderId}&model_id=${item.modelId}&emp_id=${item.empId}`);
    } catch (e) { console.error('删除失败', e); }
  }
}

// ============================================================
// 切换工资视角
// ============================================================
async function toggleViewMode() {
  // 先自动保存
  await autoSaveWorkRecords();

  if (_state.viewMode === 'qty') {
    const year = _state.currentYear, month = _state.currentMonth;
    _state.wageDetail = await get(`/api/wage-detail?year=${year}&month=${month}`);
    _state.viewMode = 'wage';
    document.getElementById('viewModeBtn').textContent = '切换对数视角';
    document.getElementById('viewModeBtn').style.background = '#dcfce7';
    document.getElementById('viewModeBtn').style.color = '#15803d';
    toast('工资视角：对数 × 单价', 'info');
  } else {
    _state.viewMode = 'qty';
    _state.wageDetail = null;
    document.getElementById('viewModeBtn').textContent = '切换工资视角';
    document.getElementById('viewModeBtn').style.background = '#fef3c7';
    document.getElementById('viewModeBtn').style.color = '#92400e';
    toast('对数视角', 'info');
  }
  renderSpreadsheet();
}

// ============================================================
// 初始化
// ============================================================
document.getElementById('workYear').addEventListener('change', () => {
  _workRowData = {};
  _workRowCounter = 0;
  loadWorkRecords();
});
document.getElementById('workMonth').addEventListener('change', () => {
  _workRowData = {};
  _workRowCounter = 0;
  loadWorkRecords();
});
