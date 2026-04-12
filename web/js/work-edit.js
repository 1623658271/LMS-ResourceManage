// ============================================================
// 做货编辑
// ============================================================
async function loadWorkRecords() {
  const year = parseInt(document.getElementById('workYear').value);
  const month = parseInt(document.getElementById('workMonth').value);
  _state.currentYear = year; _state.currentMonth = month;
  // 保存 pending 状态（年月切换和保存后重载时保留）
  const savedDirty = { ..._dirtyCells };
  const savedTempRows = [...(_state.tempWorkRows || [])];
  const savedDeletedKeys = new Set(_deletedRowKeys || []);
  const savedTempCounter = _tempRowCounter || 0;
  const data = await get(`/api/work-records?year=${year}&month=${month}`);
  _state.workEmployees = data.employees || [];
  _state.workModels = data.models || [];
  _state.workOrders = data.orders || [];
  _state.workOrderModels = data.order_models || {};
  _state.workRecords = data.records || [];
  _dirtyCells = savedDirty;
  _deletedRowKeys = savedDeletedKeys;
  _state.tempWorkRows = savedTempRows;
  _tempRowCounter = savedTempCounter;
  _state.wageDetail = null;

  // 填充订单下拉
  const orderSel = document.getElementById('workOrderSelect');
  orderSel.innerHTML = '<option value="">-- 选择订单 --</option>' +
    _state.workOrders.map(o => `<option value="${o.id}">${escHtml(o.order_no)}</option>`).join('');
  // 填充型号下拉（根据选中的订单）
  updateModelSelect();
  renderSpreadsheet();
}

function updateModelSelect() {
  const orderId = document.getElementById('workOrderSelect').value;
  const modelSel = document.getElementById('workModelSelect');
  if (!orderId) {
    modelSel.innerHTML = '<option value="">-- 选择型号 --</option>';
    return;
  }
  const models = _state.workOrderModels[orderId] || [];
  modelSel.innerHTML = '<option value="">-- 选择型号 --</option>' +
    models.map(m => `<option value="${m.id}">${escHtml(m.model_no)}</option>`).join('');
}

document.getElementById('workOrderSelect').addEventListener('change', updateModelSelect);

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
    rows.push({ order_id: r.order_id, model_id: r.model_id });
  }

  // 3. 从 _dirtyCells 构建行（新增的实体行）
  for (const key of Object.keys(_dirtyCells)) {
    const parts = key.split('|');
    if (parts.length === 3) {
      const orderId = parseInt(parts[0]);
      const modelId = parseInt(parts[1]);
      if (orderId === 0 || modelId === 0) continue;
      const combo = `${orderId},${modelId}`;
      if (_deletedRowKeys.has(combo)) continue;
      rows.push({ order_id: orderId, model_id: modelId });
    }
  }

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
      // 型号下拉：根据当前选中的订单关联的型号，临时行也显示已选
      const currentOrderModels = _state.workOrderModels[String(order_id)] || [];
      const modelOptions = currentOrderModels.length > 0 ? currentOrderModels.map(m =>
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
          <select class="cell-input model-cell" style="background:#d1fae5;font-weight:600;" data-row-key="${rowKey}" data-temp="${isTemp ? tempRowId : ''}" ${currentOrderModels.length === 0 ? 'disabled' : ''} onchange="onModelCellChange(this)">
            ${currentOrderModels.length === 0 ? '<option value="">-- 无型号 --</option>' : modelOptions}
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
  if (val === '' || val === '0') { delete _dirtyCells[key]; el.style.background = ''; }
  else { _dirtyCells[key] = parseInt(val) || 0; el.style.background = '#fef9c3'; }

  // 更新当前行所有表格中的行合计（跨分组）
  const parts = key.split('|');
  if (parts.length !== 3) return;

  // 从 DOM 当前行读取所有 input 值来计算行合计
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

  // 防抖自动保存（600ms）- 仅通过 onCellChange 触发，移除 onblur 避免重复
  clearTimeout(window._workAutoSaveTimer);
  window._workAutoSaveTimer = setTimeout(() => autoSaveWorkRecords(), 600);
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
    // 临时行：更新该行的 orderId，重新渲染
    const tRows = _state.tempWorkRows || [];
    const row = tRows.find(r => r.tempId === tempId);
    if (row) row.orderId = newOrderId;
    // 清除该行旧的 _dirtyCells key（所有 orderId/modelId 组合）
    const emps = _state.workEmployees || [];
    for (const emp of emps) {
      for (const [k] of Object.entries(_dirtyCells)) {
        if (k.endsWith(`|${emp.id}`)) delete _dirtyCells[k];
      }
    }
    renderSpreadsheet();
  } else {
    // 实体行：只更新型号下拉选项（重新渲染会处理 rowKey 更新）
    const modelSel = tr.querySelector('.model-cell');
    if (!newOrderId) {
      modelSel.innerHTML = '<option value="">-- 订单 --</option>';
      modelSel.disabled = true;
    } else {
      const models = _state.workOrderModels[String(newOrderId)] || [];
      if (models.length > 0) {
        modelSel.innerHTML = '<option value="">-- 选择型号 --</option>' +
          models.map(m => `<option value="${m.id}">${escHtml(m.model_no)}</option>`).join('');
        modelSel.disabled = false;
      } else {
        modelSel.innerHTML = '<option value="">-- 无型号 --</option>';
        modelSel.disabled = true;
      }
    }
  }
}

