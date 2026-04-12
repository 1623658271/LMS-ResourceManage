// ============================================================
// 做货编辑
// ============================================================
async function loadWorkRecords() {
  const year = parseInt(document.getElementById('workYear').value);
  const month = parseInt(document.getElementById('workMonth').value);
  _state.currentYear = year; _state.currentMonth = month;
  // 保存 pending 状态（年月切换时保留，但首次加载不保留）
  const isFirstLoad = !_state.workEmployees || _state.workEmployees.length === 0;
  let savedDirty = {}, savedTempRows = [], savedDeletedKeys = new Set(), savedTempCounter = 0;
  if (!isFirstLoad) {
    savedDirty = { ..._dirtyCells };
    savedTempRows = [...(_state.tempWorkRows || [])];
    savedDeletedKeys = new Set(_deletedRowKeys || []);
    savedTempCounter = _tempRowCounter || 0;
  } else {
    // 首次加载或切换年月时重置所有状态
    _dirtyCells = {};
    _deletedRowKeys = new Set();
    _state.tempWorkRows = [];
    _tempRowCounter = 0;
  }
  const data = await get(`/api/work-records?year=${year}&month=${month}`);
  _state.workEmployees = data.employees || [];
  _state.workModels = data.models || [];
  _state.workOrders = data.orders || [];
  _state.workOrderModels = data.order_models || {};
  _state.workRecords = data.records || [];
  if (!isFirstLoad) {
    _dirtyCells = savedDirty;
    _deletedRowKeys = savedDeletedKeys;
    _state.tempWorkRows = savedTempRows;
    _tempRowCounter = savedTempCounter;
  }
  _state.wageDetail = null;
  renderSpreadsheet();
}

