// ============================================================
// 做货编辑 - 最终版 (v2.2.10)
// 核心：完全不合并，每条 DB 记录 = 一行
// - 新增行：rowId=_weRowCounter++，lineId=_weMaxLineId++
// - DB 行：rowId=r.id，lineId=r.line_id
// - 排序：lineId DESC（新增行在前，刷新后顺序不变）
// ============================================================

// 全局状态
let _weRowMap = {};     // { rowId: { orderId, modelId, lineId, emps: {empId: qty} } }
let _weRowCounter = 0;  // 新增行的 rowId 起始（正整数递增）
let _weMaxLineId = 0;   // 当前年月最大 lineId（新增行从这里递增）

// ─────────────────────────────────────────────────────────
// loadWorkRecords：每条 DB 记录独立一行，不合并
// ─────────────────────────────────────────────────────────
async function loadWorkRecords() {
  const year = parseInt(document.getElementById('workYear').value);
  const month = parseInt(document.getElementById('workMonth').value);
  _state.currentYear = year;
  _state.currentMonth = month;

  const wasWageView = _state.viewMode === 'wage';

  const data = await get(`/api/work-records?year=${year}&month=${month}`);
  _state.workEmployees = data.employees || [];
  _state.workModels = data.models || [];
  _state.workOrders = data.orders || [];
  _state.workOrderModels = data.order_models || {};
  _state.workRecords = data.records || [];

  // 重置
  _weRowMap = {};
  _weRowCounter = 0;
  _weMaxLineId = 0;

  // 按 (orderId, modelId, lineId) 分组，同一行的多个员工合并到一个 emps 对象
  for (const r of _state.workRecords) {
    if (!r.order_id || !r.model_id) continue;
    const orderId = r.order_id;
    const modelId = r.model_id;
    const lineId = r.line_id || 0;
    const rowKey = `${orderId},${modelId},${lineId}`;  // 逻辑行唯一标识
    if (lineId > _weMaxLineId) _weMaxLineId = lineId;

    if (!_weRowMap[rowKey]) {
      _weRowMap[rowKey] = {
        rowId: orderId * 10000 + modelId * 10 + lineId,  // 稳定数字 ID（供 render/spreadsheet 使用）
        orderId,
        modelId,
        lineId,
        lineDbIds: [r.id],  // 该行所有 DB 记录 ids（用于删除）
        emps: {}
      };
    } else {
      _weRowMap[rowKey].lineDbIds.push(r.id);
    }
    _weRowMap[rowKey].emps[r.emp_id] = r.quantity;
  }

  if (wasWageView) {
    _state.wageDetail = await get(`/api/wage-detail?year=${year}&month=${month}`);
  } else {
    _state.wageDetail = null;
  }

  // 保存初始状态到历史栈（清空之前的历史）
  clearHistory();
  pushHistory('work-edit');

  renderSpreadsheet();
}

