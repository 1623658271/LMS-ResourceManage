# 立杰人力资源管理系统 — API 接口文档

> **基础 URL**: `http://localhost:8688`
> **Content-Type**: `application/json`
> **数据库**: SQLite（data.db），所有接口返回 JSON
> **通用约定**:
> - 成功写操作返回 `{"ok": true, ...}`
> - 失败写操作返回 `{"ok": false, "error": "错误描述"}`
> - ID 字段均为整数自增主键
> - `line_id` 为逻辑行号（同 order+model 可有多行），默认 0

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
| `work_records` | 做货记录（对数） | `id`, FK→employees, UNIQUE(year,month,line_id,order_id,model_id,emp_id) |
| `salary_adjustments` | 人工增扣 | `id`, FK→employees, UNIQUE(emp_id,year,month) |
| `quick_calc_saves` | 快捷计算保存 | `id`, UNIQUE(year,month) |
| `app_settings` | 全局设置键值 | `key` |
| `price_templates` / `price_template_items` | 单价模板 | 已弃用 |

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

### 2.2 添加大部门

```
POST /api/departments
Body: { "name": "面部" }
```

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该部门已存在"}`

### 2.3 删除大部门

```
DELETE /api/departments/{dept_id}
```

> ⚠️ 级联删除该部门下所有小部门、员工及关联数据

**响应**: `{"ok": true}`

### 2.4 获取小部门

```
GET /api/sub-departments?dept_id=1
```

- `dept_id` 可选，不传则返回所有小部门（含 `dept_name`）

**响应**:
```json
[
  {"id": 1, "dept_id": 1, "name": "衣车", "dept_name": "面部"},
  {"id": 2, "dept_id": 1, "name": "折面", "dept_name": "面部"},
  {"id": 3, "dept_id": 1, "name": "折边", "dept_name": "面部"}
]
```

### 2.5 添加小部门

```
POST /api/sub-departments
Body: { "dept_id": 1, "name": "衣车" }
```

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该小部门已存在"}`

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

### 3.2 添加员工

```
POST /api/employees
Body: { "name": "张三", "gender": "女", "dept_id": 1, "sub_dept_id": 1 }
```

- `gender`: `"男"` 或 `"女"`，默认 `"男"`
- `dept_id`: 大部门 ID
- `sub_dept_id`: 小部门 ID

**响应**: `{"ok": true}` 或 `{"ok": false, "error": "该员工已存在"}`

### 3.3 更新员工

```
PUT /api/employees/{emp_id}
Body: { "name": "新名字", "gender": "女", "dept_id": 1, "sub_dept_id": 2 }
```

**响应**: `{"ok": true}`

### 3.4 删除员工

```
DELETE /api/employees/{emp_id}
```

> ⚠️ 级联删除该员工所有做货记录和增扣记录

**响应**: `{"ok": true}`

### 3.5 获取员工单月工资明细

```
GET /api/employees/{emp_id}/detail?year=2026&month=4
```

**响应**（source=work，从做货编辑计算）:
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

### 3.6 获取员工历史工资记录

```
GET /api/employees/{emp_id}/work-history?source=work
GET /api/employees/{emp_id}/work-history?source=qc
```

- `source`: `"work"`（默认，从做货编辑读取）或 `"qc"`（从快捷计算读取）

