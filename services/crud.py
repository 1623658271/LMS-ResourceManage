"""所有数据库 CRUD 操作"""
from services.db import get_connection

# ── 部门管理 ────────────────────────────────────────────


def get_departments():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM departments ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_department(name: str):
    conn = get_connection()
    try:
        conn.execute("INSERT INTO departments (name) VALUES (?)", (name,))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception:
        conn.close()
        return {"ok": False, "error": "该部门已存在"}


def delete_department(dept_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM departments WHERE id = ?", (dept_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_sub_departments(dept_id: int = None):
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


def add_sub_department(dept_id: int, name: str):
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO sub_departments (dept_id, name) VALUES (?, ?)",
            (dept_id, name)
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception:
        conn.close()
        return {"ok": False, "error": "该小部门已存在"}


def delete_sub_department(sub_dept_id: int):
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


def add_employee(name: str, gender: str, dept_id: int, sub_dept_id: int):
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO employees (name, gender, dept_id, sub_dept_id) VALUES (?,?,?,?)",
            (name, gender, dept_id, sub_dept_id)
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception:
        conn.close()
        return {"ok": False, "error": "该员工已存在"}


def update_employee(emp_id: int, name: str, gender: str, dept_id: int, sub_dept_id: int):
    conn = get_connection()
    conn.execute(
        "UPDATE employees SET name=?, gender=?, dept_id=?, sub_dept_id=? WHERE id=?",
        (name, gender, dept_id, sub_dept_id, emp_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_employee(emp_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_employee_detail(emp_id: int, year: int, month: int):
    """员工单月工资明细"""
    conn = get_connection()

    # 获取员工小部门
    emp_row = conn.execute(
        "SELECT sub_dept_id FROM employees WHERE id=?", (emp_id,)
    ).fetchone()
    if not emp_row:
        conn.close()
        return {"wage": 0, "total_pairs": 0, "adj_quantity": 0, "adj_amount": 0, "reason": "", "total": 0}

    sub_dept_id = emp_row["sub_dept_id"]

    # 做货工资：quantity * 该型号该小部门的单价
    wage = conn.execute("""
        SELECT COALESCE(SUM(wr.quantity * mp.unit_price), 0) AS wage
        FROM work_records wr
        JOIN model_prices mp ON wr.model_id=mp.model_id AND mp.sub_dept_id=?
        WHERE wr.emp_id=? AND wr.year=? AND wr.month=?
    """, (sub_dept_id, emp_id, year, month)).fetchone()

    # 做货总对数
    pairs = conn.execute(
        "SELECT COALESCE(SUM(quantity), 0) FROM work_records "
        "WHERE emp_id=? AND year=? AND month=?",
        (emp_id, year, month)
    ).fetchone()

    # 增扣
    adj = conn.execute(
        "SELECT * FROM salary_adjustments WHERE emp_id=? AND year=? AND month=?",
        (emp_id, year, month)
    ).fetchone()

    conn.close()

    adj_data = dict(adj) if adj else {"adj_quantity": 0, "adj_amount": 0, "reason": ""}
    wage_val = round(wage[0] if wage else 0, 2)
    return {
        "wage": wage_val,
        "total_pairs": pairs[0] if pairs else 0,
        "adj_quantity": adj_data["adj_quantity"],
        "adj_amount": adj_data["adj_amount"],
        "reason": adj_data["reason"],
        "total": round(wage_val + adj_data["adj_amount"], 2)
    }


def get_employee_work_history(emp_id: int):
    """获取指定员工自入职以来的所有做货记录（按年月汇总）"""
    conn = get_connection()

    # 获取员工基本信息
    emp = conn.execute(
        "SELECT e.*, d.name AS dept_name, s.name AS sub_dept_name "
        "FROM employees e "
        "LEFT JOIN departments d ON e.dept_id=d.id "
        "LEFT JOIN sub_departments s ON e.sub_dept_id=s.id "
        "WHERE e.id=?", (emp_id,)
    ).fetchone()
    if not emp:
        conn.close()
        return None

    # 获取该员工所有年月有数据的月份
    months = conn.execute("""
        SELECT DISTINCT year, month FROM work_records
        WHERE emp_id=? ORDER BY year DESC, month DESC
    """, (emp_id,)).fetchall()

    history = []
    for m in months:
        year, month = m["year"], m["month"]

        # 该月所有做货记录（含订单号、型号）
        records = conn.execute("""
            SELECT wr.*, o.order_no,
                   mp.unit_price,
                   (wr.quantity * mp.unit_price) AS line_wage,
                   m.model_no
            FROM work_records wr
            LEFT JOIN orders o ON wr.order_id=o.id
            LEFT JOIN model_prices mp ON wr.model_id=mp.model_id AND mp.sub_dept_id=?
            LEFT JOIN models m ON wr.model_id=m.id
            WHERE wr.emp_id=? AND wr.year=? AND wr.month=?
            ORDER BY o.order_no, m.model_no
        """, (emp["sub_dept_id"], emp_id, year, month)).fetchall()

        # 该月增扣
        adj = conn.execute(
            "SELECT * FROM salary_adjustments WHERE emp_id=? AND year=? AND month=?",
            (emp_id, year, month)
        ).fetchone()

        month_wage = round(sum(r["line_wage"] or 0 for r in records), 2)
        adj_data = dict(adj) if adj else {"adj_quantity": 0, "adj_amount": 0, "reason": ""}

        history.append({
            "year": year,
            "month": month,
            "records": [dict(r) for r in records],
            "month_wage": month_wage,
            "total_pairs": sum(r["quantity"] for r in records),
            "adj_quantity": adj_data["adj_quantity"],
            "adj_amount": adj_data["adj_amount"],
            "adj_reason": adj_data["reason"],
            "total": round(month_wage + adj_data["adj_amount"], 2),
        })

    conn.close()
    return {
        "employee": dict(emp),
        "history": history,
    }


# ── 订单管理 ────────────────────────────────────────────


def get_orders(year: int = None, month: int = None):
    conn = get_connection()
    if year and month:
        rows = conn.execute("""
            SELECT o.*,
                   (SELECT SUM(wr.quantity) FROM work_records wr WHERE wr.order_id=o.id) AS total_pairs
            FROM orders o
            WHERE o.year=? AND o.month=?
            ORDER BY o.id
        """, (year, month)).fetchall()
    else:
        rows = conn.execute("""
            SELECT o.*,
                   (SELECT SUM(wr.quantity) FROM work_records wr WHERE wr.order_id=o.id) AS total_pairs
            FROM orders o
            ORDER BY o.year DESC, o.month DESC, o.id
        """).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        # 获取关联的型号
        models = conn.execute("""
            SELECT m.id, m.model_no FROM order_models om
            JOIN models m ON om.model_id=m.id
            WHERE om.order_id=?
        """, (d["id"],)).fetchall()
        d["models"] = [dict(m) for m in models]
        result.append(d)
    conn.close()
    return result


def add_order(order_no: str, year: int, month: int, model_ids: list[int] = None, remark: str = ""):
    conn = get_connection()
    try:
        oid = conn.execute(
            "INSERT INTO orders (order_no, year, month, remark) VALUES (?,?,?,?)",
            (order_no, year, month, remark or "")
        ).lastrowid
        if model_ids:
            for mid in model_ids:
                conn.execute("INSERT OR IGNORE INTO order_models (order_id, model_id) VALUES (?,?)", (oid, mid))
        conn.commit()
        conn.close()
        return {"ok": True, "order_id": oid}
    except Exception as e:
        conn.close()
        return {"ok": False, "error": str(e)}


def update_order(order_id: int, order_no: str = None, model_ids: list[int] = None, remark: str = None):
    conn = get_connection()
    if order_no is not None:
        conn.execute("UPDATE orders SET order_no=? WHERE id=?", (order_no, order_id))
    if remark is not None:
        conn.execute("UPDATE orders SET remark=? WHERE id=?", (remark, order_id))
    if model_ids is not None:
        conn.execute("DELETE FROM order_models WHERE order_id=?", (order_id,))
        for mid in model_ids:
            conn.execute("INSERT OR IGNORE INTO order_models (order_id, model_id) VALUES (?,?)", (order_id, mid))
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_order(order_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM orders WHERE id=?", (order_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_order_wage_detail(year: int, month: int):
    """返回工资明细：每个格子 = 对数 × 单价"""
    conn = get_connection()

    orders = conn.execute("""
        SELECT o.id, o.order_no,
               (SELECT SUM(wr.quantity) FROM work_records wr WHERE wr.order_id=o.id) AS total_pairs
        FROM orders o
        WHERE o.year=? AND o.month=?
        ORDER BY o.id
    """, (year, month)).fetchall()

    emps = conn.execute("""
        SELECT e.id, e.name, e.sub_dept_id, sd.name AS sub_dept_name
        FROM employees e
        JOIN sub_departments sd ON e.sub_dept_id=sd.id
        ORDER BY e.id
    """).fetchall()

    models = conn.execute("SELECT id, model_no FROM models ORDER BY id").fetchall()

    # 单价映射：model_id, sub_dept_id -> unit_price
    prices_raw = conn.execute("SELECT model_id, sub_dept_id, unit_price FROM model_prices").fetchall()
    price_map = {f"{p['model_id']},{p['sub_dept_id']}": p["unit_price"] for p in prices_raw}

    # 每个订单的型号列表
    order_models = {}
    for o in orders:
        rows = conn.execute("""
            SELECT m.id, m.model_no FROM order_models om
            JOIN models m ON om.model_id=m.id
            WHERE om.order_id=?
        """, (o["id"],)).fetchall()
        order_models[o["id"]] = [dict(r) for r in rows]

    # 做货记录
    records_raw = conn.execute("""
        SELECT order_id, model_id, emp_id, quantity FROM work_records
        WHERE year=? AND month=?
    """, (year, month)).fetchall()

    # 构建数据
    rec_map = {}
    for r in records_raw:
        key = f"{r['order_id']},{r['model_id']},{r['emp_id']}"
        rec_map[key] = r["quantity"]

    # 每个格子工资 = qty × unit_price
    wage_map = {}
    for key, qty in rec_map.items():
        parts = key.split(",")
        order_id, model_id, emp_id = int(parts[0]), int(parts[1]), int(parts[2])
        # 查找员工的 sub_dept_id
        emp_row = next((e for e in emps if e["id"] == emp_id), None)
        if emp_row:
            price = price_map.get(f"{model_id},{emp_row['sub_dept_id']}", 0)
            wage_map[key] = round(qty * price, 2)

    conn.close()
    return {
        "orders": [dict(o) for o in orders],
        "employees": [dict(e) for e in emps],
        "models": [dict(m) for m in models],
        "order_models": {str(k): v for k, v in order_models.items()},
        "quantities": rec_map,
        "wages": wage_map,
        "price_map": price_map,
    }


# ── 型号管理 ────────────────────────────────────────────


def get_models():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM models ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_model(model_no: str):
    conn = get_connection()
    try:
        mid = conn.execute(
            "INSERT INTO models (model_no) VALUES (?)", (model_no,)
        ).lastrowid
        conn.commit()
        # 自动为所有小部门创建默认单价行
        subs = conn.execute("SELECT id FROM sub_departments").fetchall()
        for s in subs:
            conn.execute(
                "INSERT INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,0)",
                (mid, s[0])
            )
        conn.commit()
        conn.close()
        return {"ok": True, "model_id": mid}
    except Exception:
        conn.close()
        return {"ok": False, "error": "该型号已存在"}


def update_model(model_id: int, model_no: str):
    conn = get_connection()
    try:
        conn.execute("UPDATE models SET model_no = ? WHERE id = ?", (model_no, model_id))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception:
        conn.close()
        return {"ok": False, "error": str(e)}


def delete_model(model_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM models WHERE id = ?", (model_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def get_price_table():
    """返回 {models, sub_departments, prices}"""
    conn = get_connection()
    models = conn.execute("SELECT * FROM models ORDER BY id").fetchall()
    subs = conn.execute(
        "SELECT sd.*, d.name AS dept_name FROM sub_departments sd "
        "JOIN departments d ON sd.dept_id=d.id ORDER BY sd.dept_id, sd.id"
    ).fetchall()
    prices = conn.execute("SELECT * FROM model_prices").fetchall()
    conn.close()

    price_map = {}
    for p in prices:
        # 用字符串 key（FastAPI JSON 序列化需要 hashable type）
        price_map[f"{p['model_id']},{p['sub_dept_id']}"] = p["unit_price"]

    return {
        "models": [dict(m) for m in models],
        "sub_departments": [dict(s) for s in subs],
        "prices": price_map
    }


def update_price(model_id: int, sub_dept_id: int, unit_price: float):
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,?)",
        (model_id, sub_dept_id, float(unit_price))
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 做货编辑 ────────────────────────────────────────────


def get_work_records(year: int, month: int):
    conn = get_connection()
    rows = conn.execute("""
        SELECT wr.*, m.model_no, e.name AS emp_name, e.sub_dept_id
        FROM work_records wr
        JOIN models m ON wr.model_id=m.id
        JOIN employees e ON wr.emp_id=e.id
        WHERE wr.year=? AND wr.month=?
        ORDER BY wr.order_id, wr.model_id
    """, (year, month)).fetchall()

    emps = conn.execute("""
        SELECT e.id, e.name, e.sub_dept_id, sd.name AS sub_dept_name
        FROM employees e
        JOIN sub_departments sd ON e.sub_dept_id=sd.id
        ORDER BY e.id
    """).fetchall()

    # 获取当月订单列表
    orders = conn.execute("""
        SELECT o.id, o.order_no,
               (SELECT SUM(wr.quantity) FROM work_records wr WHERE wr.order_id=o.id) AS total_pairs
        FROM orders o
        WHERE o.year=? AND o.month=?
        ORDER BY o.id
    """, (year, month)).fetchall()

    # 每个订单关联的型号
    order_models = {}
    for o in orders:
        rows2 = conn.execute("""
            SELECT m.id, m.model_no FROM order_models om
            JOIN models m ON om.model_id=m.id
            WHERE om.order_id=?
        """, (o["id"],)).fetchall()
        order_models[str(o["id"])] = [dict(r) for r in rows2]

    models = conn.execute("SELECT id, model_no FROM models ORDER BY id").fetchall()
    conn.close()

    return {
        "records": [dict(r) for r in rows],
        "employees": [dict(e) for e in emps],
        "models": [dict(m) for m in models],
        "orders": [dict(o) for o in orders],
        "order_models": order_models,
    }


def save_work_record(year: int, month: int, order_id: int, model_id: int, emp_id: int, quantity: int):
    conn = get_connection()
    qty = int(quantity) if quantity else 0
    # 获取 order_no
    order_row = conn.execute("SELECT order_no FROM orders WHERE id=?", (order_id,)).fetchone()
    order_no = order_row["order_no"] if order_row else ""
    # 只有 qty < 0 时才删除（用于清除负数等无效数据），qty=0 时应该保存（用于标记行存在）
    if qty < 0:
        conn.execute(
            "DELETE FROM work_records WHERE year=? AND month=? AND order_id=? AND model_id=? AND emp_id=?",
            (year, month, order_id, model_id, emp_id)
        )
    else:
        conn.execute("""
            INSERT INTO work_records (year, month, order_id, order_no, model_id, emp_id, quantity)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(year, month, order_id, model_id, emp_id)
            DO UPDATE SET quantity=excluded.quantity, order_no=excluded.order_no
        """, (year, month, order_id, order_no, model_id, emp_id, qty))
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_work_record(year: int, month: int, order_id: int, model_id: int, emp_id: int):
    conn = get_connection()
    conn.execute(
        "DELETE FROM work_records WHERE year=? AND month=? AND order_id=? AND model_id=? AND emp_id=?",
        (year, month, order_id, model_id, emp_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def delete_work_row(year: int, month: int, order_id: int, model_id: int):
    """批量删除一整行（同一订单+型号的所有员工记录）"""
    conn = get_connection()
    conn.execute(
        "DELETE FROM work_records WHERE year=? AND month=? AND order_id=? AND model_id=?",
        (year, month, order_id, model_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 人工增扣 ────────────────────────────────────────────


def save_adjustment(emp_id: int, year: int, month: int, adj_quantity: float, adj_amount: float, reason: str):
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


# ── 单价模板管理 ──────────────────────────────────────

def get_price_templates():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM price_templates ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_price_template(name: str, items: list[dict]):
    """创建或覆盖模板：name + [(model_id, sub_dept_id, unit_price), ...]"""
    conn = get_connection()
    try:
        # 删除旧模板（如果存在同名）
        old = conn.execute(
            "SELECT id FROM price_templates WHERE name=?", (name,)
        ).fetchone()
        if old:
            conn.execute("DELETE FROM price_templates WHERE id=?", (old["id"],))
        # 插入新模板
        tid = conn.execute(
            "INSERT INTO price_templates (name) VALUES (?)", (name,)
        ).lastrowid
        for item in items:
            conn.execute(
                "INSERT INTO price_template_items (template_id, model_id, sub_dept_id, unit_price) "
                "VALUES (?,?,?,?)",
                (tid, item["model_id"], item["sub_dept_id"], float(item["unit_price"]))
            )
        conn.commit()
        conn.close()
        return {"ok": True, "template_id": tid}
    except Exception as e:
        conn.close()
        return {"ok": False, "error": str(e)}


def load_price_template(template_id: int):
    """加载模板，返回 {models, sub_departments, prices}"""
    conn = get_connection()
    tpl = conn.execute(
        "SELECT * FROM price_templates WHERE id=?", (template_id,)
    ).fetchone()
    if not tpl:
        conn.close()
        return None
    rows = conn.execute(
        "SELECT * FROM price_template_items WHERE template_id=?", (template_id,)
    ).fetchall()
    conn.close()
    price_map = {}
    for r in rows:
        price_map[f"{r['model_id']},{r['sub_dept_id']}"] = r["unit_price"]
    return {
        "name": tpl["name"],
        "prices": price_map,
    }


def delete_price_template(template_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM price_templates WHERE id=?", (template_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── 快捷计算自动保存 ──────────────────────────────────────

def save_quick_calc(year: int, month: int, qc_model_selects: dict, qty_data: dict,
                     pt_model_selects: dict, pt_prices: dict):
    """保存快捷计算主表格+单价编辑的填写状态（按年月覆盖）"""
    import json
    conn = get_connection()
    conn.execute("""
        INSERT INTO quick_calc_saves (year, month, qc_model_selects, qty_data,
                                      pt_model_selects, pt_prices)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, month) DO UPDATE SET
            qc_model_selects = excluded.qc_model_selects,
            qty_data = excluded.qty_data,
            pt_model_selects = excluded.pt_model_selects,
            pt_prices = excluded.pt_prices,
            updated_at = CURRENT_TIMESTAMP
    """, (year, month,
          json.dumps(qc_model_selects, ensure_ascii=False),
          json.dumps(qty_data, ensure_ascii=False),
          json.dumps(pt_model_selects, ensure_ascii=False),
          json.dumps(pt_prices, ensure_ascii=False)))
    conn.commit()
    conn.close()
    return {"ok": True}


def load_quick_calc(year: int, month: int):
    """加载快捷计算上次保存的状态"""
    import json
    conn = get_connection()
    cur = conn.execute(
        "SELECT qc_model_selects, qty_data, pt_model_selects, pt_prices "
        "FROM quick_calc_saves WHERE year=? AND month=?",
        (year, month)
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "qc_model_selects": json.loads(row[0]),
        "qty_data": json.loads(row[1]),
        "pt_model_selects": json.loads(row[2]),
        "pt_prices": json.loads(row[3]),
    }


# ── 总工资表 ────────────────────────────────────────────


def get_salary_summary(year: int, month: int):
    conn = get_connection()
    employees = conn.execute("""
        SELECT e.id, e.name, e.dept_id, e.sub_dept_id,
               d.name AS dept_name, sd.name AS sub_dept_name
        FROM employees e
        JOIN departments d ON e.dept_id=d.id
        JOIN sub_departments sd ON e.sub_dept_id=sd.id
        ORDER BY d.id, sd.id, e.id
    """).fetchall()

    # 获取每个员工的做货工资与小部门单价映射
    wages_raw = conn.execute("""
        SELECT wr.emp_id,
               (SELECT sub_dept_id FROM employees WHERE id=wr.emp_id) AS sub_dept_id,
               SUM(wr.quantity) AS pairs
        FROM work_records wr
        WHERE wr.year=? AND wr.month=?
        GROUP BY wr.emp_id
    """, (year, month)).fetchall()

    # 每个员工的做货工资
    emp_wages = {}
    for w in wages_raw:
        wage = conn.execute("""
            SELECT COALESCE(SUM(wr.quantity * mp.unit_price), 0) AS wage
            FROM work_records wr
            JOIN model_prices mp ON wr.model_id=mp.model_id AND mp.sub_dept_id=?
            WHERE wr.emp_id=? AND wr.year=? AND wr.month=?
        """, (w["sub_dept_id"], w["emp_id"], year, month)).fetchone()
        emp_wages[w["emp_id"]] = {
            "wage": round(wage["wage"], 2) if wage else 0,
            "pairs": w["pairs"]
        }

    # 增扣
    adj_raw = conn.execute("""
        SELECT emp_id, adj_amount FROM salary_adjustments
        WHERE year=? AND month=?
    """, (year, month)).fetchall()
    adj_map = {r["emp_id"]: r["adj_amount"] for r in adj_raw}

    conn.close()

    # 按大部门分组
    departments = {}
    for emp in employees:
        did = emp["dept_id"]
        if did not in departments:
            departments[did] = {
                "dept_id": did,
                "dept_name": emp["dept_name"],
                "employees": [],
                "total_pairs": 0,
                "total_wage": 0
            }
        wage = emp_wages.get(emp["id"], {"wage": 0, "pairs": 0})
        adj = adj_map.get(emp["id"], 0)
        total = round(wage["wage"] + adj, 2)
        departments[did]["employees"].append({
            "emp_id": emp["id"],
            "name": emp["name"],
            "sub_dept_name": emp["sub_dept_name"],
            "pairs": wage["pairs"],
            "wage": wage["wage"],
            "adj_amount": adj,
            "total": total
        })
        departments[did]["total_pairs"] += wage["pairs"]
        departments[did]["total_wage"] += total

    for d in departments.values():
        d["total_wage"] = round(d["total_wage"], 2)

    return list(departments.values())