// ─────────────────────────────────────────────────────────
// renderSpreadsheet：渲染表格
// 排序：lineId DESC（新增行 lineId 递增，所以新增行在前；DB 行按 lineId 升序）
// ─────────────────────────────────────────────────────────
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
  if (!orders.length) {
    wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请先在订单管理中添加订单</div></div>`;
    return;
  }

  const totalGroups = Math.ceil(emps.length / empsPerGroup);

  // 排序：new 前缀行排最前，其余按 lineId DESC（新增行 lineId 大排前，DB 行 lineId 小排后）
  const sortedKeys = Object.keys(_weRowMap).sort((a, b) => {
    const aIsNew = a.startsWith('new');
    const bIsNew = b.startsWith('new');
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    const la = _weRowMap[a] ? _weRowMap[a].lineId : 0;
    const lb = _weRowMap[b] ? _weRowMap[b].lineId : 0;
    return lb - la;  // lineId 大的在前
  });

  function calcCellWage(empId, empSubDeptId, modelId, qty) {
    if (!qty || qty <= 0) return 0;
    const priceKey = `${modelId},${empSubDeptId}`;
    const price = (_state.priceMap || {})[priceKey] || 0;
    return qty * price;
  }

  function calcRowTotal(rowData) {
    if (!rowData || rowData.modelId === 0) return 0;
    let total = 0;
    for (const emp of emps) {
      const qty = rowData.emps[emp.id] || 0;
      total += calcCellWage(emp.id, emp.sub_dept_id, rowData.modelId, qty);
    }
    return total;
  }

  function buildGroupTable(groupIdx, groupEmps, isOnlyGroup) {
    const stickyStyle = !isOnlyGroup ? 'left:0;' : '';

    const headerHtml = `<thead><tr>
      <th class="col-fixed" style="min-width:50px;background:#059669;color:#fff;${stickyStyle}z-index:21;">操作</th>
      <th class="col-fixed" style="min-width:100px;background:#059669;color:#fff;${stickyStyle}z-index:20;">订单号</th>
      <th class="col-fixed" style="min-width:90px;background:#059669;color:#fff;${stickyStyle}z-index:19;">型号</th>
      ${groupEmps.map(e => `<th style="min-width:70px;background:#d1fae5;color:#065f46;">
        <span class="member-list-name-color" onclick="showEmployeeDetail(${e.id})">${escHtml(e.name)}</span>
      </th>`).join('')}
      <th class="col-fixed" style="background:#fef9c3;color:#92400e;min-width:80px;${stickyStyle}z-index:19;">行合计</th>
    </tr></thead>`;

    let tbodyHtml = '<tbody>';
    for (const mapKey of sortedKeys) {
      const rowData = _weRowMap[mapKey];
      if (!rowData) continue;
      const { orderId, modelId, emps: empsMap } = rowData;
      const rowTotal = calcRowTotal(rowData);

      const empCells = groupEmps.map(emp => {
        const qty = empsMap[emp.id] || 0;
        if (isWage) {
          const wage = calcCellWage(emp.id, emp.sub_dept_id, modelId, qty);
          const displayVal = wage > 0 ? fmtCompact(wage) : '';
          const compact = String(displayVal).length > 6 ? ' compact' : '';
          return `<td>
            <div class="cell-input wage-cell-display${compact}"
              style="width:65px;text-align:right;"
              title="${wage > 0 ? '¥' + fmt(wage) : ''}">${displayVal}</div>
          </td>`;
        } else {
          // 非0值 → 浅蓝色；0值或空值 → 默认颜色
          const hasQty = qty > 0;
          const displayVal = qty >= 0 ? qty : '';
          const bgStyle = hasQty ? 'background:#bfdbfe;' : 'background:;';
          return `<td style="text-align:center;">
            <input type="number" min="0" class="cell-input" style="width:65px;${bgStyle}"
              value="${displayVal}" placeholder=""
              data-row="${mapKey}" data-emp="${emp.id}"
              onfocus="onWorkCellFocus(this)"
              onblur="onWorkCellBlur(this)"
              oninput="onWorkCellChange(this)"
              onkeydown="onWorkCellKeydown(event,this)">
          </td>`;
        }
      }).join('');

      const orderOptions = `<option value="0">请选择</option>` + orders.map(o =>
        `<option value="${o.id}"${o.id === orderId ? ' selected' : ''}>${escHtml(o.order_no)}</option>`
      ).join('');
      const modelOptions = `<option value="0">请选择</option>` + models.map(m =>
        `<option value="${m.id}"${m.id === modelId ? ' selected' : ''}>${escHtml(m.model_no)}</option>`
      ).join('');

      const totalDisplay = isWage ? (rowTotal > 0 ? fmtCompact(rowTotal) : '') : rowTotal;
      const compact = String(totalDisplay).length > 8 ? ' compact' : '';

      tbodyHtml += `<tr>
        <td class="col-fixed" style="text-align:center;${stickyStyle}z-index:7;">
          <button class="btn btn-sm"
            style="padding:4px 10px;font-size:11px;background:#fee2e2;color:#dc2626;"
            onclick="deleteWorkRow('${mapKey}')">删除</button>
        </td>
        <td class="col-fixed" style="background:#d1fae5;${stickyStyle}z-index:6;">
          <select class="cell-input"
            style="background:#d1fae5;font-weight:600;min-width:80px;"
            data-row="${mapKey}" data-type="order"
            onchange="onWorkSelectChange(this)">
            ${orderOptions}
          </select>
        </td>
        <td class="col-fixed" style="background:#d1fae5;${stickyStyle}z-index:5;">
          <select class="cell-input"
            style="background:#d1fae5;font-weight:600;min-width:70px;"
            data-row="${mapKey}" data-type="model"
            onchange="onWorkSelectChange(this)">
            ${modelOptions}
          </select>
        </td>
        ${empCells}
        <td class="col-fixed row-total${isWage ? ' wage' : ''}${compact}"
          style="font-weight:700;text-align:center;background:#fef9c3;color:#92400e;${stickyStyle}z-index:5;">
          ${totalDisplay}
        </td>
      </tr>`;
    }
    tbodyHtml += '</tbody>';
    return `<table class="spreadsheet${isWage?' wage-view':''}${isSingleMode?' single-table-mode':''}">${headerHtml}${tbodyHtml}</table>`;
  }

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

// ─────────────────────────────────────────────────────────
// onWorkCellFocus：单元格获得焦点 → 记录编辑会话开始
// ─────────────────────────────────────────────────────────
function onWorkCellFocus(el) {
  const mapKey = el.dataset.row;
  const empId = parseInt(el.dataset.emp);
  const currentVal = _weRowMap[mapKey]?.emps[empId] || 0;

  _editSession = {
    type: 'work-edit',
    mapKey: mapKey,
    empId: empId,
    originalValue: currentVal
  };

  // 如果值为0或空，清空输入框方便输入
  if (el.value === '0' || el.value === '') {
    el.value = '';
  }
}

// ─────────────────────────────────────────────────────────
// onWorkCellBlur：单元格失去焦点 → 检查值变化并保存历史
// ─────────────────────────────────────────────────────────
function onWorkCellBlur(el) {
  const mapKey = el.dataset.row;
  const empId = parseInt(el.dataset.emp);
  const rawVal = el.value.trim();
  const val = rawVal === '' ? 0 : (parseInt(rawVal) || 0);

  // 检查值是否变化，变化才保存历史（按单元格撤销）
  let hasChanged = false;
  if (_editSession && _editSession.type === 'work-edit') {
    if (_editSession.mapKey === mapKey && _editSession.empId === empId) {
      if (val !== _editSession.originalValue) {
        pushHistory('work-edit');
        hasChanged = true;
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
    clearTimeout(window._weAutoSaveTimer);
    window._weAutoSaveTimer = setTimeout(() => autoSaveWorkRecords(), 300);
  }
}

// ─────────────────────────────────────────────────────────
// onWorkCellChange：单元格输入 → 实时更新显示，blur时才保存历史
// - 按单元格撤销：focus时记录原始值，blur时如果值变化才保存历史
// - 空值视为0存入emps（不删除key，下次渲染显示0）
// - 显式填0 → 存入0
// - 非0值 → 存入该值，格子变浅蓝色
// - 0值 → 保留key（下次渲染显示0），默认颜色
// ─────────────────────────────────────────────────────────
function onWorkCellChange(el) {
  const mapKey = el.dataset.row;
  const empId = parseInt(el.dataset.emp);
  const rawVal = el.value.trim();
  const val = rawVal === '' ? 0 : (parseInt(rawVal) || 0);

  if (!_weRowMap[mapKey]) return;

  // 实时更新显示，但不保存历史
  if (val === 0) {
    _weRowMap[mapKey].emps[empId] = 0;
    el.style.background = '';
  } else {
    _weRowMap[mapKey].emps[empId] = val;
    el.style.background = '#bfdbfe';
  }

  updateRowTotal(mapKey);
  clearTimeout(window._weAutoSaveTimer);
  window._weAutoSaveTimer = setTimeout(() => autoSaveWorkRecords(), 300);
}

// ─────────────────────────────────────────────────────────
// onWorkCellKeydown：Tab 键在同行格之间跳转
// ─────────────────────────────────────────────────────────
function onWorkCellKeydown(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowId = el.dataset.row;
    const allInputs = Array.from(
      document.querySelectorAll(`#spreadsheetWrap td input[data-row="${rowId}"]`)
    );
    const curIdx = allInputs.indexOf(el);
    if (curIdx >= 0) {
      const nextIdx = (curIdx + 1) % allInputs.length;
      allInputs[nextIdx].focus();
    }
  }
}

