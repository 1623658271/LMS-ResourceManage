// ============================================================
// 成员管理
// ============================================================
let memberDraggingId = 0;
let memberDraggingDeptId = 0;
let memberSuppressClickUntil = 0;

async function loadMembers(options = {}) {
  const { animate = true } = options;
  const container = document.getElementById('memberList');
  const finishRefresh = animate
    ? beginContentRefresh(container, {
        loadingText: '正在刷新成员列表...',
        minHeight: 180,
      })
    : () => {};
  try {
    const emps = await get('/api/employees');
    _state.employees = emps;
    if (!emps || !emps.length) {
      container.innerHTML = '<div class="empty-state">暂无成员，请先添加</div>';
      return;
    }

    container.innerHTML = buildMemberDepartmentBlocks(emps);
  } finally {
    finishRefresh();
  }
}

function buildMemberDepartmentBlocks(emps) {
  const groups = [];
  const groupMap = new Map();
  emps.forEach(emp => {
    if (!groupMap.has(emp.dept_id)) {
      const group = {
        dept_id: emp.dept_id,
        dept_name: emp.dept_name,
        employees: [],
      };
      groups.push(group);
      groupMap.set(emp.dept_id, group);
    }
    groupMap.get(emp.dept_id).employees.push(emp);
  });

  return groups.map(group => `
    <div class="dept-block member-dept-block" data-dept-id="${group.dept_id}">
      <div class="dept-block-header member-dept-header">
        <span><span class="dept-large">${escHtml(group.dept_name)}</span></span>
        <span class="dept-totals">${group.employees.length} 名成员 · 仅支持本部门内拖拽排序</span>
      </div>
      <div class="member-dept-body"
        data-dept-id="${group.dept_id}"
        ondragover="onMemberGroupDragOver(event)"
        ondrop="onMemberGroupDrop(event)">
        ${group.employees.map(emp => buildMemberCard(emp)).join('')}
      </div>
    </div>
  `).join('');
}

function buildMemberCard(emp) {
  return `
    <div class="member-card" data-emp-id="${emp.id}" data-dept-id="${emp.dept_id}"
      ondragover="onMemberDragOver(event)"
      ondragleave="onMemberDragLeave(event)"
      ondrop="onMemberDrop(event)"
      ondragend="onMemberDragEnd(event)">
      <span class="member-drag-handle" draggable="true"
        ondragstart="onMemberDragStart(event)"
        ondragend="onMemberDragEnd(event)"
        title="按住拖拽调整同部门内顺序">⋮</span>
      <input type="checkbox" class="member-check" value="${emp.id}" onchange="updateBatchDelBtn()">
      <div class="member-card-info">
        <span class="member-name member-list-name-color" onclick="safeShowEditMemberModal(${emp.id}, event)" title="点击编辑">${escHtml(emp.name)}</span>
        <span class="member-gender-badge">${emp.gender === '女' ? '♀' : '♂'}</span>
        <span class="dept-large">${escHtml(emp.dept_name)}</span>
        <span class="dept-sub">/ ${escHtml(emp.sub_dept_name)}</span>
      </div>
      <div class="member-card-actions">
        <button class="btn btn-sm btn-primary" onclick="navigateToMemberDetail(${emp.id})">详情</button>
        <button class="btn btn-sm btn-secondary" onclick="showEditMemberModal(${emp.id})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="delMember(${emp.id})">删除</button>
      </div>
    </div>
  `;
}

function safeShowEditMemberModal(empId, event) {
  if (Date.now() < memberSuppressClickUntil) {
    if (event) event.preventDefault();
    return;
  }
  showEditMemberModal(empId);
}

function onMemberDragStart(event) {
  const card = event.currentTarget.closest('.member-card');
  if (!card) return;
  event.stopPropagation();
  memberDraggingId = parseInt(card.dataset.empId, 10);
  memberDraggingDeptId = parseInt(card.dataset.deptId, 10);
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(memberDraggingId));
}

function onMemberDragOver(event) {
  event.preventDefault();
  const card = event.currentTarget;
  if (parseInt(card.dataset.empId, 10) !== memberDraggingId) {
    card.classList.add('drag-over');
  }
}

function onMemberDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function onMemberDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const card = event.currentTarget;
  applyMemberDrop(parseInt(card.dataset.deptId, 10), parseInt(card.dataset.empId, 10));
}

function onMemberGroupDragOver(event) {
  event.preventDefault();
}

function onMemberGroupDrop(event) {
  if (event.target.closest && event.target.closest('.member-card')) return;
  event.preventDefault();
  applyMemberDrop(parseInt(event.currentTarget.dataset.deptId, 10), 0);
}

function onMemberDragEnd(event) {
  const card = event.currentTarget.closest('.member-card') || event.currentTarget;
  card.classList.remove('dragging');
  clearMemberDragState();
  memberDraggingId = 0;
  memberDraggingDeptId = 0;
}

function clearMemberDragState() {
  document.querySelectorAll('.member-card.drag-over').forEach(card => {
    card.classList.remove('drag-over');
  });
}

function moveMemberId(list, empId, beforeId) {
  const next = list.filter(id => id !== empId);
  if (beforeId && beforeId !== empId) {
    const index = next.indexOf(beforeId);
    if (index >= 0) {
      next.splice(index, 0, empId);
      return next;
    }
  }
  next.push(empId);
  return next;
}

async function applyMemberDrop(targetDeptId, beforeEmpId) {
  const empId = memberDraggingId;
  if (!empId) return;
  if (targetDeptId !== memberDraggingDeptId) {
    showToast('成员只能在同一部门内调整顺序', 'info');
    return;
  }

  memberSuppressClickUntil = Date.now() + 300;
  if (beforeEmpId === empId) return;

  const currentIds = _state.employees
    .filter(emp => emp.dept_id === targetDeptId)
    .map(emp => emp.id);
  const nextIds = moveMemberId(currentIds, empId, beforeEmpId);
  const result = await put('/api/employees/order', {
    dept_id: targetDeptId,
    emp_ids: nextIds,
  });

  if (result && result.ok !== false) {
    showToast('成员顺序已保存', 'success');
    await loadMembers({ animate: false });
  } else {
    showToast(result?.error || '保存成员顺序失败', 'error');
    await loadMembers({ animate: false });
  }
}

function toggleSelectAllMembers() {
  const checked = document.getElementById('memberSelectAll').checked;
  document.querySelectorAll('.member-check').forEach(cb => { cb.checked = checked; });
  updateBatchDelBtn();
}

