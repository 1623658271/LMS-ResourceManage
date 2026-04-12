// ============================================================
// 部门管理
// ============================================================
async function loadDepartments() {
  const depts = await get('/api/departments');
  const subs = await get('/api/sub-departments');
  _state.departments = depts; _state.subDepartments = subs;
  const tree = document.getElementById('deptTree');
  tree.innerHTML = depts.map(d => {
    const children = subs.filter(s => s.dept_id === d.id);
    return `<div class="tree-item" onclick="selectDept(${d.id})">
      <span>📂 ${escHtml(d.name)}</span>
      <span class="del-btn" onclick="event.stopPropagation(); delDept(${d.id})">✕</span>
    </div>${children.map(s => `<div class="tree-child" onclick="selectSubDept(${s.id},${d.id})">
      <span>📋 ${escHtml(s.name)}</span>
      <span class="del-btn" onclick="event.stopPropagation(); delSubDept(${s.id})">✕</span>
    </div>`).join('')}`;
  }).join('');
  if (!_state.selectedDeptId && depts.length) selectDept(depts[0].id);
}

async function selectDept(deptId) {
  _state.selectedDeptId = deptId; _state.selectedSubDeptId = null;
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tree-child').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  const dept = _state.departments.find(d => d.id === deptId);
  document.getElementById('deptRightTitle').textContent = '大部门：' + escHtml(dept.name);
  document.getElementById('deptRightContent').innerHTML = `
    <div class="flex gap-6 mb-10"><button class="btn btn-primary btn-sm" onclick="showAddSubDeptModal(${deptId})">+ 添加小部门</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>小部门名称</th><th>操作</th></tr></thead>
      <tbody>${_state.subDepartments.filter(s=>s.dept_id===deptId).map(s=>`<tr><td>${escHtml(s.name)}</td><td><button class="btn btn-sm btn-danger" onclick="delSubDept(${s.id})">删除</button></td></tr>`).join('')}</tbody>
    </table></div>`;
}

async function selectSubDept(subDeptId, deptId) {
  _state.selectedSubDeptId = subDeptId; _state.selectedDeptId = deptId;
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tree-child').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  const s = _state.subDepartments.find(x => x.id === subDeptId);
  document.getElementById('deptRightTitle').textContent = '小部门：' + escHtml(s.name);
  document.getElementById('deptRightContent').innerHTML = '<div class="empty-state">该小部门下暂无其他操作</div>';
}

async function showAddDeptModal() {
  openModal(`<div class="modal-title">添加大部门</div>
    <div class="form-group mb-10"><label>部门名称</label><input id="new-dept-name" type="text" placeholder="例如：面部"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doAddDept()">保存</button></div>`);
}
async function doAddDept() {
  const name = document.getElementById('new-dept-name').value.trim();
  if (!name) return toast('请输入部门名称', 'error');
  const r = await post('/api/departments', { name });
  if (r.ok) { closeModal(); toast('添加成功', 'success'); loadDepartments(); }
  else toast(r.error || '添加失败', 'error');
}
async function delDept(deptId) {
  if (!confirm('删除大部门会同时删除其下所有小部门，确认？')) return;
  await del(`/api/departments/${deptId}`); toast('已删除', 'info');
  _state.selectedDeptId = null; loadDepartments();
}
async function showAddSubDeptModal(deptId) {
  openModal(`<div class="modal-title">添加小部门</div>
    <div class="form-group mb-10"><label>小部门名称</label><input id="new-sub-name" type="text" placeholder="例如：衣车"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doAddSubDept(${deptId})">保存</button></div>`);
}
async function doAddSubDept(deptId) {
  const name = document.getElementById('new-sub-name').value.trim();
  if (!name) return toast('请输入小部门名称', 'error');
  const r = await post('/api/sub-departments', { dept_id: deptId, name });
  if (r.ok) { closeModal(); toast('添加成功', 'success'); loadDepartments(); }
  else toast(r.error || '添加失败', 'error');
}
async function delSubDept(subDeptId) {
  if (!confirm('确认删除该小部门？')) return;
  await del(`/api/sub-departments/${subDeptId}`); toast('已删除', 'info');
  _state.selectedSubDeptId = null; loadDepartments();
}
