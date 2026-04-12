// ============================================================
// 快捷计算
// ============================================================
async function initQuickCalc() {
  const [emps, priceData, templates, models] = await Promise.all([
    get('/api/employees'),           // 顺序与成员管理一致
    get('/api/price-table'),
    get('/api/price-templates'),
    get('/api/models'),
  ]);
  _qcState.employees = emps || [];
  _qcState.models = models || (priceData.models || []);
  _qcState.subDepartments = priceData.sub_departments || [];
  _qcState.prices = priceData.prices || {};
  _qcState.qtyData = {};
  _qcState.templates = templates || [];
  _qcState.selectedTemplateId = null;
  _qcState.priceTemplate = { ..._qcState.prices };

  // 构建 pricesByName：key = "modelName,subDeptId"（供前端使用）
  _qcState.pricesByName = {};
  for (const [key, price] of Object.entries(_qcState.prices)) {
    const [mid, sid] = key.split(',');
    const model = (_qcState.models || []).find(m => String(m.id) === String(mid));
    if (model) {
      _qcState.pricesByName[`${model.model_no},${sid}`] = price;
    }
  }
  _qcState.qcViewMode = 'qty';
  _qcState.qcWageDetail = null;

  // 自动加载上次保存的状态
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  const saved = await get(`/api/quick-calc-save?year=${year}&month=${month}`);

  if (saved && saved.qc_model_selects && Object.keys(saved.qc_model_selects).length > 0) {
    // 恢复保存的状态
    _qcModelSelects = { ...saved.qc_model_selects };
    _qcState.qtyData = { ...saved.qty_data };
    _ptModelSelects = { ...saved.pt_model_selects };
  } else {
    // 默认初始状态
    _ptModelSelects = {};
    _qcState.models.forEach((m, i) => { _ptModelSelects[i] = m.model_no; });

    _qcModelSelects = {};
    if (_qcState.models.length) _qcModelSelects[0] = _qcState.models[0].model_no;
  }

  // 更新模板下拉
  const sel = document.getElementById('qcTemplateSel');
  sel.innerHTML = '<option value="">-- 选择模板 --</option>' +
    _qcState.templates.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
  document.getElementById('qcDelTemplateBtn').style.display = 'none';

  // 重置工资视角按钮样式
  const btn = document.getElementById('qcViewModeBtn');
  btn.textContent = '切换工资视角';
  btn.style.background = '#fef3c7';
  btn.style.color = '#92400e';

  renderQcSpreadsheet();
  renderQcPriceTemplate();
}