// 型号单元格变更：更新行状态，重新渲染
function onModelCellChange(modelSel) {
  const tr = modelSel.closest('tr');
  const tempId = modelSel.dataset.temp;
  const newModelId = parseInt(modelSel.value);

  if (tempId) {
    // 临时行：更新该行的 modelId，清除旧格子数据，重新渲染
    const tRows = _state.tempWorkRows || [];
    const row = tRows.find(r => r.tempId === tempId);
    if (row) row.modelId = newModelId;
    const emps = _state.workEmployees || [];
    for (const emp of emps) {
      for (const [k] of Object.entries(_dirtyCells)) {
        if (k.endsWith(`|${emp.id}`)) delete _dirtyCells[k];
      }
    }
    renderSpreadsheet();
  } else {
    // 实体行：重绑定 _dirtyCells 的 key
    const orderSel = tr.querySelector('.order-cell');
    const orderId = parseInt(orderSel.value);
    const rowKey = tr.dataset.rowKey || '';
    const oldPrefix = rowKey ? rowKey.replace(/\|g\d+$/, '') + '|' : '';
    if (oldPrefix && orderId && newModelId) {
      const newPrefix = `${orderId}|${newModelId}|`;
      for (const key of Object.keys(_dirtyCells)) {
        if (key.startsWith(oldPrefix)) {
          const newKey = newPrefix + key.split('|').slice(3).join('|');
          _dirtyCells[newKey] = _dirtyCells[key];
          delete _dirtyCells[key];
        }
      }
      for (const inp of tr.querySelectorAll('input.emp-cell')) {
        if (inp.dataset.key && inp.dataset.key.startsWith(oldPrefix)) {
          const newKey = newPrefix + inp.dataset.key.split('|').slice(3).join('|');
          inp.dataset.key = newKey;
        }
      }
      tr.dataset.rowKey = `${orderId}|${newModelId}|g0`;
    }
    renderSpreadsheet();
  }
}

function onRowHeaderChange(el) {
  const rowKey = el.dataset.rowKey;
  if (!rowKey) return;
  for (const key of Object.keys(_dirtyCells)) {
    if (key.startsWith(rowKey)) delete _dirtyCells[key];
  }
  renderSpreadsheet();
}

// 添加一行（直接创建实体行，用户可以立即选择订单和型号）
function addWorkRow() {
  const tempId = '__TEMP__' + (_tempRowCounter++);
  _state.tempWorkRows = _state.tempWorkRows || [];
  // 每行独立存储 orderId=0, modelId=0（待选择）
  _state.tempWorkRows.push({ tempId, orderId: 0, modelId: 0 });
  renderSpreadsheet();
  setTimeout(() => {
    const sel = document.querySelector(`tr[data-temp-id="${tempId}"] .order-cell`);
    if (sel) sel.focus();
    // 添加行后静默自动保存（保留 pending 状态，刷新服务端数据）
    autoSaveWorkRecords();
  }, 50);
}

