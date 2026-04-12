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
