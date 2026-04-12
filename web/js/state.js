// ============================================================
// 全局状态
// ============================================================
const API = '';

let _state = {
  departments: [],
  subDepartments: [],
  employees: [],
  models: [],
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1,
  workRecords: [],
  workEmployees: [],
  workModels: [],
  workOrders: [],
  workOrderModels: {},
  priceData: null,
  selectedDeptId: null,
  selectedSubDeptId: null,
  viewMode: 'qty',   // 'qty' | 'wage'
  wageDetail: null,  // 工资明细数据
};

// 脏缓存
let _dirtyCells = {};  // "order_id|model_id|emp_id" -> quantity
let _qcData = {};      // 快捷计算：emp_id -> {model_id -> qty}

// 快捷计算内部状态（按大部门分组多表格，无型号）
let _qcState = {
  employees: [],       // 所有员工（含 dept_id, sub_dept_id, dept_name, sub_dept_name）
  departments: [],     // 所有大部门
  subDepartments: [],  // 所有小部门（含 dept_id, dept_name）
  qtyData: {},         // 对数："rowKey,empId" -> qty
  qcViewMode: 'qty',   // 'qty' | 'wage'
  qcWageDetail: null,
};

// 快捷计算：每个大部门表格的行数据
// key = "deptId_rowIdx", value = { 各小部门subDeptId -> 单价值 }
let _qcDeptRows = {};  // "deptId_rowIdx" -> { [subDeptId]: price }

// 虚拟行ID计数器（用于标识未选择订单/型号的空行）
let _tempRowCounter = 0;
// 已删除行集合（存储已删除的 orderId|modelId 组合），用于防止重新加载时出现
let _deletedRowKeys = new Set();

// 当前视图
let _currentView = 'overview';

// ============================================================
// 撤销/重做历史栈
// ============================================================
let _undoStack = [];      // 撤销栈
let _redoStack = [];      // 重做栈
const MAX_HISTORY = 50;   // 最大历史记录数

// 保存当前状态到历史栈
function pushHistory(type) {
  let snapshot = null;
  
  if (type === 'work-edit') {
    // 做货编辑：保存行映射数据（从 work-edit.js 获取）
    if (typeof _weRowMap !== 'undefined') {
      snapshot = {
        type: 'work-edit',
        weRowMap: JSON.parse(JSON.stringify(_weRowMap)),
        timestamp: Date.now()
      };
    }
  } else if (type === 'quick-calc') {
    // 快捷计算：保存单价和对数
    snapshot = {
      type: 'quick-calc',
      qcDeptRows: JSON.parse(JSON.stringify(_qcDeptRows)),
      qtyData: JSON.parse(JSON.stringify(_qcState.qtyData)),
      timestamp: Date.now()
    };
  }
  
  if (snapshot) {
    _undoStack.push(snapshot);
    // 限制历史记录数量
    if (_undoStack.length > MAX_HISTORY) {
      _undoStack.shift();
    }
    // 清空重做栈（新操作后重做栈失效）
    _redoStack = [];
    updateUndoRedoButtons();
  }
}

// 撤销操作
function undo() {
  if (_undoStack.length === 0) return;
  
  const currentSnapshot = _undoStack.pop();
  
  // 保存当前状态到重做栈
  let redoSnapshot = null;
  if (currentSnapshot.type === 'work-edit') {
    if (typeof _weRowMap !== 'undefined') {
      redoSnapshot = {
        type: 'work-edit',
        weRowMap: JSON.parse(JSON.stringify(_weRowMap)),
        timestamp: Date.now()
      };
    }
  } else if (currentSnapshot.type === 'quick-calc') {
    redoSnapshot = {
      type: 'quick-calc',
      qcDeptRows: JSON.parse(JSON.stringify(_qcDeptRows)),
      qtyData: JSON.parse(JSON.stringify(_qcState.qtyData)),
      timestamp: Date.now()
    };
  }
  _redoStack.push(redoSnapshot);
  
  // 恢复到历史状态
  restoreSnapshot(currentSnapshot);
  updateUndoRedoButtons();
}