// ============================================================
// 快捷计算 - 主表格（型号行 × 员工列，与做货编辑结构一致）
// ============================================================
function renderQcSpreadsheet() {
  const emps = _qcState.employees;
  const models = _qcState.models;
  const qtyData = _qcState.qtyData;
  const pricesByName = _qcState.pricesByName || {};
  const isWage = _qcState.qcViewMode === 'wage';
  const isSingleMode = _currentSettings['table-displayMode'] === 'single';
  const empsPerGroup = isSingleMode ? emps.length : parseInt(_currentSettings['table-groupSize'] || 8);

  if (!emps.length) {
    document.getElementById('qcSpreadsheetWrap').innerHTML =
      `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请先在成员管理中添加员工</div></div>`;
    document.getElementById('qcGrandTotal').textContent = '¥0.00';
    return;
  }
  if (Object.keys(_qcModelSelects).length === 0) {
    document.getElementById('qcSpreadsheetWrap').innerHTML =
      `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/></svg><div>请点击下方按钮添加行</div></div>`;
    document.getElementById('qcGrandTotal').textContent = '¥0.00';
    return;
  }

  const totalGroups = Math.ceil(emps.length / empsPerGroup);

  // 全局行合计计算（基于全部员工）
  function calcRowTotal(modelName) {
    let total = 0;
    for (const emp of emps) {
      const qty = qtyData[`${emp.id},${modelName}`] || 0;
      const price = pricesByName[`${modelName},${emp.sub_dept_id}`] || 0;
      total += qty * price;
    }
    return total;
  }

  // 构建单张分组表格
  function buildGroupTable(groupIdx, groupEmps, isOnlyGroup) {
    const headerHtml = `<thead><tr>
      <th class="col-fixed" style="min-width:110px;background:#059669;color:#fff;z-index:21;${!isOnlyGroup?'left:0;':''}">型号</th>

      ${groupEmps.map(e => `<th style="min-width:80px;background:#d1fae5;color:#065f46;position:sticky;top:0;z-index:10;">
        <span class="member-list-name-color" onclick="showEmployeeDetail(${e.id})">${escHtml(e.name)}</span>
      </th>`).join('')}
      <th class="col-fixed" style="background:#fef9c3;color:#92400e;min-width:80px;position:sticky;top:0;z-index:10;text-align:center;${!isOnlyGroup?'left:0;':''}">行合计(¥)</th>
      <th class="col-fixed" style="min-width:60px;position:sticky;top:0;z-index:10;text-align:center;${!isOnlyGroup?'left:0;':''}">操作</th>
    </tr></thead>`;

    let tbodyHtml = '<tbody>';
    Object.entries(_qcModelSelects).forEach(([rowIdx, modelName]) => {
      const rowTotal = calcRowTotal(modelName);
      const empCells = groupEmps.map(emp => {
        const key = `${emp.id},${modelName}`;
        const qty = qtyData[key] || 0;
        const price = pricesByName[`${modelName},${emp.sub_dept_id}`] || 0;
        const wage = qty * price;
        if (isWage) {
          const displayVal = qty > 0 ? fmtCompact(wage) : '';
          const compactClass = String(displayVal).length > 6 ? ' compact' : '';
          return `<td class="emp-cell">
            <div class="cell-input wage-cell-display${compactClass}" style="width:65px;" data-key="${key}"
              title="${qty > 0 ? '¥' + fmt(wage) : ''}">${displayVal}</div>
          </td>`;
        } else {
          return `<td class="emp-cell" style="text-align:center;">
            <input type="number" min="0" class="cell-input"
              style="width:65px;text-align:center;"
              value="${qty || ''}" placeholder="0"
              data-key="${key}"
              data-row="${rowIdx}"
              oninput="onQcCellChange(this)"
              onkeydown="onQcCellKeydown(event,this)">
          </td>`;
        }
      }).join('');

      const modelOptions = models.map(m =>
        `<option value="${escHtml(m.model_no)}"${m.model_no === modelName ? ' selected' : ''}>${escHtml(m.model_no)}</option>`
      ).join('');
      const rowDisplay = rowTotal > 0 ? fmtCompact(rowTotal) : '';
      const rowCompact = String(rowDisplay).length > 8 ? ' compact' : '';

      tbodyHtml += `<tr>
        <td class="col-fixed" style="text-align:center;padding:4px 6px;background:#d1fae5;${!isOnlyGroup?'left:0;z-index:7;':''}">
          <select class="cell-input model-cell" style="font-weight:600;font-size:12px;padding:5px 6px;min-width:80px;text-align:center;background:#d1fae5;"
            data-row="${rowIdx}" onchange="onQcModelChange(this)">
            ${modelOptions}
          </select>
        </td>
        ${empCells}
        <td class="col-fixed row-total-display${isWage?' wage':''}${rowCompact}" style="background:#fef9c3;font-weight:700;color:#92400e;text-align:center;${!isOnlyGroup?'left:0;z-index:7;':''}">${rowDisplay}</td>
        <td class="col-action-btn" style="text-align:center;${!isOnlyGroup?'left:0;z-index:7;':''}">
          <button class="btn btn-sm" style="padding:4px 10px;font-size:11px;background:#fee2e2;color:#dc2626;" onclick="removeQcRow(${rowIdx})">删除</button>
        </td>
      </tr>`;
    });
    tbodyHtml += '</tbody>';
    return `<table class="spreadsheet${isWage?' wage-view':''}${isSingleMode?' single-table-mode':''}">${headerHtml}${tbodyHtml}</table>`;
  }

  // 组装所有分组表格
  let grandTotal = 0;
  for (const mn of Object.values(_qcModelSelects)) {
    const rt = calcRowTotal(mn);
    if (rt > 0) grandTotal += rt;
  }
  document.getElementById('qcGrandTotal').textContent = '¥' + fmt(grandTotal);

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

  document.getElementById('qcSpreadsheetWrap').innerHTML =
    `${tablesHtml}<button class="row-add-btn" onclick="addQcRow()">+ 添加一行（选型号）</button>`;
}