**响应**:
```json
{
  "employee": {"id": 1, "name": "张三", "gender": "女", "dept_id": 1, "sub_dept_id": 1, "dept_name": "面部", "sub_dept_name": "衣车"},
  "history": [
    {
      "year": 2026,
      "month": 4,
      "records": [
        {"id": 10, "year": 2026, "month": 4, "order_id": 1, "order_no": "ORD-001", "model_id": 1, "emp_id": 1, "quantity": 362, "line_id": 0, "model_no": "A2026", "unit_price": 1.1, "line_wage": 398.2}
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

### 4.2 添加订单

```
POST /api/orders
Body: { "order_no": "ORD-004", "year": 2026, "month": 4, "model_ids": [1, 2], "remark": "备注" }
```

- `model_ids`: 关联的型号 ID 数组，可选

**响应**: `{"ok": true, "order_id": 4}` 或 `{"ok": false, "error": "..."}`

### 4.3 更新订单

```
PUT /api/orders/{order_id}
Body: { "order_no": "ORD-004-修改", "model_ids": [1, 3], "remark": "新备注" }
```

- 三个字段均可选，只传需要修改的字段

**响应**: `{"ok": true}`

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

### 5.2 添加型号

```
POST /api/models
Body: { "model_no": "C2026" }
```

> 自动为所有小部门创建默认单价 0 的记录

**响应**: `{"ok": true, "model_id": 3}` 或 `{"ok": false, "error": "该型号已存在"}`

### 5.3 更新型号

```
PUT /api/models/{model_id}
Body: { "model_no": "C2026-NEW" }
```

**响应**: `{"ok": true}`

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
  "sub_departments": [{"id": 1, "dept_id": 1, "name": "衣车", "dept_name": "面部"}],
  "prices": {
    "1,1": 1.1,
    "1,2": 1.3,
    "2,1": 0.8
  }
}
```

> `prices` 的 key 格式为 `"model_id,sub_dept_id"`（字符串）

### 6.2 更新单个单价

```
PUT /api/price-table
Body: { "model_id": 1, "sub_dept_id": 1, "unit_price": 1.5 }
```

**响应**: `{"ok": true}`

### 6.3 批量保存某型号单价

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

**响应**: `{"ok": true, "saved": 2}`

---

## 七、做货编辑

### 7.1 获取做货记录

```
GET /api/work-records?year=2026&month=4
```

**响应**:
```json
{
  "records": [
    {
      "id": 1,
      "year": 2026, "month": 4,
      "order_id": 1, "order_no": "ORD-001",
      "model_id": 1, "model_no": "A2026",
      "emp_id": 1, "emp_name": "张三", "sub_dept_id": 1,
      "quantity": 362, "line_id": 0
    }
  ],
  "employees": [{"id": 1, "name": "张三", "sub_dept_id": 1, "sub_dept_name": "衣车"}],
  "orders": [{"id": 1, "order_no": "ORD-001"}],
  "models": [{"id": 1, "model_no": "A2026"}],
  "order_models": {"1": [{"id": 1, "model_no": "A2026"}]}
}
```

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

- `quantity < 0` 时删除该记录
- `quantity >= 0` 时 upsert（存在则更新）
- `line_id` 默认 0

**响应**: `{"ok": true, "id": 1, "line_id": 0}`

### 7.3 删除单条做货记录

```
DELETE /api/work-records?year=2026&month=4&order_id=1&model_id=1&emp_id=1&line_id=0
```

**响应**: `{"ok": true}`

### 7.4 删除整行做货记录

```
DELETE /api/work-row?year=2026&month=4&order_id=1&model_id=1&line_id=0
```

> 删除同一订单+型号+line_id 下的所有员工记录

**响应**: `{"ok": true}`

---

## 八、人工增扣

### 8.1 保存人工增扣

```
POST /api/adjustments
Body: { "emp_id": 1, "year": 2026, "month": 4, "adj_quantity": 0, "adj_amount": -100.0, "reason": "请假扣款" }
```

- `adj_quantity`: 增扣对数（可为小数）
- `adj_amount`: 增扣金额（正数=加钱，负数=扣钱）
- `reason`: 原因说明
- 同一员工同月只能有一条，重复保存会覆盖

**响应**: `{"ok": true}`

---

## 九、总工资表

### 9.1 获取总工资汇总

```
GET /api/salary-summary?year=2026&month=4
GET /api/salary-summary?year=2026&month=4&source=qc
```

- `source`: `"work"`（默认，从做货编辑计算）或 `"qc"`（从快捷计算计算）

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

### 9.2 获取快捷计算工资汇总（旧接口，与 9.1 source=qc 等价）