// 重做操作
function redo() {
  if (_redoStack.length === 0) return;
  
  const redoSnapshot = _redoStack.pop();
  
  // 保存当前状态到撤销栈
  let currentSnapshot = null;
  if (redoSnapshot.type === 'work-edit') {
    if (typeof _weRowMap !== 'undefined') {
      currentSnapshot = {
        type: 'work-edit',
        weRowMap: JSON.parse(JSON.stringify(_weRowMap)),
        timestamp: Date.now()
      };
    }
  } else if (redoSnapshot.type === 'quick-calc') {
    currentSnapshot = {
      type: 'quick-calc',
      qcDeptRows: JSON.parse(JSON.stringify(_qcDeptRows)),
      qtyData: JSON.parse(JSON.stringify(_qcState.qtyData)),
      timestamp: Date.now()
    };
  }
  _undoStack.push(currentSnapshot);
  
  // 恢复到重做状态
  restoreSnapshot(redoSnapshot);
  updateUndoRedoButtons();
}

// 恢复快照
function restoreSnapshot(snapshot) {
  if (snapshot.type === 'work-edit') {
    if (typeof _weRowMap !== 'undefined' && typeof renderWorkTable === 'function') {
      _weRowMap = JSON.parse(JSON.stringify(snapshot.weRowMap));
      renderWorkTable();
    }
  } else if (snapshot.type === 'quick-calc') {
    _qcDeptRows = JSON.parse(JSON.stringify(snapshot.qcDeptRows));
    _qcState.qtyData = JSON.parse(JSON.stringify(snapshot.qtyData));
    renderQcDeptTables();
  }
}

// 更新撤销/重做按钮状态
function updateUndoRedoButtons() {
  // 快捷计算页面按钮
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) {
    undoBtn.disabled = _undoStack.length === 0;
    undoBtn.style.opacity = _undoStack.length === 0 ? '0.5' : '1';
  }
  if (redoBtn) {
    redoBtn.disabled = _redoStack.length === 0;
    redoBtn.style.opacity = _redoStack.length === 0 ? '0.5' : '1';
  }
  
  // 做货编辑页面按钮
  const undoBtnWork = document.getElementById('undoBtnWork');
  const redoBtnWork = document.getElementById('redoBtnWork');
  if (undoBtnWork) {
    undoBtnWork.disabled = _undoStack.length === 0;
    undoBtnWork.style.opacity = _undoStack.length === 0 ? '0.5' : '1';
  }
  if (redoBtnWork) {
    redoBtnWork.disabled = _redoStack.length === 0;
    redoBtnWork.style.opacity = _redoStack.length === 0 ? '0.5' : '1';
  }
}

// 清空历史栈（切换页面时调用）
function clearHistory() {
  _undoStack = [];
  _redoStack = [];
  updateUndoRedoButtons();
}

// 键盘快捷键监听
document.addEventListener('keydown', (e) => {
  // Ctrl+Z 撤销
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Ctrl+Y 重做 或 Ctrl+Shift+Z 重做
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
    e.preventDefault();
    redo();
  }
});

// 工资数据源开关（持久化到数据库 + localStorage）
function toggleQcSalary(enabled) {
  const val = enabled ? 'true' : 'false';
  localStorage.setItem('useQcSalary', val);
  post('/api/app-settings', { key: 'useQcSalary', value: val });
  document.querySelectorAll('#qcSwitch').forEach(el => el.checked = enabled);
  showToast(enabled ? '已启用快捷计算作为工资数据源' : '已切换回做货编辑数据源');
}

async function initQcSwitch() {
  // 优先从数据库读取，fallback 到 localStorage
  let saved = false;
  try {
    const res = await get('/api/app-settings/useQcSalary');
    if (res && res.value === 'true') saved = true;
  } catch(e) {}
  if (!saved) saved = localStorage.getItem('useQcSalary') === 'true';
  // 关键：同步到 localStorage，让 getSalarySource() 能读到正确值
  localStorage.setItem('useQcSalary', saved ? 'true' : 'false');
  document.querySelectorAll('#qcSwitch').forEach(el => el.checked = saved);
}