// 切换工资视角（与做货编辑一致的体验）
async function qcToggleViewMode() {
  // 切换前先自动保存快捷计算数据
  await autoSaveQc();

  if (_qcState.qcViewMode === 'qty') {
    // 切换到工资视角：先加载工资明细
    const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
    const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
    _qcState.qcWageDetail = await get(`/api/wage-detail?year=${year}&month=${month}`);
    _qcState.qcViewMode = 'wage';
    const btn = document.getElementById('qcViewModeBtn');
    btn.textContent = '切换对数视角';
    btn.style.background = '#dcfce7';
    btn.style.color = '#15803d';
    toast('工资视角：对数 × 单价', 'info');
  } else {
    _qcState.qcViewMode = 'qty';
    _qcState.qcWageDetail = null;
    const btn = document.getElementById('qcViewModeBtn');
    btn.textContent = '切换工资视角';
    btn.style.background = '#fef3c7';
    btn.style.color = '#92400e';
    toast('对数视角', 'info');
  }
  renderQcSpreadsheet();
}

function onQcCellChange(el) {
  const key = el.dataset.key;
  if (!key) return;
  const val = parseInt(el.value) || 0;
  if (val === 0) { delete _qcState.qtyData[key]; el.style.background = ''; }
  else { _qcState.qtyData[key] = val; el.style.background = '#fef9c3'; }

  // 更新该型号在所有分组表格中的行合计（跨表格更新）
  const modelName = key.split(',').slice(1).join(',');
  const pricesByName = _qcState.pricesByName || {};
  const emps = _qcState.employees;
  let rowTotal = 0;
  for (const emp of emps) {
    const k = `${emp.id},${modelName}`;
    const qty = _qcState.qtyData[k] || 0;
    const price = pricesByName[`${modelName},${emp.sub_dept_id}`] || 0;
    rowTotal += qty * price;
  }
  const rowDisplay = rowTotal > 0 ? fmtCompact(rowTotal) : '';
  const rowCompact = String(rowDisplay).length > 8 ? ' compact' : '';
  // 查找当前行（通过 data-row 匹配型号行下拉）
  const rowSel = document.querySelector(`#qcSpreadsheetWrap select.model-cell[data-row="${el.dataset.row}"]`);
  if (rowSel) {
    const rowTr = rowSel.closest('tr');
    if (rowTr) {
      // 更新所有分组表格中对应型号的行合计
      const allTables = document.querySelectorAll('#qcSpreadsheetWrap .spreadsheet');
      for (const tbl of allTables) {
        const matchingRow = tbl.querySelector(`tr:has(select.model-cell[data-row="${el.dataset.row}"])`);
        if (matchingRow) {
          const totalEl = matchingRow.querySelector('.row-total-display');
          if (totalEl) {
            totalEl.textContent = rowDisplay;
            totalEl.className = `col-fixed row-total-display${rowCompact}`;
          }
        }
      }
    }
  }

  // 更新全厂合计
  let grandTotal = 0;
  for (const mn of Object.values(_qcModelSelects)) {
    let rt = 0;
    for (const emp of emps) {
      const qty = _qcState.qtyData[`${emp.id},${mn}`] || 0;
      const price = pricesByName[`${mn},${emp.sub_dept_id}`] || 0;
      rt += qty * price;
    }
    if (rt > 0) grandTotal += rt;
  }
  document.getElementById('qcGrandTotal').textContent = '¥' + fmt(grandTotal);

  // 防抖自动保存（500ms）
  clearTimeout(window._qcAutoSaveTimer);
  window._qcAutoSaveTimer = setTimeout(() => autoSaveQc(), 500);
}