// ─────────────────────────────────────────────────────────
// onWorkSelectChange：改订单/型号下拉 → 更新 combo，选了有效 combo 才操作 DB
// - 回到"请选择"(0)：只更新下拉状态，保留 lineId 和旧 DB 记录（不删）
// - 选择有效 combo：
//   - 若旧 combo 也是有效的 → 删旧 DB 记录，autoSave 保存新 combo
//   - 若旧 combo 无效(lineId=0) → 分配 lineId，autoSave 保存新 combo
// ─────────────────────────────────────────────────────────
async function onWorkSelectChange(sel) {
  const mapKey = sel.dataset.row;    // 直接用字符串 key（不再 parseInt）
  const type = sel.dataset.type;
  const newVal = parseInt(sel.value);
  const rowData = _weRowMap[mapKey];
  if (!rowData) return;

  const oldOrderId = rowData.orderId;
  const oldModelId = rowData.modelId;
  const newOrderId = type === 'order' ? newVal : oldOrderId;
  const newModelId = type === 'model' ? newVal : oldModelId;

  if (newOrderId === oldOrderId && newModelId === oldModelId) return;

  const year = _state.currentYear;
  const month = _state.currentMonth;
  const oldLineId = rowData.lineId;

  // 回到"请选择"：只更新状态，保留 lineId（旧 DB 记录不删）
  if (newOrderId === 0 || newModelId === 0) {
    // 保存历史记录（修改前保存）
    pushHistory('work-edit');
    rowData.orderId = newOrderId;
    rowData.modelId = newModelId;
    renderSpreadsheet();
    return;
  }

  // 新 combo 有效：若旧 combo 也有效则删旧记录
  if (oldOrderId > 0 && oldModelId > 0 && oldLineId > 0) {
    await del(`/api/work-row?year=${year}&month=${month}&order_id=${oldOrderId}&model_id=${oldModelId}&line_id=${oldLineId}`);
  }

  // 若 lineId=0（从未保存过的新行），分配一个
  if (rowData.lineId === 0) {
    rowData.lineId = ++_weMaxLineId;
  }

  rowData.orderId = newOrderId;
  rowData.modelId = newModelId;

  // 如果 combo（orderId,modelId）变了，需要把行移到新 key 下（JS 对象不支持 key 重命名）
  const isNewRow = mapKey.startsWith('new');
  const newKey = isNewRow
    ? `new,${newModelId},${rowData.lineId}`  // 新增行 key 格式保持 new 前缀
    : `${newOrderId},${newModelId},${rowData.lineId}`;
  if (newKey !== mapKey) {
    _weRowMap[newKey] = rowData;
    delete _weRowMap[mapKey];
  }

  // 保存历史记录（修改后保存，确保 key 一致）
  pushHistory('work-edit');

  // emps 保留（用户可能已填了对数）
  renderSpreadsheet();
  autoSaveWorkRecords();
}

