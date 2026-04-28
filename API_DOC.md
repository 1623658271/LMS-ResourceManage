# 立杰人力资源管理系统 — API 接口文档

> **基础 URL**: `http://localhost:8765`
> **Content-Type**: `application/json`
> **数据库**: SQLite（data.db），所有接口返回 JSON
> **通用约定**:
> - 成功写操作返回 `{"ok": true, ...}`
> - 失败写操作返回 `{"ok": false, "error": "错误描述"}`
> - ID 字段均为整数自增主键
> - `line_id` 为逻辑行号（同 order+model 可有多行），默认 0
> - 列表查询返回空数组 `[]`，详情查询无数据返回 `null`

---

## 一、数据库表结构概览

| 表名 | 说明 | 主键 |
|------|------|------|
| `departments` | 大部门（面部、底部） | `id` |
| `sub_departments` | 小部门（衣车、折面、折边、底部） | `id`, FK→departments |
| `models` | 型号（A2026、B2026 等） | `id` |
| `model_prices` | 型号-小部门单价 | `id`, FK→models, FK→sub_departments |
| `employees` | 员工 | `id`, FK→departments, FK→sub_departments |
| `orders` | 订单 | `id` |
| `order_models` | 订单-型号关联 | `id`, FK→orders, FK→models |
| `work_records` | 做货记录（对数） | `id`, FK→employees, FK→orders, FK→models |
| `salary_adjustments` | 人工增扣 | `id`, FK→employees, UNIQUE(emp_id,year,month) |
| `quick_calc_saves` | 快捷计算保存 | `id`, UNIQUE(year,month) |
| `app_settings` | 全局设置键值 | `key` |

**默认数据**:
- 大部门：面部(id=1)、底部(id=2)
- 小部门：衣车(id=1, 面部)、折面(id=2, 面部)、折边(id=3, 面部)、底部(id=4, 底部)

---

## 二、部门管理

### 2.1 获取所有大部门

```
GET /api/departments
```

**响应**:
```json
[
  {"id": 1, "name": "面部"},
  {"id": 2, "name": "底部"}
]
```

---

### 2.2 添加大部门

```
POST /api/departments
Body: { "name": "面部" }
```

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该部门已存在"}`

---

### 2.3 删除大部门

```
DELETE /api/departments/{dept_id}
```

> ⚠️ 级联删除该部门下所有小部门、员工及关联数据

**响应**: `{"ok": true}`

---

### 2.4 获取小部门

```
GET /api/sub-departments
GET /api/sub-departments?dept_id=1
```

- `dept_id` 可选，不传则返回所有小部门（含 `dept_name`）

**响应**:
```json
[
  {"id": 1, "dept_id": 1, "name": "衣车", "dept_name": "面部"},
  {"id": 2, "dept_id": 1, "name": "折面", "dept_name": "面部"},
  {"id": 3, "dept_id": 1, "name": "折边", "dept_name": "面部"},
  {"id": 4, "dept_id": 2, "name": "底部", "dept_name": "底部"}
]
```

---

### 2.5 添加小部门

```
POST /api/sub-departments
Body: { "dept_id": 1, "name": "衣车" }
```

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该小部门已存在"}`

---

### 2.6 删除小部门

```
DELETE /api/sub-departments/{sub_dept_id}
```

**响应**: `{"ok": true}`

---

## 三、员工管理

### 3.1 获取所有员工

```
GET /api/employees
```

**响应**:
```json
[
  {
    "id": 1,
    "name": "张三",
    "gender": "女",
    "dept_id": 1,
    "sub_dept_id": 1,
    "dept_name": "面部",
    "sub_dept_name": "衣车"
  }
]
```

---

### 3.2 添加员工

```
POST /api/employees
Body: { "name": "张三", "gender": "女", "dept_id": 1, "sub_dept_id": 1 }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 姓名 |
| `gender` | string | ❌ | `"男"` 或 `"女"`，默认 `"男"` |
| `dept_id` | int | ✅ | 大部门 ID |
| `sub_dept_id` | int | ✅ | 小部门 ID |

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该员工已存在"}`