function renderSpreadsheet() {
  const emps = _state.workEmployees;
  const orders = _state.workOrders;
  const orderModels = _state.workOrderModels;
  const records = _state.workRecords;
  const wrap = document.getElementById('spreadsheetWrap');
  const isWage = _state.viewMode === 'wage';
  const isSingleMode = _currentSettings['table-displayMode'] === 'single';
  const empsPerGroup = isSingleMode ? emps.length : parseInt(_currentSettings['table-groupSize'] || 8);

  if (!emps.length) {
    wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请先在成员管理中添加员工</div></div>`;
    return;
  }

  // 数据映射
  const dataMap = {};
  for (const r of records) {
    if (!dataMap[r.order_id]) dataMap[r.order_id] = {};
    if (!dataMap[r.order_id][r.model_id]) dataMap[r.order_id][r.model_id] = {};
    dataMap[r.order_id][r.model_id][r.emp_id] = r.quantity;
  }

  // 行（订单+型号），跳过已删除的行
  // 允许任意重复订单+型号组合（允许同一订单+同型号的多行存在）
  const rows = [];

  // 1. 添加临时行（按对象结构，每行有独立的 orderId/modelId）
  const tempRows = _state.tempWorkRows || [];
  tempRows.forEach(tRow => {
    rows.push({ temp_id: tRow.tempId, order_id: tRow.orderId, model_id: tRow.modelId });
  });

  // 2. 从数据库记录构建行（保持数据库顺序）
  for (const r of records) {
    if (!r.order_id || !r.model_id) continue;
    const combo = `${r.order_id},${r.model_id}`;
    if (_deletedRowKeys.has(combo)) continue;
    // 避免与临时行重复（同一订单+型号+temp_id）
    const exists = rows.some(row => row.order_id === r.order_id && row.model_id === r.model_id && !row.temp_id);
    if (!exists) {
      rows.push({ order_id: r.order_id, model_id: r.model_id });
    }
  }
  // 注：不再从 _dirtyCells 构建行，防止多出行

  const empIds = emps.map(e => e.id);
  const totalGroups = Math.ceil(emps.length / empsPerGroup);

  // 计算行合计（对数 or 工资，基于全部员工）
  function calcRowTotal(orderId, modelId) {
    // 虚拟行（未选择订单/型号）不计算
    if (orderId == null || modelId == null) return 0;
    let total = 0;
    for (const empId of empIds) {
      const key = `${orderId},${modelId},${empId}`;
      if (isWage && _state.wageDetail) {
        total += _state.wageDetail.wages[key] || 0;
      } else {
        const qty = _dirtyCells[`${orderId}|${modelId}|${empId}`] ?? dataMap[orderId]?.[modelId]?.[empId] ?? 0;
        total += qty;
      }
    }
    return total;
  }

  // 生成分组表格 HTML
  function buildGroupTable(groupIdx, groupEmps, isOnlyGroup) {
    const headerHtml = `<thead><tr>
      <th class="col-fixed" style="min-width:60px;background:#059669;color:#fff;${isOnlyGroup?'left:0;z-index:21;':''}">操作</th>
      <th class="col-fixed" style="min-width:100px;background:#059669;color:#fff;${isOnlyGroup?'left:60px;z-index:21;':''}">订单号</th>
      <th class="col-fixed-2" style="min-width:90px;background:#059669;color:#fff;${isOnlyGroup?'left:160px;z-index:21;':''}">型号</th>
      ${groupEmps.map(e => `<th style="min-width:70px;background:#d1fae5;color:#065f46;">
        <span class="member-list-name-color" onclick="showEmployeeDetail(${e.id})">${escHtml(e.name)}</span>
      </th>`).join('')}
      <th class="col-fixed" style="background:#fef9c3;color:#92400e;min-width:80px;${isOnlyGroup?'left:60px;z-index:21;':''}">行合计</th>
    </tr></thead>`;

    let tbodyHtml = '<tbody>';
    rows.forEach(row => {
      const isTemp = !!row.temp_id;
      const { order_id, model_id } = row;
      const availModels = orderModels[String(order_id)] || [];
      const rowTotal = calcRowTotal(order_id, model_id);
      const empCells = groupEmps.map(emp => {
        const key = `${order_id}|${model_id}|${emp.id}`;
        // 工资视角只对实体行显示
        if (isWage && _state.wageDetail && !isTemp) {
          const wageKey = `${order_id},${model_id},${emp.id}`;
          const wage = _state.wageDetail.wages[wageKey] || 0;
          const displayVal = wage > 0 ? fmtCompact(wage) : '';
          const compactClass = String(displayVal).length > 6 ? ' compact' : '';
          return `<td>
            <div class="cell-input wage-cell-display${compactClass}" data-key="${key}"
              style="width:65px;text-align:right;padding:0 5px;box-sizing:border-box;"
              title="${wage > 0 ? '¥' + fmt(wage) : ''}">${displayVal}</div>
          </td>`;
        } else {
          const val = _dirtyCells[key] ?? (dataMap[order_id]?.[model_id]?.[emp.id] ?? '');
          return `<td>
            <input type="number" min="0" class="cell-input emp-cell"
              style="width:65px;"
              value="${val || ''}" placeholder="0"
              data-key="${key}"
              onchange="onCellChange(this)" onkeydown="onCellKeydown(event,this)">
          </td>`;
        }
      }).join('');
      const totalDisplay = isWage ? (rowTotal > 0 ? fmtCompact(rowTotal) : '') : (isTemp ? '' : rowTotal);
      const compactTotal = String(totalDisplay).length > 8 ? ' compact' : '';
      const tempRowId = isTemp ? row.temp_id : '';
      // rowKey 含 groupIdx，保证同一订单+型号的多行也各有唯一 key
      const rowKey = isTemp ? tempRowId : `${order_id}|${model_id}|g${groupIdx}`;
      // 订单下拉：临时行/实体行都保留已选状态
      const orderOptions = `<option value="">-- 订单 --</option>` + orders.map(o =>
        `<option value="${o.id}"${o.id === order_id ? ' selected' : ''}>${escHtml(o.order_no)}</option>`
      ).join('');
      // 型号下拉：显示所有型号（取消订单→型号强依赖）
      const allModels = _state.workModels || [];
      const modelOptions = allModels.length > 0 ? allModels.map(m =>
        `<option value="${m.id}"${m.id === model_id ? ' selected' : ''}>${escHtml(m.model_no)}</option>`
      ).join('') : '';
      tbodyHtml += `<tr data-row-key="${rowKey}" ${isTemp ? `data-temp-id="${tempRowId}"` : ''}>
        <td class="col-fixed" style="text-align:center;${isOnlyGroup?'left:0;z-index:7;':''}">
          ${isTemp ? `<button class="btn btn-sm btn-danger" style="padding:4px 10px;font-size:11px;" onclick="deleteTempRow('${tempRowId}')">删除</button>` : `<button class="btn btn-sm btn-danger" style="padding:4px 10px;font-size:11px;" onclick="deleteWorkRow('${rowKey}')">删除</button>`}
        </td>
        <td class="col-fixed" style="background:#d1fae5;${isOnlyGroup?'left:60px;z-index:6;':''}">
          <select class="cell-input order-cell" style="background:#d1fae5;font-weight:600;" data-row-key="${rowKey}" data-temp="${isTemp ? tempRowId : ''}" onchange="onOrderCellChange(this)">
            ${orderOptions}
          </select>
        </td>
        <td class="col-fixed-2" style="background:#d1fae5;${isOnlyGroup?'left:160px;z-index:5;':''}">
          <select class="cell-input model-cell" style="background:#d1fae5;font-weight:600;" data-row-key="${rowKey}" data-temp="${isTemp ? tempRowId : ''}" onchange="onModelCellChange(this)">
            ${allModels.length === 0 ? '<option value="">-- 无型号 --</option>' : modelOptions}
          </select>
        </td>
        ${empCells}
        <td class="col-fixed row-total${isWage?' wage':''}${compactTotal}" style="font-weight:700;text-align:center;background:#fef9c3;color:#92400e;${isOnlyGroup?'left:60px;z-index:6;':''}">${totalDisplay}</td>
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

function onCellChange(el) {
  const key = el.dataset.key;
  if (!key) return;
  const val = el.value;
  const parts = key.split('|');
  if (parts.length !== 3) return;
  const orderId = parseInt(parts[0]);
  const modelId = parseInt(parts[1]);
  
  // 空值或0时清除，并触发删除API（如果原来是有效值）
  if (val === '' || val === '0') {
    const oldVal = _dirtyCells[key];
    delete _dirtyCells[key];
    el.style.background = '';
    // 如果原来是有效值，触发自动删除
    if (oldVal !== undefined && oldVal > 0) {
      autoSaveWorkRecords();
    }
  } else {
    _dirtyCells[key] = parseInt(val) || 0;
    el.style.background = '#fef9c3';
    // 立即自动保存
    autoSaveWorkRecords();
  }

  // 更新当前行所有表格中的行合计（跨分组）
  const rowTr = el.closest('tr');
  if (rowTr) {
    let rowSum = 0;
    for (const inp of rowTr.querySelectorAll('.emp-cell')) {
      rowSum += parseInt(inp.value) || 0;
    }
    const totalDisplay = rowSum;
    const totalTd = rowTr.querySelector('.row-total');
    if (totalTd) {
      totalTd.textContent = totalDisplay;
      if (String(totalDisplay).length > 8) totalTd.classList.add('compact');
      else totalTd.classList.remove('compact');
    }
  }
}

function onCellKeydown(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const tr = el.closest('tr');
    // 在当前行内导航（同组员工 input）
    const allEmpInputs = Array.from(tr.querySelectorAll('input.emp-cell'));
    const curIdx = allEmpInputs.indexOf(el);
    if (curIdx >= 0) {
      const nextIdx = (curIdx + 1) % allEmpInputs.length;
      allEmpInputs[nextIdx].focus();
    } else {
      const firstInput = tr.querySelector('input.emp-cell');
      if (firstInput) firstInput.focus();
    }
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    el.blur(); // 触发 onchange，然后由 debounce 处理保存
  }
}

// 订单单元格变更：更新行状态，重新渲染（临时行/实体行统一处理）
function onOrderCellChange(orderSel) {
  const newOrderId = parseInt(orderSel.value);
  const tr = orderSel.closest('tr');
  const tempId = orderSel.dataset.temp;

  if (tempId) {
    // 临时行：更新该行的 orderId
    const tRows = _state.tempWorkRows || [];
    const row = tRows.find(r => r.tempId === tempId);
    if (row) row.orderId = newOrderId;
    // 清除该行旧的 _dirtyCells key（所有 orderId/modelId 组合）
    const emps = _state.workEmployees || [];
    const modelSel = tr.querySelector('.model-cell');
    const modelId = parseInt(modelSel ? modelSel.value : 0);
    for (const emp of emps) {
      delete _dirtyCells[`${newOrderId},${modelId},${emp.id}`];
    }
    // 触发自动保存
    autoSaveWorkRecords();
  } else {
    // 实体行：只更新型号下拉选项（型号显示所有，不再过滤）
    const modelSel = tr.querySelector('.model-cell');
    const allModels = _state.workModels || [];
    if (modelSel && allModels.length > 0) {
      const currentModelId = parseInt(modelSel.value) || 0;
      modelSel.innerHTML = allModels.map(m => 
        `<option value="${m.id}"${m.id === currentModelId ? ' selected' : ''}>${escHtml(m.model_no)}</option>`
      ).join('');
    }
  }
}

// 型号单元格变更：更新行状态，触发自动保存
function onModelCellChange(modelSel) {
  const tr = modelSel.closest('tr');
  const tempId = modelSel.dataset.temp;
  const newModelId = parseInt(modelSel.value);
  const orderSel = tr.querySelector('.order-cell');
  const orderId = parseInt(orderSel ? orderSel.value : 0);

  if (tempId) {
    // 临时行：更新该行的 modelId
    const tRows = _state.tempWorkRows || [];
    const row = tRows.find(r => r.tempId === tempId);
    if (row) row.modelId = newModelId;
    // 清除该行旧的格子数据
    const emps = _state.workEmployees || [];
    for (const emp of emps) {
      delete _dirtyCells[`${orderId},${newModelId},${emp.id}`];
    }
  } else {
    // 实体行：重绑定 _dirtyCells 的 key
    const rowKey = tr.dataset.rowKey || '';
    if (rowKey && orderId && newModelId) {
      const oldPrefix = rowKey.replace(/\|g\d+$/, '') + '|';
      const newPrefix = `${orderId}|${newModelId}|`;
      // 收集需要迁移的键值
      const entries = Object.entries(_dirtyCells);
      for (const [key, val] of entries) {
        if (key.startsWith(oldPrefix)) {
          const empPart = key.split('|').slice(2).join('|');
          const newKey = newPrefix + empPart;
          _dirtyCells[newKey] = val;
          delete _dirtyCells[key];
        }
      }
      // 更新 DOM 中的 data-key
      for (const inp of tr.querySelectorAll('input.emp-cell')) {
        if (inp.dataset.key && inp.dataset.key.startsWith(oldPrefix)) {
          const empPart = inp.dataset.key.split('|').slice(2).join('|');
          inp.dataset.key = newPrefix + empPart;
        }
      }
      tr.dataset.rowKey = `${orderId}|${newModelId}|g0`;
    }
  }
  // 触发自动保存
  autoSaveWorkRecords();
}

function onRowHeaderChange(el) {
  const rowKey = el.dataset.rowKey;
  if (!rowKey) return;
  for (const key of Object.keys(_dirtyCells)) {
    if (key.startsWith(rowKey)) delete _dirtyCells[key];
  }
  renderSpreadsheet();
}

// 添加一行（直接添加临时行，用户可以立即选择订单和型号）
function addWorkRow() {
  const tempId = '__TEMP__' + (_tempRowCounter++);
  _state.tempWorkRows = _state.tempWorkRows || [];
  // 每行独立存储 orderId=0, modelId=0（待选择）
  _state.tempWorkRows.push({ tempId, orderId: 0, modelId: 0 });
  renderSpreadsheet();
  setTimeout(() => {
    const sel = document.querySelector(`tr[data-temp-id="${tempId}"] .order-cell`);
    if (sel) sel.focus();
  }, 50);
}

// 删除临时行
function deleteTempRow(tempId) {
  const tRows = _state.tempWorkRows || [];
  const row = tRows.find(r => r.tempId === tempId);
  if (!row) return;
  const { orderId, modelId } = row;
  // 清除该行所有员工的格子数据
  const emps = _state.workEmployees || [];
  for (const emp of emps) {
    delete _dirtyCells[`${orderId},${modelId},${emp.id}`];
  }
  _state.tempWorkRows = tRows.filter(r => r.tempId !== tempId);
  renderSpreadsheet();
}

// rowKey 格式：实体行=`${orderId}|${modelId}|g${groupIdx}`，临时行=`__TEMP__${id}`
function deleteWorkRow(rowKey) {
  if (!confirm('确定删除这一行数据吗？')) return;
  const year = _state.currentYear, month = _state.currentMonth;

  if (rowKey.startsWith('__TEMP__')) {
    // 临时行：已经在 deleteTempRow 中处理，这里不会走到
    deleteTempRow(rowKey);
    toast('已删除', 'success');
  } else {
    // 实体行：含 g${groupIdx} 后缀，用 orderId,modelId 调用批量删除 API
    const parts = rowKey.split('|');
    if (parts.length !== 3) return;
    const orderId = parseInt(parts[0]);
    const modelId = parseInt(parts[1]);
    if (!orderId || !modelId) return;
    
    // 先清除 _dirtyCells 中对应行实例的数据
    const emps = _state.workEmployees || [];
    for (const emp of emps) {
      delete _dirtyCells[`${orderId},${modelId},${emp.id}`];
    }
    
    fetch(`/api/work-row?year=${year}&month=${month}&order_id=${orderId}&model_id=${modelId}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(() => {
        // 从本地 records 中移除该 order+model 的记录
        _state.workRecords = _state.workRecords.filter(r =>
          !(r.order_id === orderId && r.model_id === modelId)
        );
        renderSpreadsheet();
        toast('已删除', 'success');
      })
      .catch(err => { console.error(err); toast('删除失败', 'error'); });
  }
}

async function saveAllWorkRecords() {
  const year = _state.currentYear, month = _state.currentMonth;
  let saved = 0;
  const keysToSave = Object.keys(_dirtyCells);
  for (const key of keysToSave) {
    const parts = key.split('|');
    if (parts.length !== 3) continue;
    const orderId = parseInt(parts[0]);
    const modelId = parseInt(parts[1]);
    const empId = parseInt(parts[2]);
    if (!orderId) continue;
    const val = _dirtyCells[key];
    if (val !== undefined && val !== null && val !== '' && val > 0) {
      await post('/api/work-records', { year, month, order_id: orderId, model_id: modelId, emp_id: empId, quantity: val });
      saved++;
    }
    delete _dirtyCells[key];
  }
  toast(`已保存 ${saved} 条记录`, 'success');
  // 重载服务端数据，loadWorkRecords 自动保留 pending 状态
  await loadWorkRecords();
}

async function toggleViewMode() {
  // 切换前先自动保存
  await autoSaveWorkRecords();

  if (_state.viewMode === 'qty') {
    // 切换到工资视角：先加载 wage-detail
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

// 自动保存做货编辑数据（静默保存，不提示）
let _workSaveBusy = false;
let _workSaveTimer = null;
async function autoSaveWorkRecords() {
  // 防抖：300ms 内多次调用只执行一次
  if (_workSaveTimer) {
    clearTimeout(_workSaveTimer);
  }
  _workSaveTimer = setTimeout(async () => {
    await _doAutoSave();
    _workSaveTimer = null;
  }, 300);
}

async function _doAutoSave() {
  if (_workSaveBusy) return;
  _workSaveBusy = true;
  const year = _state.currentYear, month = _state.currentMonth;
  const keysToSave = Object.keys(_dirtyCells);
  if (keysToSave.length === 0) {
    _workSaveBusy = false;
    return;
  }
  
  // 收集要保存和要删除的记录
  const toSave = [];
  const toDelete = [];
  for (const key of keysToSave) {
    const parts = key.split('|');
    if (parts.length !== 3) continue;
    const orderId = parseInt(parts[0]);
    const modelId = parseInt(parts[1]);
    const empId = parseInt(parts[2]);
    // 跳过未选择订单或型号的行
    if (!orderId || !modelId) continue;
    const val = _dirtyCells[key];
    if (val > 0) {
      toSave.push({ key, orderId, modelId, empId, val });
    } else {
      // 0值或负数：删除记录
      toDelete.push({ key, orderId, modelId, empId });
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
        quantity: item.val 
      });
    } catch(e) { console.error('保存失败', e); }
  }
  
  // 批量删除
  for (const item of toDelete) {
    try {
      await del(`/api/work-records?year=${year}&month=${month}&order_id=${item.orderId}&model_id=${item.modelId}&emp_id=${item.empId}`);
    } catch(e) { console.error('删除失败', e); }
  }
  
  // 清除已处理的键
  for (const item of [...toSave, ...toDelete]) {
    delete _dirtyCells[item.key];
  }
  
  // 重载服务端数据
  if (toSave.length > 0 || toDelete.length > 0) {
    const data = await get(`/api/work-records?year=${year}&month=${month}`);
    _state.workEmployees = data.employees || [];
    _state.workModels = data.models || [];
    _state.workOrders = data.orders || [];
    _state.workOrderModels = data.order_models || {};
    _state.workRecords = data.records || [];
    renderSpreadsheet();
  }
  
  _workSaveBusy = false;
}

document.getElementById('workYear').addEventListener('change', loadWorkRecords);
document.getElementById('workMonth').addEventListener('change', loadWorkRecords);