```
GET /api/qc-salary-summary?year=2026&month=4
```

---

## 十、工资计算明细（格子级）

### 10.1 获取工资明细

```
GET /api/wage-detail?year=2026&month=4
```

**响应**:
```json
{
  "orders": [{"id": 1, "order_no": "ORD-001", "total_pairs": 2100}],
  "employees": [{"id": 1, "name": "张三", "sub_dept_id": 1, "sub_dept_name": "衣车"}],
  "models": [{"id": 1, "model_no": "A2026"}],
  "order_models": {"1": [{"id": 1, "model_no": "A2026"}]},
  "quantities": {"1,1,1": 362},
  "wages": {"1,1,1": 398.2},
  "price_map": {"1,1": 1.1}
}
```

> `quantities` 和 `wages` 的 key 格式为 `"order_id,model_id,emp_id"`（字符串）
> `price_map` 的 key 格式为 `"model_id,sub_dept_id"`

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

- `dept_rows`: key 格式 `"deptId_rowIdx"`，value 是 `{subDeptId: 单价}` 的字典
  - subDeptId 在 JSON 中为字符串（如 `"4"`）
  - 同一大部门的 rowIdx 从 0 递增
- `qty_data`: key 格式 `"rowKey,empId"`，value 为对数（数字）
- 同年月覆盖保存

**响应**: `{"ok": true}`

### 11.2 加载快捷计算数据

```
GET /api/quick-calc-save?year=2026&month=4
```

**响应**:
```json
{
  "dept_rows": {"2_0": {"4": 1.1}, "2_1": {"4": 1.3}, "1_0": {"1": "0.0", "2": "1.1", "3": "1.3"}},
  "qty_data": {"2_0,1": 362, "2_0,2": 362}
}
```

> 无数据时返回 `null`

---

## 十二、全局设置

### 12.1 获取设置项

```
GET /api/app-settings/{key}
```

**响应**: `{"value": "true"}` 或 `{"value": ""}`（不存在时返回空字符串）

常用 key：
| key | 说明 | 值 |
|-----|------|----|
| `useQcSalary` | 工资数据源开关 | `"true"` / `"false"` |

### 12.2 设置设置项

```
POST /api/app-settings
Body: { "key": "useQcSalary", "value": "true" }
```

**响应**: `{"ok": true}`

---

## 十三、单价模板（已弃用）

> 以下接口仍可用，但前端已移除模板功能

### 13.1 获取所有模板

```
GET /api/price-templates
```

### 13.2 保存模板

```
POST /api/price-templates
Body: {
  "name": "模板1",
  "items": [{"model_id": 1, "sub_dept_id": 1, "unit_price": 1.1}]
}
```

### 13.3 加载模板

```
GET /api/price-templates/{template_id}
```

### 13.4 删除模板

```
DELETE /api/price-templates/{template_id}
```

---

## 十四、初始化

### 14.1 初始化数据库

```
GET /api/init
```

**响应**: `{"ok": true}`

---

## 附录：业务逻辑说明

### 工资计算公式

**做货编辑模式 (source=work)**:
```
员工做货工资 = Σ(做货对数 × 该型号在该员工小部门的单价)
员工总工资 = 做货工资 + 人工增扣金额
```

**快捷计算模式 (source=qc)**:
```
员工做货工资 = Σ(该大部门每行的对数 × 该员工小部门在该行的单价)
员工总工资 = 做货工资 + 人工增扣金额
```

### 数据源切换

通过 `app_settings` 表的 `useQcSalary` 字段控制：
- `"false"`（默认）→ 总工资表和成员详情使用做货编辑数据
- `"true"` → 总工资表和成员详情使用快捷计算数据

两种数据源独立计算，互不影响。

### 默认数据

- 大部门：面部(id=1)、底部(id=2)
- 小部门：衣车(id=1, 面部)、折面(id=2, 面部)、折边(id=3, 面部)、底部(id=4, 底部)