---

### 3.3 更新员工

```
PUT /api/employees/{emp_id}
Body: { "name": "新名字", "gender": "女", "dept_id": 1, "sub_dept_id": 2 }
```

- 所有字段均可选，只传需要修改的字段

**响应**: `{"ok": true}`

---

### 3.4 删除员工

```
DELETE /api/employees/{emp_id}
```

> ⚠️ 级联删除该员工所有做货记录和增扣记录

**响应**: `{"ok": true}`

---

### 3.5 获取员工单月工资明细

```
GET /api/employees/{emp_id}/detail?year=2026&month=4
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |

**响应**:
```json
{
  "wage": 1234.56,
  "total_pairs": 362,
  "adj_quantity": 0,
  "adj_amount": -100.0,
  "reason": "请假扣款",
  "total": 1134.56
}
```

---

### 3.6 获取员工历史工资记录

```
GET /api/employees/{emp_id}/work-history
GET /api/employees/{emp_id}/work-history?source=work
GET /api/employees/{emp_id}/work-history?source=qc
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `source` | string | `"work"` | `"work"` 从做货编辑读取，`"qc"` 从快捷计算读取 |

**响应**:
```json
{
  "employee": {
    "id": 1,
    "name": "张三",
    "gender": "女",
    "dept_id": 1,
    "sub_dept_id": 1,
    "dept_name": "面部",
    "sub_dept_name": "衣车"
  },
  "history": [
    {
      "year": 2026,
      "month": 4,
      "records": [
        {
          "id": 10,
          "year": 2026,
          "month": 4,
          "order_id": 1,
          "order_no": "ORD-001",
          "model_id": 1,
          "emp_id": 1,
          "quantity": 362,
          "line_id": 0,
          "model_no": "A2026",
          "unit_price": 1.1,
          "line_wage": 398.2
        }
      ],
      "month_wage": 398.2,
      "total_pairs": 362,
      "adj_quantity": 0,
      "adj_amount": -100.0,
      "adj_reason": "请假扣款",
      "total": 298.2
    }
  ]
}
```

> 注意：`source=qc` 时 `records` 为空数组 `[]`（快捷计算无逐条明细）

---

## 四、订单管理

### 4.1 获取订单列表

```
GET /api/orders
GET /api/orders?year=2026&month=4
```

- `year`/`month` 可选，不传返回全部

**响应**:
```json
[
  {
    "id": 1,
    "order_no": "ORD-001",
    "year": 2026,
    "month": 4,
    "remark": "加急",
    "total_pairs": 2100,
    "models": [
      {"id": 1, "model_no": "A2026"},
      {"id": 2, "model_no": "B2026"}
    ]
  }
]
```

---

### 4.2 添加订单

