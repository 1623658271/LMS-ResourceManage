"""
pywebview JavaScript 桥接层
所有前端 JS 调用 Python 函数的入口
"""
import sqlite3
import os
import sys
from database.db_manager import get_connection, init_database

# ── 部门管理 ────────────────────────────────────────────

def get_departments():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM departments ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_department(name):
    conn = get_connection()
    try:
        conn.execute("INSERT INTO departments (name) VALUES (?)", (name,))
        conn.commit()
        conn.close()
        return {"ok": True}
    except sqlite3.IntegrityError:
        conn.close()
        return {"ok": False, "error": "该部门已存在"}


def delete_department(dept_id):
    conn = get_connection()
    conn.execute("DELETE FROM departments WHERE id = ?", (dept_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_sub_departments(dept_id=None):
    conn = get_connection()
    if dept_id is None:
        rows = conn.execute(
            "SELECT sd.*, d.name AS dept_name FROM sub_departments sd "
            "JOIN departments d ON sd.dept_id=d.id ORDER BY sd.dept_id"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM sub_departments WHERE dept_id = ?", (dept_id,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_sub_department(dept_id, name):
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO sub_departments (dept_id, name) VALUES (?, ?)",
            (dept_id, name)
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except sqlite3.IntegrityError:
        conn.close()
        return {"ok": False, "error": "该小部门已存在"}


def delete_sub_department(sub_dept_id):
    conn = get_connection()
    conn.execute("DELETE FROM sub_departments WHERE id = ?", (sub_dept_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 员工管理 ────────────────────────────────────────────

def get_employees():
    conn = get_connection()
    rows = conn.execute(
        "SELECT e.*, d.name AS dept_name, sd.name AS sub_dept_name "
        "FROM employees e "
        "JOIN departments d ON e.dept_id=d.id "
        "JOIN sub_departments sd ON e.sub_dept_id=sd.id "
        "ORDER BY e.id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_employee(name, gender, dept_id, sub_dept_id):
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO employees (name, gender, dept_id, sub_dept_id) VALUES (?,?,?,?)",
            (name, gender, dept_id, sub_dept_id)
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except sqlite3.IntegrityError:
        conn.close()
        return {"ok": False, "error": "该员工已存在"}


def update_employee(emp_id, name, gender, dept_id, sub_dept_id):
    conn = get_connection()
    conn.execute(
        "UPDATE employees SET name=?, gender=?, dept_id=?, sub_dept_id=? WHERE id=?",
        (name, gender, dept_id, sub_dept_id, emp_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_employee(emp_id):
    conn = get_connection()
    conn.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_employee_detail(emp_id, year, month):
    """员工单月工资明细"""
    conn = get_connection()
    # 做货工资汇总
    wage = conn.execute("""
        SELECT COALESCE(SUM(wr.quantity * mp.unit_price), 0) AS wage
        FROM work_records wr
        JOIN model_prices mp ON wr.model_id=mp.model_id
            AND mp.sub_dept_id = (
                SELECT sub_dept_id FROM employees WHERE id=wr.emp_id
            )
        WHERE wr.emp_id=? AND wr.year=? AND wr.month=?
    """, (emp_id, year, month)).fetchone()

    # 增扣
    adj = conn.execute(
        "SELECT * FROM salary_adjustments WHERE emp_id=? AND year=? AND month=?",
        (emp_id, year, month)
    ).fetchone()

    # 做货总对数
    pairs = conn.execute(
        "SELECT COALESCE(SUM(quantity), 0) FROM work_records "
        "WHERE emp_id=? AND year=? AND month=?",
        (emp_id, year, month)
    ).fetchone()

    conn.close()
    adj_data = dict(adj) if adj else {"adj_quantity": 0, "adj_amount": 0, "reason": ""}
    return {
        "wage": round(wage[0] if wage else 0, 2),
        "total_pairs": pairs[0] if pairs else 0,
        "adj_quantity": adj_data["adj_quantity"],
        "adj_amount": adj_data["adj_amount"],
        "reason": adj_data["reason"],
        "total": round((wage[0] if wage else 0) + adj_data["adj_amount"], 2)
    }


# ── 型号单价管理 ─────────────────────────────────────────

def get_models():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM models ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_model(model_no):
    conn = get_connection()
    try:
        mid = conn.execute(
            "INSERT INTO models (model_no) VALUES (?)", (model_no,)
        ).lastrowid
        conn.commit()
        # 同时创建各小部门的默认单价行
        subs = conn.execute("SELECT id FROM sub_departments").fetchall()
        for s in subs:
            conn.execute(
                "INSERT INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,0)",
                (mid, s[0])
            )
        conn.commit()
        conn.close()
        return {"ok": True, "model_id": mid}
    except sqlite3.IntegrityError:
        conn.close()
        return {"ok": False, "error": "该型号已存在"}


def delete_model(model_id):
    conn = get_connection()
    conn.execute("DELETE FROM models WHERE id = ?", (model_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_price_table():
    """返回 {model_id, model_no, prices: {sub_dept_id: unit_price}}"""
    conn = get_connection()
    models = conn.execute("SELECT * FROM models ORDER BY id").fetchall()
    subs = conn.execute(
        "SELECT sd.*, d.name AS dept_name FROM sub_departments sd "
        "JOIN departments d ON sd.dept_id=d.id ORDER BY sd.dept_id, sd.id"
    ).fetchall()
    prices = conn.execute("SELECT * FROM model_prices").fetchall()

    # 转成 dict
    price_map = {}
    for p in prices:
        price_map[(p['model_id'], p['sub_dept_id'])] = p['unit_price']

    conn.close()
    result = {
        "models": [dict(m) for m in models],
        "sub_departments": [dict(s) for s in subs],
        "prices": price_map
    }
    return result


def update_price(model_id, sub_dept_id, unit_price):
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,?)",
        (model_id, sub_dept_id, float(unit_price))
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 做货编辑 ────────────────────────────────────────────

def get_work_records(year, month):
    """返回当月所有做货记录"""
    conn = get_connection()
    rows = conn.execute("""
        SELECT wr.*, m.model_no, e.name AS emp_name, e.sub_dept_id
        FROM work_records wr
        JOIN models m ON wr.model_id=m.id
        JOIN employees e ON wr.emp_id=e.id
        WHERE wr.year=? AND wr.month=?
        ORDER BY wr.order_no, wr.model_id
    """, (year, month)).fetchall()

    # 获取所有员工列表（按 id 排序）
    emps = conn.execute("""
        SELECT e.id, e.name, e.sub_dept_id, sd.name AS sub_dept_name
        FROM employees e
        JOIN sub_departments sd ON e.sub_dept_id=sd.id
        ORDER BY e.id
    """).fetchall()

    # 获取所有型号
    models = conn.execute("SELECT id, model_no FROM models ORDER BY id").fetchall()
    conn.close()

    return {
        "records": [dict(r) for r in rows],
        "employees": [dict(e) for e in emps],
        "models": [dict(m) for m in models]
    }


def save_work_record(year, month, order_no, model_id, emp_id, quantity):
    """upsert 做货记录"""
    conn = get_connection()
    qty = int(quantity) if quantity else 0
    if qty <= 0:
        # 删除记录
        conn.execute(
            "DELETE FROM work_records WHERE year=? AND month=? AND order_no=? AND model_id=? AND emp_id=?",
            (year, month, order_no, model_id, emp_id)
        )
    else:
        conn.execute("""
            INSERT INTO work_records (year, month, order_no, model_id, emp_id, quantity)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT(year, month, order_no, model_id, emp_id)
            DO UPDATE SET quantity=excluded.quantity
        """, (year, month, order_no, model_id, emp_id, qty))
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_work_record(year, month, order_no, model_id, emp_id):
    conn = get_connection()
    conn.execute(
        "DELETE FROM work_records WHERE year=? AND month=? AND order_no=? AND model_id=? AND emp_id=?",
        (year, month, order_no, model_id, emp_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 人工增扣 ────────────────────────────────────────────

def save_adjustment(emp_id, year, month, adj_quantity, adj_amount, reason):
    conn = get_connection()
    conn.execute("""
        INSERT INTO salary_adjustments (emp_id, year, month, adj_quantity, adj_amount, reason)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(emp_id, year, month)
        DO UPDATE SET adj_quantity=excluded.adj_quantity,
                      adj_amount=excluded.adj_amount,
                      reason=excluded.reason
    """, (emp_id, year, month, float(adj_quantity), float(adj_amount), reason or ""))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 总工资表 ────────────────────────────────────────────

def get_salary_summary(year, month):
    """按大部门分组，返回员工工资汇总"""
    conn = get_connection()
    employees = conn.execute("""
        SELECT e.id, e.name, e.dept_id, e.sub_dept_id,
               d.name AS dept_name, sd.name AS sub_dept_name
        FROM employees e
        JOIN departments d ON e.dept_id=d.id
        JOIN sub_departments sd ON e.sub_dept_id=sd.id
        ORDER BY d.id, sd.id, e.id
    """).fetchall()

    # 做货工资（每员工每月每型号汇总 × 单价）
    wages_raw = conn.execute("""
        SELECT wr.emp_id, SUM(wr.quantity * mp.unit_price) AS wage,
               SUM(wr.quantity) AS pairs
        FROM work_records wr
        JOIN model_prices mp ON wr.model_id=mp.model_id
            AND mp.sub_dept_id = (SELECT sub_dept_id FROM employees WHERE id=wr.emp_id)
        WHERE wr.year=? AND wr.month=?
        GROUP BY wr.emp_id
    """, (year, month)).fetchall()

    wage_map = {r['emp_id']: {"wage": round(r['wage'], 2), "pairs": r['pairs']} for r in wages_raw}

    # 增扣
    adj_raw = conn.execute("""
        SELECT emp_id, adj_amount FROM salary_adjustments
        WHERE year=? AND month=?
    """, (year, month)).fetchall()
    adj_map = {r['emp_id']: r['adj_amount'] for r in adj_raw}

    conn.close()

    # 按大部门分组
    departments = {}
    for emp in employees:
        did = emp['dept_id']
        if did not in departments:
            departments[did] = {
                "dept_id": did,
                "dept_name": emp['dept_name'],
                "employees": [],
                "total_pairs": 0,
                "total_wage": 0
            }
        wage = wage_map.get(emp['id'], {"wage": 0, "pairs": 0})
        adj = adj_map.get(emp['id'], 0)
        total = round(wage['wage'] + adj, 2)
        departments[did]["employees"].append({
            "emp_id": emp['id'],
            "name": emp['name'],
            "sub_dept_name": emp['sub_dept_name'],
            "pairs": wage['pairs'],
            "wage": wage['wage'],
            "adj_amount": adj,
            "total": total
        })
        departments[did]["total_pairs"] += wage['pairs']
        departments[did]["total_wage"] += total

    # 四舍五入汇总
    for d in departments.values():
        d["total_wage"] = round(d["total_wage"], 2)

    return list(departments.values())


# ── 初始化 ────────────────────────────────────────────

def init():
    init_database()
    return {"ok": True}


# ── 数据库导入导出 ─────────────────────────────────────────

def export_database():
    """导出数据库文件为 base64 字符串"""
    import base64
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.db')
    if not os.path.exists(db_path):
        return {"ok": False, "error": "数据库文件不存在"}
    
    with open(db_path, 'rb') as f:
        data = f.read()
    
    return {
        "ok": True,
        "data": base64.b64encode(data).decode('utf-8'),
        "filename": "li_jie_hr_backup.db"
    }


def import_database(base64_data):
    """从 base64 字符串导入数据库"""
    import base64
    import shutil
    
    try:
        # 解码数据
        data = base64.b64decode(base64_data)
        
        # 验证是否为有效的 SQLite 数据库
        if not data.startswith(b'SQLite format 3'):
            return {"ok": False, "error": "无效的数据库文件格式"}
        
        # 备份当前数据库
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.db')
        backup_path = db_path + '.backup'
        
        if os.path.exists(db_path):
            shutil.copy2(db_path, backup_path)
        
        # 写入新数据库
        with open(db_path, 'wb') as f:
            f.write(data)
        
        # 验证新数据库可以正常打开
        try:
            conn = sqlite3.connect(db_path)
            conn.execute("SELECT 1 FROM departments LIMIT 1")
            conn.close()
        except sqlite3.Error as e:
            # 恢复备份
            if os.path.exists(backup_path):
                shutil.copy2(backup_path, db_path)
            return {"ok": False, "error": f"数据库验证失败: {str(e)}"}
        
        # 删除备份
        if os.path.exists(backup_path):
            os.remove(backup_path)
        
        return {"ok": True}
    
    except Exception as e:
        return {"ok": False, "error": f"导入失败: {str(e)}"}