// 快捷计算自动保存（主表格对数 + 主表格行配置 + 单价编辑行配置）
async function autoSaveQc() {
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  await post('/api/quick-calc-save', {
    year, month,
    qc_model_selects: _qcModelSelects,
    qty_data: _qcState.qtyData,
    pt_model_selects: _ptModelSelects,
    pt_prices: {},
  });
  // 显示"已保存"反馈
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
}

// 快捷计算手动保存（立即保存表格结构+对数+单价编辑行）
async function saveQcState() {
  const year = parseInt(document.getElementById('qcYear')?.value || _state.currentYear);
  const month = parseInt(document.getElementById('qcMonth')?.value || _state.currentMonth);
  await post('/api/quick-calc-save', {
    year, month,
    qc_model_selects: _qcModelSelects,  // 主表格型号行配置
    qty_data: _qcState.qtyData,        // 对数数据
    pt_model_selects: _ptModelSelects,  // 单价编辑行配置（型号名列表）
    pt_prices: {},
  });
  // 显示"已保存"反馈
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

// 一键清空主表格对数输入（保留表格结构，只清空对数）
function clearQcInputs() {
  _qcState.qtyData = {};
  renderQcSpreadsheet();
  saveQcState();  // 立即保存（表格结构+空对数）
}

function onQcCellKeydown(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowIdx = el.dataset.row;
    const allInputs = Array.from(
      document.querySelectorAll(`#qcSpreadsheet td.emp-cell input[data-row="${rowIdx}"]`)
    );
    const curIdx = allInputs.indexOf(el);
    if (curIdx >= 0) {
      const nextIdx = (curIdx + 1) % allInputs.length;
      allInputs[nextIdx].focus();
    }
  }
}

// 快捷计算主表格：型号切换
function onQcModelChange(sel) {
  const rowIdx = sel.dataset.row;
  _qcModelSelects[rowIdx] = sel.value;  // 存 modelName（字符串）
  renderQcSpreadsheet();
}

// 快捷计算主表格：新增一行（始终选单价编辑第一个型号）
function addQcRow() {
  const ptValues = Object.values(_ptModelSelects);
  if (!ptValues.length) return toast('请先在下方单价编辑中添加型号', 'error');
  const modelName = ptValues[0];  // 始终选第一个
  const newRowIdx = Math.max(...Object.keys(_qcModelSelects).map(Number), -1) + 1;
  _qcModelSelects[newRowIdx] = modelName;
  renderQcSpreadsheet();
}

// 快捷计算主表格：删除一行（可全部删空）
function removeQcRow(rowIdx) {
  delete _qcModelSelects[rowIdx];
  renderQcSpreadsheet();
}

// ── 模板管理 ────────────────────────────────────────────

async function loadQcTemplate() {
  const templateId = parseInt(document.getElementById('qcTemplateSel').value);
  if (!templateId) return toast('请先选择一个模板', 'error');
  const tpl = await get(`/api/price-templates/${templateId}`);
  if (!tpl) return toast('模板加载失败', 'error');

  // 将模板价格填入 pricesByName（"modelName,subDeptId"）
  _qcState.pricesByName = {};
  _qcState.priceTemplate = {};
  const tplPrices = tpl.prices || {};

  for (const [key, price] of Object.entries(tplPrices)) {
    const [mid, sid] = key.split(',');
    const model = _qcState.models.find(m => String(m.id) === String(mid));
    if (model) {
      const nameKey = `${model.model_no},${sid}`;
      _qcState.pricesByName[nameKey] = price;
      _qcState.priceTemplate[nameKey] = price;
    }
  }

  _qcState.selectedTemplateId = templateId;
  document.getElementById('qcDelTemplateBtn').style.display = '';
  toast(`已加载模板：${escHtml(tpl.name)}`, 'success');
  renderQcSpreadsheet();
}