```
POST /api/orders
Body: {
  "order_no": "ORD-004",
  "year": 2026,
  "month": 4,
  "model_ids": [1, 2],
  "remark": "备注"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `order_no` | string | ✅ | 订单号 |
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |
| `model_ids` | int[] | ❌ | 关联的型号 ID 数组 |
| `remark` | string | ❌ | 备注 |

**响应**: `{"ok": true, "order_id": 4}` 或 `{"ok": false, "error": "..."}`

---

### 4.3 更新订单

```
PUT /api/orders/{order_id}
Body: { "order_no": "ORD-004-修改", "model_ids": [1, 3], "remark": "新备注" }
```

- 三个字段均可选，只传需要修改的字段

**响应**: `{"ok": true}`

---

### 4.4 删除订单

```
DELETE /api/orders/{order_id}
```

> ⚠️ 级联删除关联的 order_models 和 work_records

**响应**: `{"ok": true}`

---

## 五、型号管理

### 5.1 获取所有型号

```
GET /api/models
```

**响应**: `[{"id": 1, "model_no": "A2026"}, {"id": 2, "model_no": "B2026"}]`

---

### 5.2 添加型号

```
POST /api/models
Body: { "model_no": "C2026" }
```

> 自动为所有小部门创建默认单价 0 的记录

**响应**: `{"ok": true, "model_id": 3}` 或 `{"ok": false, "error": "该型号已存在"}`

---

### 5.3 更新型号

```
PUT /api/models/{model_id}
Body: { "model_no": "C2026-NEW" }
```

**响应**: `{"ok": true}`

---

### 5.4 删除型号

```
DELETE /api/models/{model_id}
```

**响应**: `{"ok": true}`

---

## 六、型号单价表

### 6.1 获取完整单价表

```
GET /api/price-table
```

**响应**:
```json
{
  "models": [{"id": 1, "model_no": "A2026"}],
  "sub_departments": [
    {"id": 1, "dept_id": 1, "name": "衣车", "dept_name": "面部"}
  ],
  "prices": {
    "1,1": 1.1,
    "1,2": 1.3,
    "2,1": 0.8
  }
}
```

> `prices` 的 key 格式为 `"model_id,sub_dept_id"`（字符串）

---

### 6.2 更新单个单价

```
PUT /api/price-table
Body: { "model_id": 1, "sub_dept_id": 1, "unit_price": 1.5 }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model_id` | int | ✅ | 型号 ID |
| `sub_dept_id` | int | ✅ | 小部门 ID |
| `unit_price` | float | ✅ | 单价 |

**响应**: `{"ok": true}`

---

### 6.3 批量保存某型号所有小部门单价

```
POST /api/model-prices
Body: {
  "model_id": 1,
  "items": [
    {"sub_dept_id": 1, "unit_price": 1.5},
    {"sub_dept_id": 2, "unit_price": 1.3}
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model_id` | int | ✅ | 型号 ID |
| `items` | object[] | ✅ | 单价列表 |

**响应**: `{"ok": true, "saved": 2}`

---

## 七、做货编辑

### 7.1 获取做货记录

```
GET /api/work-records?year=2026&month=4
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |

**响应**:
```json
{
  "records": [
    {
      "id": 1,
      "year": 2026,
      "month": 4,
      "order_id": 1,
      "order_no": "ORD-001",
      "model_id": 1,
      "model_no": "A2026",
      "emp_id": 1,
      "emp_name": "张三",
      "sub_dept_id": 1,
      "quantity": 362,
      "line_id": 0
    }
  ],
  "employees": [{"id": 1, "name": "张三", "sub_dept_id": 1, "sub_dept_name": "衣车"}],
  "orders": [{"id": 1, "order_no": "ORD-001"}],
  "models": [{"id": 1, "model_no": "A2026"}],
  "order_models": {"1": [{"id": 1, "model_no": "A2026"}]}
}
```

---

### 7.2 保存/更新做货记录

```
POST /api/work-records
Body: {
  "year": 2026,
  "month": 4,
  "order_id": 1,
  "model_id": 1,
  "emp_id": 1,
  "quantity": 362,
  "line_id": 0
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |
| `order_id` | int | ✅ | 订单 ID |
| `model_id` | int | ✅ | 型号 ID |
| `emp_id` | int | ✅ | 员工 ID |
| `quantity` | int | ✅ | 对数（≥0 更新，<0 删除） |
| `line_id` | int | ❌ | 逻辑行号，默认 0（同一 order+model 可有多行） |

**逻辑**:
- `quantity >= 0`: upsert（存在则更新）
- `quantity < 0`: 删除该记录

**响应**: `{"ok": true, "id": 1, "line_id": 0}`

---

### 7.3 删除单条做货记录

```
DELETE /api/work-records?year=2026&month=4&order_id=1&model_id=1&emp_id=1&line_id=0
```

| 参数 | 类型 | 必填 |
|------|------|------|
| `year` | int | ✅ |
| `month` | int | ✅ |
| `order_id` | int | ✅ |
| `model_id` | int | ✅ |
| `emp_id` | int | ✅ |
| `line_id` | int | ❌ 默认 0 |

**响应**: `{"ok": true}`

---

### 7.4 批量删除整行做货记录

```
DELETE /api/work-row?year=2026&month=4&order_id=1&model_id=1&line_id=0
```

> 删除同一订单+型号+line_id 下的所有员工记录

| 参数 | 类型 | 必填 |
|------|------|------|
| `year` | int | ✅ |
| `month` | int | ✅ |
| `order_id` | int | ✅ |
| `model_id` | int | ✅ |
| `line_id` | int | ❌ 默认 0 |

**响应**: `{"ok": true}`

---

## 八、人工增扣

### 8.1 保存人工增扣

```
POST /api/adjustments
Body: {
  "emp_id": 1,
  "year": 2026,
  "month": 4,
  "adj_quantity": 0,
  "adj_amount": -100.0,
  "reason": "请假扣款"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `emp_id` | int | ✅ | 员工 ID |
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |
| `adj_quantity` | float | ❌ | 增扣对数（可为小数），默认 0 |
| `adj_amount` | float | ❌ | 增扣金额（正数=加钱，负数=扣钱），默认 0 |
| `reason` | string | ❌ | 原因说明 |

> 同一员工同月只能有一条，重复保存会覆盖

**响应**: `{"ok": true}`

---

## 九、总工资表

### 9.1 获取总工资汇总

```
GET /api/salary-summary?year=2026&month=4
GET /api/salary-summary?year=2026&month=4&source=work
GET /api/salary-summary?year=2026&month=4&source=qc
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |
| `source` | string | `"work"` | 数据源：`"work"` 从做货编辑，`"qc"` 从快捷计算 |

**响应**:
```json
[
  {
    "dept_id": 1,
    "dept_name": "面部",
    "total_pairs": 1200,
    "total_wage": 1560.0,
    "employees": [
      {
        "emp_id": 1,
        "name": "张三",
        "sub_dept_name": "衣车",
        "pairs": 362,
        "wage": 398.2,
        "adj_amount": -100.0,
        "total": 298.2
      }
    ]
  },
  {
    "dept_id": 2,
    "dept_name": "底部",
    "total_pairs": 2100,
    "total_wage": 2730.0,
    "employees": [...]
  }
]
```

> 返回按大部门分组的数组，每个部门含 `total_pairs`（总对数）、`total_wage`（总工资）、`employees`（员工列表）

---

## 十、工资计算明细（格子级）

### 10.1 获取工资明细

```
GET /api/wage-detail?year=2026&month=4
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |

**响应**:
```json
{
  "orders": [
    {"id": 1, "order_no": "ORD-001", "total_pairs": 2100}
  ],
  "employees": [
    {"id": 1, "name": "张三", "sub_dept_id": 1, "sub_dept_name": "衣车"}
  ],
  "models": [{"id": 1, "model_no": "A2026"}],
  "order_models": {"1": [{"id": 1, "model_no": "A2026"}]},
  "quantities": {"1,1,1": 362},
  "wages": {"1,1,1": 398.2},
  "price_map": {"1,1": 1.1}
}
```

| 字段 | key 格式 | 说明 |
|------|----------|------|
| `quantities` | `"order_id,model_id,emp_id"` | 每个格子的对数 |
| `wages` | `"order_id,model_id,emp_id"` | 每个格子的工资 = 对数 × 单价 |
| `price_map` | `"model_id,sub_dept_id"` | 型号-小部门单价映射 |

---

## 十一、快捷计算

### 11.1 保存快捷计算数据

```
POST /api/quick-calc-save
Body: {
  "year": 2026,
  "month": 4,
  "dept_rows": {
    "2_0": {"4": 1.1},
    "2_1": {"4": 1.3},
    "1_0": {"1": 0.0, "2": 1.1, "3": 1.3}
  },
  "qty_data": {
    "2_0,1": 362,
    "2_0,2": 362,
    "1_0,5": 300
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `year` | int | ✅ | 年份 |
| `month` | int | ✅ | 月份 |
| `dept_rows` | object | ✅ | 大部门分组行数据 |
| `qty_data` | object | ✅ | 每行的员工对数数据 |

**dept_rows 格式**:
- key: `"deptId_rowIdx"`，如 `"1_0"` 表示大部门1的第0行
- value: `{subDeptId: 单价}`，subDeptId 在 JSON 中为字符串

**qty_data 格式**:
- key: `"rowKey,empId"`，如 `"2_0,1"` 表示第2大部门第0行中员工ID=1的对数
- value: 对数（数字）

> 同年月覆盖保存

**响应**: `{"ok": true}`

---

### 11.2 加载快捷计算数据

```
GET /api/quick-calc-save?year=2026&month=4
```

| 参数 | 类型 | 必填 |
|------|------|------|
| `year` | int | ✅ |
| `month` | int | ✅ |

**响应**（有数据时）:
```json
{
  "dept_rows": {
    "2_0": {"4": 1.1},
    "2_1": {"4": 1.3},
    "1_0": {"1": "0.0", "2": "1.1", "3": "1.3"}
  },
  "qty_data": {"2_0,1": 362, "2_0,2": 362}
}
```

**响应**（无数据时）: `null`

---

## 十二、全局设置

### 12.1 获取单个设置项

```
GET /api/app-settings/{key}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | ✅ | 设置项名称 |

**响应**: `{"value": "true"}` 或 `{"value": ""}`（不存在时返回空字符串）

---

### 12.2 保存单个设置项

```
POST /api/app-settings
Body: { "key": "useQcSalary", "value": "true" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | ✅ | 设置项名称 |
| `value` | string | ✅ | 设置值 |

**常用 key**:

| key | 说明 | 值 |
|-----|------|----|
| `useQcSalary` | 工资数据源开关 | `"true"` / `"false"` |

**响应**: `{"ok": true}`

---

### 12.3 批量获取所有 UI 设置

```
GET /api/app-settings-all
```

> 返回所有以 `ui_` 为前缀的 UI 设置项（不含业务设置）

**响应**:
```json
{
  "ui_fontSize-base": 14,
  "ui_darkmode": false,
  "ui_primary": "#3b82f6",
  "ui_table-fontSize": 13
}
```

> 返回的 key 带有 `ui_` 前缀，类型已还原（布尔/数字/字符串）

---

### 12.4 批量保存所有 UI 设置

```
POST /api/app-settings-all
Body: {
  "ui_fontSize-base": 15,
  "ui_darkmode": true,
  "ui_primary": "#3b82f6"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| - | object | ✅ | 键值对，key 应带 `ui_` 前缀 |

> 自动将布尔/数字类型转为字符串存储到数据库

**响应**: `{"ok": true}`

---

## 十三、单价模板

> 以下接口仍可用，但前端已移除模板功能（参考用）

### 13.1 获取所有模板

```
GET /api/price-templates
```

**响应**:
```json
[{"id": 1, "name": "模板1"}, {"id": 2, "name": "模板2"}]
```

---

### 13.2 创建/覆盖模板

```
POST /api/price-templates
Body: {
  "name": "模板1",
  "items": [
    {"model_id": 1, "sub_dept_id": 1, "unit_price": 0.8}
  ]
}
```

> 同名模板会先删除再创建（覆盖）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 模板名称 |
| `items` | object[] | ✅ | 单价项列表 |

**响应**: `{"ok": true, "template_id": 1}`

---

### 13.3 加载模板

```
GET /api/price-templates/{template_id}
```

**响应**:
```json
{
  "name": "模板1",
  "prices": {"1,1": 0.8, "1,2": 1.0}
}
```

---

### 13.4 删除模板

```
DELETE /api/price-templates/{template_id}
```

**响应**: `{"ok": true}`

---

## 十四、数据清理

### 14.1 清理业务数据

```
DELETE /api/data/clean
DELETE /api/data/clean?emp_id=1
DELETE /api/data/clean?year=2026&month=4
DELETE /api/data/clean?emp_id=1&year=2026&month=4
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `emp_id` | int | ❌ | 员工 ID（不传则不限员工） |
| `year` | int | ❌ | 年份（需与 month 同时传才生效） |
| `month` | int | ❌ | 月份（需与 year 同时传才生效） |

**清理范围对照表**:

| 参数组合 | 清理内容 |
|----------|----------|
| 全部不传 | 清空 work_records + salary_adjustments + quick_calc_saves |
| `emp_id` | 该员工所有做货记录和增扣 |
| `year`+`month` | 指定年月所有做货记录、增扣、快捷计算保存 |
| `emp_id`+`year`+`month` | 该员工指定年月的做货记录和增扣（快捷计算不支持按成员删除） |

> ⚠️ 此操作不可恢复，请谨慎使用

**响应**: `{"ok": true}`

---

## 十四B、自定义字体管理

> 自定义字体文件存放在 `web/fonts/` 目录，通过静态路径 `/fonts/{filename}` 访问。
> 字体列表持久化在 `app_settings` 表，key 为 `custom_fonts`（JSON 数组）。

### 14B.1 上传字体文件

```
POST /api/fonts/upload
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | ✅ | 字体文件（.ttf / .ttc / .woff / .woff2 / .otf），上限 50MB |

**处理逻辑**:
1. 验证文件扩展名和大小
2. 文件名用 UUID 重命名，避免冲突
3. 同 display_name 的字体会覆盖旧文件
4. 字体元信息存入 `app_settings` 表的 `custom_fonts` key

**响应**:
```json
{
  "ok": true,
  "font": {
    "filename": "a1b2c3d4.ttf",
    "display_name": "华文行楷",
    "font_family": "custom_华文行楷_a1b2c3d4",
    "url": "/fonts/a1b2c3d4.ttf"
  }
}
```

| 字段 | 说明 |
|------|------|
| `filename` | 服务器上的文件名（UUID） |
| `display_name` | 用户看到的字体显示名（取自原始文件名） |
| `font_family` | CSS `font-family` 值，格式为 `custom_{显示名}_{文件名前8位}` |
| `url` | 字体文件的访问路径 |

---

### 14B.2 获取已保存的自定义字体列表

```
GET /api/fonts/list
```

**响应**:
```json
{
  "fonts": [
    {
      "filename": "a1b2c3d4.ttf",
      "display_name": "华文行楷",
      "font_family": "custom_华文行楷_a1b2c3d4",
      "url": "/fonts/a1b2c3d4.ttf"
    }
  ]
}
```

> 无自定义字体时返回 `{"fonts": []}`

---

### 14B.3 删除自定义字体

```
DELETE /api/fonts/{filename}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filename` | string | ✅ | 字体文件名（UUID，如 `a1b2c3d4.ttf`） |

**处理逻辑**:
1. 删除 `web/fonts/` 下的字体文件
2. 从 `app_settings` 的 `custom_fonts` 中移除该条记录

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "字体文件不存在"}`

---

## 十五、数据库导入导出

### 15.1 导出数据库

```
GET /api/database/export
```

> 将整个 SQLite 数据库文件编码为 base64 字符串返回

**响应**:
```json
{
  "ok": true,
  "data": "U0lRTGVtYmVkIGZpbGVGb3JtYXQ...",
  "filename": "li_jie_hr_backup.db"
}
```

> `data` 字段为 base64 编码的数据库文件内容

---

### 15.2 导入数据库

```
POST /api/database/import
Body: { "data": "U0lRTGVtYmVkIGZpbGVGb3JtYXQ..." }
```

> ⚠️ 导入将覆盖当前所有数据，导入前会自动备份当前数据库

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | string | ✅ | base64 编码的 SQLite 数据库文件内容 |

> 前端导入成功后会自动刷新页面

**响应**: `{"ok": true}`

---

## 十六、窗口设置

### 16.1 获取窗口设置

```
GET /api/window/settings
```

**响应**（有配置文件时）:
```json
{
  "ok": true,
  "config": {
    "width": 1400,
    "height": 900,
    "fullscreen": false,
    "maximized": false
  }
}
```

**响应**（无配置文件，返回默认）:
```json
{
  "ok": true,
  "config": {
    "width": 1400,
    "height": 900,
    "fullscreen": false,
    "maximized": false
  }
}
```

> `fullscreen` 和 `maximized` 为互斥状态，两者不能同时为 `true`

---

### 16.2 保存窗口设置

```
POST /api/window/settings
Body: {
  "width": 1920,
  "height": 1080,
  "fullscreen": false,
  "maximized": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `width` | int | ❌ | 窗口宽度（像素），默认 1400 |
| `height` | int | ❌ | 窗口高度（像素），默认 900 |
| `fullscreen` | bool | ❌ | 全屏模式，默认 false |
| `maximized` | bool | ❌ | 最大化模式，默认 false |

> `fullscreen` 和 `maximized` 为互斥状态，建议只传一个为 `true`

**响应**: `{"ok": true}`

---

## 十七、初始化

### 17.1 初始化数据库

```
GET /api/init
```

> 强制初始化数据库（创建表、插入默认数据）。幂等操作，已存在则跳过。

**响应**: `{"ok": true}`

---

## 附录：业务逻辑说明

### A.1 工资计算公式

**做货编辑模式 (`source=work`)**:
```
员工做货工资 = Σ(做货对数 × 该型号在该员工小部门的单价)
员工总工资 = 做货工资 + 人工增扣金额
```

**快捷计算模式 (`source=qc`)**:
```
员工做货工资 = Σ(该大部门每行的对数 × 该员工小部门在该行的单价)
员工总工资 = 做货工资 + 人工增扣金额
```

---

### A.2 数据源切换

通过 `app_settings` 表的 `useQcSalary` 字段控制：
- `"false"`（默认）→ 总工资表和成员详情使用做货编辑数据
- `"true"` → 总工资表和成员详情使用快捷计算数据

两种数据源独立计算，互不影响。

---

### A.3 UI 设置持久化

UI 设置（如字体大小、颜色主题）通过以下流程持久化：

1. **保存**：前端将所有设置以 `ui_` 为前缀批量写入 `app_settings` 表
2. **读取**：启动时以 `ui_` 前缀批量读取，还原类型后合并默认配置
3. **存储格式**：
   - 布尔值：存储为 `"true"` / `"false"` 字符串
   - 数字：存储为数字字符串
   - 字符串：直接存储

---

### A.4 窗口设置持久化

窗口设置（宽、高、全屏、最大化）保存在项目根目录的 `window_settings.json` 文件中：
- 窗口尺寸用于程序启动时的初始大小
- 全屏和最大化在启动时生效，且两者互斥

---

### A.5 前端状态管理

- **撤销/重做**: 使用 `state.js` 中的 `pushHistory()` / `undo()` / `redo()`
- **历史栈**: `_historyStack` 存储状态快照，支持 `clearHistory()` 重置
- **自动保存**: 做货编辑和快捷计算均支持 300ms 防抖自动保存

---

### A.6 表格显示优化

- 员工超过 8 人时自动拆分为多个独立表格纵向排列
- 大额工资使用紧凑格式（<1万显示 ¥1234.56，≥1万显示 ¥1.2万）
- 支持工资视角切换，实时显示每个格子的工资