// 删除临时行
function deleteTempRow(tempId) {
  _state.tempWorkRows = (_state.tempWorkRows || []).filter(r => r.tempId !== tempId);
  // 清除该行所有员工的格子数据（所有 orderId/modelId 组合的 key）
  const emps = _state.workEmployees || [];
  for (const emp of emps) {
    for (const [k] of Object.entries(_dirtyCells)) {
      if (k.endsWith(`|${emp.id}`)) delete _dirtyCells[k];
    }
  }
  renderSpreadsheet();
}

// rowKey 格式：实体行=`${orderId}|${modelId}|g${groupIdx}`，临时行=`__TEMP__${id}`
function deleteWorkRow(rowKey) {
  if (!confirm('确定删除这一行数据吗？')) return;
  const year = _state.currentYear, month = _state.currentMonth;

  if (rowKey.startsWith('__TEMP__')) {
    // 临时行：清除该行所有员工的格子数据（key 以 |empId 结尾的条目）
    const tempId = rowKey;
    const emps = _state.workEmployees || [];
    for (const emp of emps) {
      for (const [k] of Object.entries(_dirtyCells)) {
        if (k.endsWith(`|${emp.id}`)) delete _dirtyCells[k];
      }
    }
    // 从 tempWorkRows 移除（对象结构）
    _state.tempWorkRows = (_state.tempWorkRows || []).filter(r => r.tempId !== tempId);
    renderSpreadsheet();
    toast('已删除', 'success');
  } else {
    // 实体行：含 g${groupIdx} 后缀，用 orderId,modelId 调用批量删除 API
    const parts = rowKey.split('|');
    if (parts.length !== 3) return;
    const orderId = parseInt(parts[0]);
    const modelId = parseInt(parts[1]);
    if (!orderId || !modelId) return;
    fetch(`/api/work-row?year=${year}&month=${month}&order_id=${orderId}&model_id=${modelId}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(() => {
        // 清除 _dirtyCells 中对应行实例的数据
        const tr = document.querySelector(`tr[data-row-key="${rowKey}"]`);
        if (tr) {
          const inputs = tr.querySelectorAll('.emp-cell');
          for (const inp of inputs) {
            const key = inp.dataset.key;
            if (key) delete _dirtyCells[key];
          }
        }
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
async function autoSaveWorkRecords() {
  if (_workSaveBusy) return;
  _workSaveBusy = true;
  const year = _state.currentYear, month = _state.currentMonth;
  let saved = 0;
  const keysToSave = Object.keys(_dirtyCells);
  for (const key of keysToSave) {
    const parts = key.split('|');
    if (parts.length === 3) {
      const orderId = parseInt(parts[0]);
      const modelId = parseInt(parts[1]);
      const empId = parseInt(parts[2]);
      const val = _dirtyCells[key];
      if (val !== undefined && val !== null && val !== '' && val > 0) {
        // 跳过临时行（orderId/modelId 为 0 的记录不保存）
        if (!orderId || !modelId) { delete _dirtyCells[key]; continue; }
        try {
          await post('/api/work-records', { year, month, order_id: orderId, model_id: modelId, emp_id: empId, quantity: val });
          saved++;
        } catch(e) { console.error('保存失败', e); }
      }
      delete _dirtyCells[key];
    }
  }
  if (saved > 0) {
    // 重载服务端数据，同时 loadWorkRecords 会自动保留 pending 状态
    const data = await get(`/api/work-records?year=${year}&month=${month}`);
    const savedDirty = { ..._dirtyCells };
    const savedTempRows = [...(_state.tempWorkRows || [])];
    const savedDeletedKeys = new Set(_deletedRowKeys || []);
    const savedTempCounter = _tempRowCounter || 0;
    _state.workEmployees = data.employees || [];
    _state.workModels = data.models || [];
    _state.workOrders = data.orders || [];
    _state.workOrderModels = data.order_models || {};
    _state.workRecords = data.records || [];
    _dirtyCells = savedDirty;
    _deletedRowKeys = savedDeletedKeys;
    _state.tempWorkRows = savedTempRows;
    _tempRowCounter = savedTempCounter;
    renderSpreadsheet();
  }
  _workSaveBusy = false;
}

document.getElementById('workYear').addEventListener('change', loadWorkRecords);
document.getElementById('workMonth').addEventListener('change', loadWorkRecords);