function showSaveTemplateModal() {
  openModal(`
    <div class="modal-title">保存单价模板</div>
    <div class="form-group mb-10">
      <label>模板名称</label>
      <input id="tpl-name" type="text" placeholder="例如：2026年4月标准单价">
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
      将保存当前"单价编辑"中所有已填写的单价配置（型号×小部门）
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="doSaveQcTemplate()">保存</button>
    </div>`);
}

async function doSaveQcTemplate() {
  const name = document.getElementById('tpl-name').value.trim();
  if (!name) return toast('请输入模板名称', 'error');
  // 从 pricesByName（"modelName,subDeptId"）聚合，转为 modelId 格式保存
  const items = [];
  for (const [key, price] of Object.entries(_qcState.priceTemplate)) {
    const [modelName, sid] = key.split(',');
    const model = _qcState.models.find(m => m.model_no === modelName);
    if (model && price > 0) {
      items.push({ model_id: model.id, sub_dept_id: parseInt(sid), unit_price: price });
    }
  }
  const r = await post('/api/price-templates', { name, items });
  if (r.ok) {
    closeModal();
    toast('模板已保存', 'success');
    const templates = await get('/api/price-templates');
    _qcState.templates = templates || [];
    const sel = document.getElementById('qcTemplateSel');
    sel.innerHTML = '<option value="">-- 选择模板 --</option>' +
      _qcState.templates.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    const saved = _qcState.templates.find(t => t.name === name);
    if (saved) {
      sel.value = saved.id;
      _qcState.selectedTemplateId = saved.id;
      document.getElementById('qcDelTemplateBtn').style.display = '';
    }
  } else {
    toast(r.error || '保存失败', 'error');
  }
}

async function deleteQcTemplate() {
  const templateId = parseInt(document.getElementById('qcTemplateSel').value);
  if (!templateId) return;
  if (!confirm('确认删除该模板？')) return;
  await del(`/api/price-templates/${templateId}`);
  toast('已删除', 'info');
  _qcState.selectedTemplateId = null;
  document.getElementById('qcTemplateSel').value = '';
  document.getElementById('qcDelTemplateBtn').style.display = 'none';
  const templates = await get('/api/price-templates');
  _qcState.templates = templates || [];
  const sel = document.getElementById('qcTemplateSel');
  sel.innerHTML = '<option value="">-- 选择模板 --</option>' +
    _qcState.templates.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
}