// ─────────────────────────────────────────────────────────
// addWorkRow：新增一行（分配 lineId = ++_weMaxLineId，排在最前）
// ─────────────────────────────────────────────────────────
function addWorkRow() {
  const orders = _state.workOrders || [];
  const models = _state.workModels || [];
  const newLineId = ++_weMaxLineId;
  const rowKey = `new,0,${newLineId}`;
  const numericRowId = _weRowCounter++;

  // 订单默认"未知"(id=999999)；型号默认第一个（型号表为空则待选择）
  const defaultOrderId = 999999;
  const defaultModelId = models.length > 0 ? models[0].id : 0;

  _weRowMap[rowKey] = {
    rowId: numericRowId,
    orderId: defaultOrderId,
    modelId: defaultModelId,
    lineId: newLineId,
    lineDbIds: [],
    emps: {}
  };

  // 立即保存一行（用第一个员工的0值作为占位，让行进入数据库）
  const firstEmp = (_state.workEmployees || [])[0];
  if (firstEmp) {
    const empId = firstEmp.id;
    post('/api/work-records', {
      year: _state.currentYear,
      month: _state.currentMonth,
      order_id: defaultOrderId,
      model_id: defaultModelId,
      emp_id: empId,
      quantity: 0,
      line_id: newLineId
    }).catch(e => console.error('保存新行失败', e));
  }

  // 保存历史记录（添加行后保存，确保包含新行）
  pushHistory('work-edit');

  renderSpreadsheet();

  setTimeout(() => {
    const inp = document.querySelector(`#spreadsheetWrap input[data-row="${numericRowId}"]`);
    if (inp) inp.focus();
  }, 50);
}

