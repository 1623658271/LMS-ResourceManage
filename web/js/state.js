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

// 快捷计算内部状态
let _qcState = {
  employees: [],       // 与成员管理顺序一致
  models: [],
  subDepartments: [],
  prices: {},           // 内存单价："modelId,subDeptId" -> price
  qtyData: {},          // 对数："empId,modelId" -> qty
  templates: [],
  selectedTemplateId: null,
  priceTemplate: {},   // 单价模板A："modelId,subDeptId" -> price（可编辑）
  qcViewMode: 'qty',   // 'qty' | 'wage'
  qcWageDetail: null,  // 工资明细（切换工资视角时加载）
};

// 单价编辑每行选哪个型号（存 model 名，不存 ID）
let _ptModelSelects = {};  // rowIdx -> modelName (string)

// 快捷计算主表格每行选哪个型号（可编辑下拉，存 model 名）
let _qcModelSelects = {};  // rowIdx -> modelName (string)

// 虚拟行ID计数器（用于标识未选择订单/型号的空行）
let _tempRowCounter = 0;
// 已删除行集合（存储已删除的 orderId|modelId 组合），用于防止重新加载时出现
let _deletedRowKeys = new Set();

// 当前视图
let _currentView = 'overview';