// ============================================================
// 单价编辑：内嵌在快捷计算页的"型号单价表"
// 样式：型号行 × 小部门列（和做货编辑一致的 Tab 体验）
// ============================================================
function renderQcPriceTemplate() {
  const subs = _qcState.subDepartments;
  const pricesByName = _qcState.pricesByName || {};
  const wrap = document.getElementById('qcPriceTemplateWrap');

  if (!subs.length) {
    wrap.innerHTML = `<div class="empty-state">请先在小部门管理中添加小部门</div>`;
    document.getElementById('qcPriceRowCount').textContent = '0';
    return;
  }

  // 表头：型号 | 小部门1 | 小部门2 | ... | 保存/删除
  const subColWidth = Math.max(75, Math.floor(600 / subs.length));
  const headerHtml = `<thead><tr>
    <th class="col-fixed" style="min-width:110px;background:#0f172a;z-index:21;">型号</th>
    ${subs.map(s => `<th style="min-width:${subColWidth}px;position:sticky;top:0;z-index:10;background:#1e293b;color:#e2e8f0;">
      ${escHtml(s.name)}
    </th>`).join('')}
    <th class="col-fixed" style="background:#334155;color:#e2e8f0;min-width:72px;position:sticky;top:0;z-index:10;">操作</th>
  </tr></thead>`;

  // 初始化行状态：默认一行（第一个型号名）
  if (Object.keys(_ptModelSelects).length === 0) {
    _ptModelSelects[0] = _qcState.models[0]?.model_no || '型号A';
  }

  let tbodyHtml = '<tbody>';
  Object.entries(_ptModelSelects).forEach(([rowIdx, modelName]) => {
    const subCells = subs.map(sub => {
      const key = `${modelName},${sub.id}`;
      const price = pricesByName[key] || 0;
      return `<td>
        <input type="number" min="0" step="0.01" class="cell-input price-cell"
          style="width:100%;padding:6px 4px;"
          value="${price || ''}" placeholder="0"
          data-model="${escHtml(modelName)}" data-sub="${sub.id}" data-row="${rowIdx}"
          onchange="onPriceCellChange(this)"
          onkeydown="onPriceTab(event,this)">
      </td>`;
    }).join('');

    tbodyHtml += `<tr>
      <td class="col-fixed" style="background:#f1f5f9;text-align:left;padding:4px 6px;">
        <input type="text" class="cell-input" style="font-weight:700;font-size:12px;padding:5px 6px;min-width:80px;background:#fff;"
          value="${escHtml(modelName)}"
          data-row="${rowIdx}"
          onchange="onPtModelChange(this,'${escHtml(modelName)}')">
      </td>
      ${subCells}
      <td class="col-action-btn">
        <button class="btn btn-sm save-pt-btn" style="padding:3px 7px;font-size:11px;background:#dcfce7;color:#15803d;" onclick="savePtRow('${escHtml(modelName)}')">保存</button>
        <button class="btn btn-sm" style="padding:3px 7px;font-size:11px;background:#fee2e2;color:#dc2626;${Object.keys(_ptModelSelects).length <= 1 ? 'opacity:0.35;pointer-events:none;' : ''}" onclick="removePtRow(${rowIdx})">删除</button>
      </td>
    </tr>`;
  });
  tbodyHtml += '</tbody>';

  document.getElementById('qcPriceRowCount').textContent = Object.keys(_ptModelSelects).length;
  wrap.innerHTML = `<table class="spreadsheet" id="qcPriceTemplateTable">${headerHtml}${tbodyHtml}</table>
    <button class="row-add-btn" onclick="addPtRow()">+ 添加一行</button>`;
}

function onPtModelChange(sel, oldModelName) {
  const newModelName = sel.value.trim();
  if (!newModelName) { sel.value = oldModelName; return; }
  const rowIdx = sel.dataset.row;

  // 把旧型号名的单价迁移到新型号名（同一小部门）
  const oldPrefix = `${oldModelName},`;
  const newPrefix = `${newModelName},`;
  const newPricesByName = {};
  for (const [key, val] of Object.entries(_qcState.pricesByName)) {
    if (key.startsWith(oldPrefix)) {
      newPricesByName[key.replace(oldPrefix, newPrefix)] = val;
    } else {
      newPricesByName[key] = val;
    }
  }
  _qcState.pricesByName = newPricesByName;

  _ptModelSelects[rowIdx] = newModelName;
  renderQcPriceTemplate();
  renderQcSpreadsheet();
}

function addPtRow() {
  // 收集所有已有型号，找一个未使用的名字
  const usedNames = new Set(Object.values(_ptModelSelects));
  const allNames = [...usedNames, ..._qcState.models.map(m => m.model_no)];
  let modelName = null;
  for (const n of allNames) {
    if (!usedNames.has(n)) { modelName = n; break; }
  }
  if (!modelName) modelName = `型号${allNames.length + 1}`;
  const newRowIdx = Math.max(...Object.keys(_ptModelSelects).map(Number), -1) + 1;
  _ptModelSelects[newRowIdx] = modelName;
  renderQcPriceTemplate();
  saveQcState();  // 保存新增的型号行结构
}

// 单价编辑：删除一行（至少保留一行）
function removePtRow(rowIdx) {
  if (Object.keys(_ptModelSelects).length <= 1) return;
  delete _ptModelSelects[rowIdx];
  renderQcPriceTemplate();
  saveQcState();  // 保存删除后的型号行结构
}