// ─────────────────────────────────────────────────────────
// deleteWorkRow：删除一行
// - lineId > 0（已保存）：调 DELETE /api/work-row 删整行
// - lineId = 0（新增未保存）：只从 UI 移除
// ─────────────────────────────────────────────────────────
async function deleteWorkRow(rowId) {
  const rowData = _weRowMap[rowId];
  if (!rowData) return;

  const { orderId, modelId, lineId } = rowData;

  delete _weRowMap[rowId];

  // 保存历史记录（删除行后保存，确保不包含已删除的行）
  pushHistory('work-edit');

  renderSpreadsheet();

  if (lineId > 0) {
    const year = _state.currentYear;
    const month = _state.currentMonth;
    try {
      await del(`/api/work-row?year=${year}&month=${month}&order_id=${orderId}&model_id=${modelId}&line_id=${lineId}`);
    } catch (e) {
      console.error('删除行记录失败', e);
    }
  }

  toast('已删除', 'success');
}

// ─────────────────────────────────────────────────────────
// updateRowTotal：即时更新行合计（不重渲染整表）
// ─────────────────────────────────────────────────────────
function updateRowTotal(rowId) {
  const rowData = _weRowMap[rowId];
  if (!rowData) return;

  const emps = _state.workEmployees || [];
  const isWage = _state.viewMode === 'wage';
  let rowTotal = 0;

  if (isWage) {
    for (const emp of emps) {
      const qty = rowData.emps[emp.id] || 0;
      rowTotal += calcCellWage(emp.id, emp.sub_dept_id, rowData.modelId, qty);
    }
  } else {
    for (const emp of emps) {
      rowTotal += rowData.emps[emp.id] || 0;
    }
  }

  const displayVal = isWage ? (rowTotal > 0 ? fmtCompact(rowTotal) : '') : rowTotal;
  const compact = String(displayVal).length > 8 ? ' compact' : '';
  const allTables = document.querySelectorAll('#spreadsheetWrap .spreadsheet');
  for (const tbl of allTables) {
    const rowTr = tbl.querySelector(`tr:has(button[onclick="deleteWorkRow(${rowId})"])`);
    if (rowTr) {
      const totalEl = rowTr.querySelector('.row-total');
      if (totalEl) {
        totalEl.textContent = displayVal;
        totalEl.className = `col-fixed row-total${isWage ? ' wage' : ''}${compact}`;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// calcCellWage：工资计算
// ─────────────────────────────────────────────────────────
function calcCellWage(empId, empSubDeptId, modelId, qty) {
  if (!qty || qty <= 0) return 0;
  const priceKey = `${modelId},${empSubDeptId}`;
  const price = (_state.priceMap || {})[priceKey] || 0;
  return qty * price;
}

// ─────────────────────────────────────────────────────────
// toggleViewMode：切换工资视角
// ─────────────────────────────────────────────────────────
async function toggleViewMode() {
  const year = _state.currentYear;
  const month = _state.currentMonth;

  if (_state.viewMode === 'qty') {
    await autoSaveWorkRecords();
    _state.wageDetail = await get(`/api/wage-detail?year=${year}&month=${month}`);
    if (_state.wageDetail && _state.wageDetail.price_map) {
      _state.priceMap = _state.wageDetail.price_map;
    }
    _state.viewMode = 'wage';
    const btn = document.getElementById('viewModeBtn');
    btn.textContent = '切换对数视角';
    btn.style.background = '#dcfce7';
    btn.style.color = '#15803d';
    toast('工资视角：对数 × 单价', 'info');
  } else {
    _state.viewMode = 'qty';
    _state.wageDetail = null;
    const btn = document.getElementById('viewModeBtn');
    btn.textContent = '切换工资视角';
    btn.style.background = '#fef3c7';
    btn.style.color = '#92400e';
    toast('对数视角', 'info');
  }
  renderSpreadsheet();
}

// ─────────────────────────────────────────────────────────
// autoSaveWorkRecords：自动保存每条记录
// - qty >= 0：保存到 DB（包括 0 值）
// - qty < 0 或 combo 未完成：不保存（也不删）
// - 对于撤销操作，需要先获取当前数据库中的所有记录，删除不在 _weRowMap 中的行
// ─────────────────────────────────────────────────────────
async function autoSaveWorkRecords() {
  const year = _state.currentYear;
  const month = _state.currentMonth;
  if (!year || !month) return;

  // 先获取当前数据库中的所有记录
  let dbRecords = [];
  try {
    const data = await get(`/api/work-records?year=${year}&month=${month}`);
    dbRecords = data.records || [];
  } catch (e) {
    console.error('获取现有记录失败', e);
  }

  // 构建当前 _weRowMap 中的所有行标识
  const currentRowKeys = new Set();
  for (const [rowKey, rowData] of Object.entries(_weRowMap)) {
    const { orderId, modelId, lineId } = rowData;
    if (lineId > 0) {
      currentRowKeys.add(`${orderId},${modelId},${lineId}`);
    }
  }

  // 删除数据库中不在当前 _weRowMap 中的行（撤销删除行时需要）
  for (const r of dbRecords) {
    const dbKey = `${r.order_id},${r.model_id},${r.line_id || 0}`;
    if (!currentRowKeys.has(dbKey)) {
      try {
        await del(`/api/work-row?year=${year}&month=${month}&order_id=${r.order_id}&model_id=${r.model_id}&line_id=${r.line_id || 0}`);
      } catch (e) {
        console.error('删除旧记录失败', e);
      }
    }
  }

  // 保存当前 _weRowMap 中的所有记录
  for (const [rowKey, rowData] of Object.entries(_weRowMap)) {
    const { orderId, modelId, lineId, emps } = rowData;
    // 订单未选：跳过；型号未选(modelId=0)：正常保存（允许未知型号）

    for (const [empId, qty] of Object.entries(emps)) {
      const empNum = parseInt(empId);
      try {
        if (qty >= 0) {
          // 0值也保存到DB（表示格子有填过0），负数跳过
          await post('/api/work-records', {
            year, month,
            order_id: orderId,
            model_id: modelId,
            emp_id: empNum,
            quantity: qty,
            line_id: lineId
          });
        } else {
          // 负数视为无效，删除该记录
          await del(`/api/work-records?year=${year}&month=${month}&order_id=${orderId}&model_id=${modelId}&emp_id=${empNum}&line_id=${lineId}`);
        }
      } catch (e) {
        console.error('保存做货记录失败', e);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// clearAllWorkQty：清除所有对数（保留行结构，只清空员工对数）
// ─────────────────────────────────────────────────────────
async function clearAllWorkQty() {
  if (!confirm('确定要清除当前所有对数吗？此操作不可撤销。')) return;

  // 保存历史记录（清除前）
  pushHistory('work-edit');

  // 清空所有行的员工对数
  for (const rowData of Object.values(_weRowMap)) {
    rowData.emps = {};
  }

  // 重新渲染表格
  renderSpreadsheet();

  // 自动保存到数据库
  await autoSaveWorkRecords();

  toast('已清除所有对数', 'success');
}

// ─────────────────────────────────────────────────────────
// 年月切换
// ─────────────────────────────────────────────────────────
document.getElementById('workYear').addEventListener('change', () => {
  _weRowMap = {};
  _weRowCounter = 0;
  _weMaxLineId = 0;
  loadWorkRecords();
});
document.getElementById('workMonth').addEventListener('change', () => {
  _weRowMap = {};
  _weRowCounter = 0;
  _weMaxLineId = 0;
  loadWorkRecords();
});
