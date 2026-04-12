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