function onPriceCellChange(el) {
  const modelName = el.dataset.model;  // 已经是 modelName 字符串
  const subId = parseInt(el.dataset.sub);
  const val = parseFloat(el.value) || 0;
  const keyName = `${modelName},${subId}`;  // "modelName,subDeptId"

  if (val === 0) {
    delete _qcState.priceTemplate[keyName];
    delete _qcState.pricesByName[keyName];
    el.style.background = '';
  } else {
    _qcState.priceTemplate[keyName] = val;
    _qcState.pricesByName[keyName] = val;
    el.style.background = '#fef9c3';
  }
  // 自动保存该型号所有单价到数据库（autoSave）
  autoSavePtRow(modelName);
  // 实时更新主表格的工资
  renderQcSpreadsheet();
}

// 自动保存（防抖：300ms 内只触发一次）
let _ptSaveTimer = null;
async function autoSavePtRow(modelName) {
  clearTimeout(_ptSaveTimer);
  _ptSaveTimer = setTimeout(async () => {
    // 找 modelId，找不到则自动创建
    let model = _qcState.models.find(m => m.model_no === modelName);
    if (!model) {
      const r = await post('/api/models', { model_no: modelName });
      if (r && r.ok && r.model_id) {
        model = { id: r.model_id, model_no: modelName };
        _qcState.models.push(model);
      } else {
        return;
      }
    }
    const modelId = model.id;
    // 同步主表格下拉（加入新创建的型号）
    renderQcSpreadsheet();

    const items = [];
    for (const sub of _qcState.subDepartments) {
      const keyName = `${modelName},${sub.id}`;
      const price = _qcState.pricesByName[keyName] || 0;
      items.push({ model_id: modelId, sub_dept_id: sub.id, unit_price: price });
    }
    const r = await post('/api/model-prices', { model_id: modelId, items });
    if (r && r.ok) {
      const rows = document.querySelectorAll(`#qcPriceTemplateTable tbody tr`);
      for (const tr of rows) {
        const inp = tr.querySelector('input[type="text"]');
        if (inp && inp.value.trim() === modelName) {
          const btn = tr.querySelector('.save-pt-btn');
          if (btn) { btn.textContent = '已保存'; btn.style.background = '#dcfce7'; btn.style.color = '#15803d'; }
        }
      }
    }
  }, 300);
}

function onPriceTab(e, el) {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    const rowIdx = el.dataset.row;
    const allCells = Array.from(
      document.querySelectorAll(`#qcPriceTemplateTable td input.price-cell[data-row="${rowIdx}"]`)
    );
    const curIdx = allCells.indexOf(el);
    const nextIdx = (curIdx + 1) % allCells.length;
    allCells[nextIdx].focus();
  }
}

async function savePtRow(modelName) {
  // 找 modelId，找不到则自动创建
  let model = _qcState.models.find(m => m.model_no === modelName);
  if (!model) {
    const r = await post('/api/models', { model_no: modelName });
    if (r && r.ok && r.model_id) {
      model = { id: r.model_id, model_no: modelName };
      _qcState.models.push(model);
    } else {
      toast('创建型号失败', 'error');
      return;
    }
  }
  const modelId = model.id;
  // 同步主表格下拉
  renderQcSpreadsheet();

  const items = [];
  for (const sub of _qcState.subDepartments) {
    const keyName = `${modelName},${sub.id}`;
    const price = _qcState.pricesByName[keyName] || 0;
    items.push({ model_id: modelId, sub_dept_id: sub.id, unit_price: price });
  }
  const r = await post('/api/model-prices', { model_id: modelId, items });
  if (r && r.ok) {
    toast(`"${escHtml(modelName)}" 的单价已保存`, 'success');
    saveQcState();  // 保存当前表格结构（含单价编辑行配置）
  } else {
    toast(r.error || '保存失败', 'error');
  }
}

document.getElementById('qcYear').addEventListener('change', initQuickCalc);
document.getElementById('qcMonth').addEventListener('change', initQuickCalc);
