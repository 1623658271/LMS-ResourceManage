// ============================================================
// 型号单价表
// ============================================================
async function loadPriceTable() {
  const data = await get('/api/price-table');
  _state.priceData = data;
  const { models, sub_departments, prices } = data;
  if (!models?.length || !sub_departments?.length) {
    document.getElementById('priceTable').innerHTML = '<div class="empty-state">请先添加部门，然后添加型号</div>'; return;
  }
  const thead = `<thead><tr><th style="min-width:90px;">型号</th>${sub_departments.map(s => `<th style="min-width:80px;"><span class="dept-large">${escHtml(s.dept_name)}</span><br><span class="dept-sub">${escHtml(s.name)}</span></th>`).join('')}<th style="min-width:50px;">操作</th></tr></thead>`;
  const tbody = models.map(m => {
    const cells = sub_departments.map(s => {
      const price = prices[`${m.id},${s.id}`] || 0;
      return `<td><input type="number" step="0.01" min="0" class="table-input" value="${price}" onchange="updatePrice(${m.id},${s.id},this.value)"></td>`;
    }).join('');
    return `<tr><td style="font-weight:600;color:var(--primary-dark);">${escHtml(m.model_no)}</td>${cells}<td><button class="btn btn-sm btn-danger" onclick="delModel(${m.id})">删除</button></td></tr>`;
  }).join('');
  document.getElementById('priceTable').innerHTML = `<div class="table-wrap"><table>${thead}<tbody>${tbody}</tbody></table></div>`;
}

async function updatePrice(modelId, subDeptId, val) {
  await put('/api/price-table', { model_id: modelId, sub_dept_id: subDeptId, unit_price: parseFloat(val) || 0 });
  toast('已保存', 'success');
}

async function showAddModelModal() {
  openModal(`<div class="modal-title">添加型号</div>
    <div class="form-group mb-10"><label>型号编号</label><input id="new-model-no" type="text" placeholder="例如：LJ-2024-01"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="doAddModel()">保存</button></div>`);
}

async function doAddModel() {
  const model_no = document.getElementById('new-model-no').value.trim();
  if (!model_no) return toast('请输入型号', 'error');
  const r = await post('/api/models', { model_no });
  if (r.ok) { closeModal(); toast('添加成功', 'success'); loadPriceTable(); }
  else toast(r.error || '添加失败', 'error');
}

async function delModel(modelId) {
  if (!confirm('确认删除该型号？')) return;
  await del(`/api/models/${modelId}`); toast('已删除', 'info'); loadPriceTable();
}