function updateBatchDelBtn() {
  const checked = document.querySelectorAll('.member-check:checked');
  const btn = document.getElementById('batchDelBtn');
  if (!btn) return;
  btn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
  if (checked.length > 0) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> 批量删除 (${checked.length})`;
  }
}

async function batchDeleteMembers() {
  const checked = document.querySelectorAll('.member-check:checked');
  if (!checked.length) return;

  const ids = Array.from(checked).map(cb => parseInt(cb.value, 10));
  const names = ids.map(id => _state.employees.find(e => e.id === id)?.name).filter(Boolean);
  if (!confirm(`确定要删除以下成员吗？\n${names.join('、')}\n\n此操作不可恢复。`)) return;

  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    const r = await del(`/api/employees/${id}`);
    if (r && r.success !== false) ok += 1;
    else fail += 1;
  }

  showToast(`成功删除 ${ok} 人${fail ? `，失败 ${fail} 人` : ''}`, ok > 0 ? 'success' : 'error');
  if (ok > 0) {
    document.getElementById('memberSelectAll').checked = false;
    await loadMembers();
  }
}

async function showBatchAddMemberModal() {
  const depts = await get('/api/departments');
  const subs = await get('/api/sub-departments');
  _state.batchDepts = depts;
  _state.batchSubs = subs;

  function makeRowHtml(idx) {
    const genderOptions = '<option value="男">男</option><option value="女">女</option>';
    const deptOptions = '<option value="">--</option>' + depts.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
    return `<tr data-idx="${idx}">
      <td class="row-num">${idx}</td>
      <td><input type="text" class="batch-name" placeholder="姓名" style="width:90px;"></td>
      <td><select class="batch-gender">${genderOptions}</select></td>
      <td><select class="batch-dept" onchange="onBatchDeptChange(this)">${deptOptions}</select></td>
      <td><select class="batch-subdept"><option value="">--先选大部门--</option></select></td>
      <td class="row-del"><button type="button" onclick="delBatchRow(this)">×</button></td>
    </tr>`;
  }

  openModal(`
    <div class="modal-title">批量添加成员</div>
    <div class="batch-add-toolbar">
      <button type="button" class="btn btn-sm" onclick="addBatchRow()">+ 添加行</button>
      <span style="font-size:var(--font-size-11);color:var(--text-muted);margin-left:8px;">直接填写姓名和部门，最后点击“批量添加”</span>
    </div>
    <div style="max-height:400px;overflow:auto;">
      <table class="batch-add-table">
        <thead><tr><th style="width:32px;">#</th><th>姓名</th><th style="width:50px;">性别</th><th>大部门</th><th>小部门</th><th style="width:36px;"></th></tr></thead>
        <tbody id="batchTableBody">${makeRowHtml(1)}</tbody>
      </table>
    </div>
    <div class="batch-add-add-row">
      <button type="button" class="btn btn-sm btn-secondary" onclick="addBatchRow()">+ 继续添加行</button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="doBatchAddMember()">批量添加</button>
    </div>
  `, 'batch-add-modal');
}

function onBatchDeptChange(deptSel) {
  const tr = deptSel.closest('tr');
  const deptId = parseInt(deptSel.value, 10);
  const subSel = tr.querySelector('.batch-subdept');
  const subs = _state.batchSubs.filter(s => s.dept_id === deptId);
  subSel.innerHTML = '<option value="">--选择--</option>' + subs.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
}

function addBatchRow() {
  const tbody = document.getElementById('batchTableBody');
  const rows = tbody.querySelectorAll('tr');
  const newIdx = rows.length + 1;
  const genderOptions = '<option value="男">男</option><option value="女">女</option>';
  const deptOptions = '<option value="">--</option>' + _state.batchDepts.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  tbody.insertAdjacentHTML('beforeend', `<tr data-idx="${newIdx}">
    <td class="row-num">${newIdx}</td>
    <td><input type="text" class="batch-name" placeholder="姓名" style="width:90px;"></td>
    <td><select class="batch-gender">${genderOptions}</select></td>
    <td><select class="batch-dept" onchange="onBatchDeptChange(this)">${deptOptions}</select></td>
    <td><select class="batch-subdept"><option value="">--先选大部门--</option></select></td>
    <td class="row-del"><button type="button" onclick="delBatchRow(this)">×</button></td>
  </tr>`);
}

function delBatchRow(btn) {
  const tbody = document.getElementById('batchTableBody');
  if (tbody.querySelectorAll('tr').length <= 1) return;
  btn.closest('tr').remove();
  tbody.querySelectorAll('tr').forEach((tr, i) => {
    tr.dataset.idx = i + 1;
    tr.querySelector('.row-num').textContent = i + 1;
  });
}

async function doBatchAddMember() {
  const rows = document.querySelectorAll('#batchTableBody tr');
  const employees = [];
  let hasValid = false;

  rows.forEach(tr => {
    const name = tr.querySelector('.batch-name').value.trim();
    const gender = tr.querySelector('.batch-gender').value;
    const deptId = parseInt(tr.querySelector('.batch-dept').value, 10);
    const subDeptId = parseInt(tr.querySelector('.batch-subdept').value, 10);
    if (name && deptId && subDeptId) {
      employees.push({ name, gender, dept_id: deptId, sub_dept_id: subDeptId });
      hasValid = true;
    }
  });

  if (!hasValid) {
    showToast('请至少填写一行完整的姓名和部门信息', 'error');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const emp of employees) {
    const r = await post('/api/employees', emp);
    if (r && r.ok !== false) ok += 1;
    else fail += 1;
  }

  closeModal();
  showToast(`成功添加 ${ok} 人${fail ? `，失败 ${fail} 人` : ''}`, ok > 0 ? 'success' : 'error');
  if (ok > 0) await loadMembers();
}

function onDeptChange(prefix) {
  const deptId = parseInt(document.getElementById(prefix + '-dept').value, 10);
  const subs = _state.subDepartments.filter(s => s.dept_id === deptId);
  document.getElementById(prefix + '-subdept').innerHTML =
    '<option value="">-- 选择 --</option>' + subs.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
}

async function showAddMemberModal() {
  const depts = await get('/api/departments');
  const subs = await get('/api/sub-departments');
  _state.departments = depts;
  _state.subDepartments = subs;
  openModal(`
    <div class="modal-title">添加成员</div>
    <div class="form-row">
      <div class="form-group"><label>姓名</label><input id="m-name" type="text" placeholder="输入姓名"></div>
      <div class="form-group"><label>性别</label><select id="m-gender"><option value="男">男</option><option value="女">女</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>大部门</label><select id="m-dept" onchange="onDeptChange('m')"><option value="">-- 选择 --</option>${depts.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>小部门</label><select id="m-subdept"><option value="">-- 先选大部门 --</option></select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doAddMember()">保存</button></div>
  `);
}

async function doAddMember() {
  const name = document.getElementById('m-name').value.trim();
  const gender = document.getElementById('m-gender').value;
  const dept_id = parseInt(document.getElementById('m-dept').value, 10);
  const sub_dept_id = parseInt(document.getElementById('m-subdept').value, 10);
  if (!name) return toast('请输入姓名', 'error');
  if (!dept_id || !sub_dept_id) return toast('请选择部门', 'error');
  const r = await post('/api/employees', { name, gender, dept_id, sub_dept_id });
  if (r.ok) {
    closeModal();
    toast('添加成功', 'success');
    loadMembers();
  } else {
    toast(r.error || '添加失败', 'error');
  }
}

async function showEditMemberModal(empId) {
  const emp = _state.employees.find(e => e.id === empId);
  const depts = await get('/api/departments');
  const subs = await get('/api/sub-departments');
  _state.departments = depts;
  _state.subDepartments = subs;
  openModal(`
    <div class="modal-title">编辑成员</div>
    <div class="form-row">
      <div class="form-group"><label>姓名</label><input id="m-name" type="text" value="${escHtml(emp.name)}"></div>
      <div class="form-group"><label>性别</label><select id="m-gender"><option value="男"${emp.gender === '男' ? ' selected' : ''}>男</option><option value="女"${emp.gender === '女' ? ' selected' : ''}>女</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>大部门</label><select id="m-dept" onchange="onDeptChange('m')">${depts.map(d => `<option value="${d.id}"${d.id === emp.dept_id ? ' selected' : ''}>${escHtml(d.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label>小部门</label><select id="m-subdept">${subs.filter(s => s.dept_id === emp.dept_id).map(s => `<option value="${s.id}"${s.id === emp.sub_dept_id ? ' selected' : ''}>${escHtml(s.name)}</option>`).join('')}</select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doEditMember(${empId})">保存</button></div>
  `);
}

async function doEditMember(empId) {
  const name = document.getElementById('m-name').value.trim();
  const gender = document.getElementById('m-gender').value;
  const dept_id = parseInt(document.getElementById('m-dept').value, 10);
  const sub_dept_id = parseInt(document.getElementById('m-subdept').value, 10);
  if (!name || !dept_id || !sub_dept_id) return toast('请填写完整', 'error');
  const r = await put(`/api/employees/${empId}`, { name, gender, dept_id, sub_dept_id });
  if (r.ok) {
    closeModal();
    toast('保存成功', 'success');
    if (getCurrentView() === 'member-detail') loadMemberDetail(empId);
    else loadMembers();
  } else {
    toast('保存失败', 'error');
  }
}

async function delMember(empId) {
  if (!confirm('确认删除该成员？')) return;
  await del(`/api/employees/${empId}`);
  toast('已删除', 'info');
  loadMembers();
}

document.getElementById('memberYear').addEventListener('change', loadMembers);
document.getElementById('memberMonth').addEventListener('change', loadMembers);
