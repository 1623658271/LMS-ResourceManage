-- ============================================================
-- 立杰人力资源管理系统 - SQLite 数据库结构
-- ============================================================

-- 大部门表
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- 小部门表（隶属大部门）
CREATE TABLE IF NOT EXISTS sub_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(dept_id, name)
);

-- 型号-小部门单价表（每行=某型号在某一小部门的单价）
CREATE TABLE IF NOT EXISTS model_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    sub_dept_id INTEGER NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_dept_id) REFERENCES sub_departments(id) ON DELETE CASCADE,
    UNIQUE(model_id, sub_dept_id)
);

-- 单价模板表（保存一套各型号各小部门的单价配置）
CREATE TABLE IF NOT EXISTS price_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 单价模板明细（每行=模板中某型号在某小部门的单价）
CREATE TABLE IF NOT EXISTS price_template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    sub_dept_id INTEGER NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES price_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_dept_id) REFERENCES sub_departments(id) ON DELETE CASCADE,
    UNIQUE(template_id, model_id, sub_dept_id)
);

-- 员工表
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    gender TEXT NOT NULL CHECK(gender IN ('男', '女')),
    dept_id INTEGER NOT NULL,
    sub_dept_id INTEGER NOT NULL,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_dept_id) REFERENCES sub_departments(id) ON DELETE CASCADE
);

-- 型号表
CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_no TEXT NOT NULL UNIQUE
);

-- 订单表（管理订单号及其关联型号）
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    remark TEXT DEFAULT ''
);

-- 订单-型号关联表（一个订单可包含多个型号）
CREATE TABLE IF NOT EXISTS order_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    UNIQUE(order_id, model_id)
);

-- 做货记录表（每行=某员工在某订单某型号下的做货对数）
CREATE TABLE IF NOT EXISTS work_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    order_no TEXT NOT NULL,
    model_id INTEGER NOT NULL,
    emp_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(year, month, order_id, model_id, emp_id)
);

-- 人工增扣表
CREATE TABLE IF NOT EXISTS salary_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emp_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    adj_quantity REAL NOT NULL DEFAULT 0,
    adj_amount REAL NOT NULL DEFAULT 0,
    reason TEXT DEFAULT '',
    FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(emp_id, year, month)
);

-- 快捷计算保存表（自动保存主表格+单价编辑的填写状态）
CREATE TABLE IF NOT EXISTS quick_calc_saves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    qc_model_selects TEXT NOT NULL DEFAULT '{}',
    qty_data TEXT NOT NULL DEFAULT '{}',
    pt_model_selects TEXT NOT NULL DEFAULT '{}',
    pt_prices TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(year, month)
);

-- 插入默认大部门
INSERT OR IGNORE INTO departments (id, name) VALUES (1, '面部');
INSERT OR IGNORE INTO departments (id, name) VALUES (2, '底部');

-- 插入默认小部门
INSERT OR IGNORE INTO sub_departments (id, dept_id, name) VALUES (1, 1, '衣车');
INSERT OR IGNORE INTO sub_departments (id, dept_id, name) VALUES (2, 1, '折面');
INSERT OR IGNORE INTO sub_departments (id, dept_id, name) VALUES (3, 1, '折边');
INSERT OR IGNORE INTO sub_departments (id, dept_id, name) VALUES (4, 2, '底部');

