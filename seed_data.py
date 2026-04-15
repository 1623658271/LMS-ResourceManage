"""
生成测试数据：部门 / 员工 / 型号 / 订单 / 单价 / 做货记录 / 人工增扣
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.db import get_connection

YEAR = 2026
MONTH = 4


def seed():
    conn = get_connection()

    # ── 1. 员工（全部改为“测试姓名X”）────────────────────────────────────────────────
    # 原数据分布：前9女（部门1，子部门3/2交替），后6男（部门2，子部门4）
    employees_info = [
        (1, "女", 1, 3),   # 测试姓名1
        (2, "女", 1, 2),   # 测试姓名2
        (3, "女", 1, 3),   # 测试姓名3
        (4, "女", 1, 2),   # 测试姓名4
        (5, "女", 1, 2),   # 测试姓名5
        (6, "女", 1, 3),   # 测试姓名6
        (7, "女", 1, 2),   # 测试姓名7
        (8, "女", 1, 3),   # 测试姓名8
        (9, "女", 1, 2),   # 测试姓名9
        (10, "男", 2, 4),  # 测试姓名10
        (11, "男", 2, 4),  # 测试姓名11
        (12, "男", 2, 4),  # 测试姓名12
        (13, "男", 2, 4),  # 测试姓名13
        (14, "男", 2, 4),  # 测试姓名14
        (15, "男", 2, 4),  # 测试姓名15
    ]
    employees = []
    for idx, gender, dept_id, sub_dept_id in employees_info:
        name = f"测试姓名{idx}"
        employees.append((name, gender, dept_id, sub_dept_id))
        try:
            conn.execute(
                "INSERT INTO employees (name, gender, dept_id, sub_dept_id) VALUES (?,?,?,?)",
                (name, gender, dept_id, sub_dept_id)
            )
        except Exception:
            pass
    conn.commit()
    print(f"[seed] 员工 {len(employees)} 人已写入")

    # ── 2. 型号 ─────────────────────────────────────────────────────────────
    models = ["A2026", "B2026", "C2026", "D2026", "E2026", "F2026"]
    model_ids = {}
    for m in models:
        try:
            mid = conn.execute("INSERT INTO models (model_no) VALUES (?)", (m,)).lastrowid
            model_ids[m] = mid
            subs = conn.execute("SELECT id FROM sub_departments").fetchall()
            for s in subs:
                conn.execute(
                    "INSERT INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,?)",
                    (mid, s["id"], 0.5)
                )
        except Exception:
            pass
    conn.commit()
    print(f"[seed] 型号 {len(models)} 个已写入")

    # ── 3. 单价 ─────────────────────────────────────────────────────────────
    prices = {
        "A2026": {1: 1.20, 2: 1.50, 3: 1.30, 4: 0.80},
        "B2026": {1: 1.10, 2: 1.40, 3: 1.20, 4: 0.75},
        "C2026": {1: 1.30, 2: 1.60, 3: 1.40, 4: 0.90},
        "D2026": {1: 0.90, 2: 1.10, 3: 1.00, 4: 0.65},
        "E2026": {1: 1.50, 2: 1.80, 3: 1.60, 4: 1.00},
        "F2026": {1: 1.00, 2: 1.20, 3: 1.10, 4: 0.70},
    }
    for model_no, sub_prices in prices.items():
        if model_no not in model_ids:
            continue
        model_id = model_ids[model_no]
        for sub_dept_id, price in sub_prices.items():
            conn.execute(
                "INSERT OR REPLACE INTO model_prices (model_id, sub_dept_id, unit_price) VALUES (?,?,?)",
                (model_id, sub_dept_id, price)
            )
    conn.commit()
    print("[seed] 单价设置完成")

    # ── 4. 订单 ─────────────────────────────────────────────────────────────
    # "未知"订单用 id=999999（不会与真实订单冲突）
    try:
        conn.execute(
            "INSERT OR IGNORE INTO orders (id, order_no, year, month, remark) VALUES (?,?,?,?,?)",
            (999999, "未知", 0, 0, "新增行默认订单")
        )
    except Exception:
        pass

    orders = [
        ("ORD-001", YEAR, MONTH, "第一批大货", ["A2026", "B2026", "C2026"]),
        ("ORD-002", YEAR, MONTH, "第二批追单", ["C2026", "D2026", "E2026"]),
        ("ORD-003", YEAR, MONTH, "小单",       ["F2026"]),
    ]
    order_ids = {"未知": 999999}
    for order_no, year, month, remark, model_nos in orders:
        try:
            oid = conn.execute(
                "INSERT INTO orders (order_no, year, month, remark) VALUES (?,?,?,?)",
                (order_no, year, month, remark)
            ).lastrowid
            order_ids[order_no] = oid
            for mn in model_nos:
                if mn in model_ids:
                    conn.execute(
                        "INSERT INTO order_models (order_id, model_id) VALUES (?,?)",
                        (oid, model_ids[mn])
                    )
        except Exception:
            pass
    conn.commit()
    print(f"[seed] 订单 {len(orders)} 个已写入")

    # ── 5. 做货记录 ─────────────────────────────────────────────────────────
    all_emps = conn.execute("SELECT id FROM employees ORDER BY id").fetchall()
    all_model_list = list(model_ids.values())

    import random
    random.seed(42)

    line_id_counter = {}

    def next_line_id(oid, mid):
        key = (oid, mid)
        if key not in line_id_counter:
            line_id_counter[key] = 0
        line_id_counter[key] += 1
        return line_id_counter[key]

    for order_no, (_, _, _, _, model_nos) in zip(order_ids.keys(), orders):
        oid = order_ids[order_no]
        for model_no in model_nos:
            model_id = model_ids[model_no]
            line_id = next_line_id(oid, model_id)
            for emp in all_emps:
                qty = random.randint(0, 50)
                if qty == 0:
                    continue
                try:
                    conn.execute("""
                        INSERT INTO work_records
                            (year, month, order_id, order_no, model_id, emp_id, quantity, line_id)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, (YEAR, MONTH, oid, order_no, model_id, emp["id"], qty, line_id))
                except Exception:
                    pass

    # 上月（2026-03）
    prev_emp_ids = [e["id"] for e in all_emps[:5]]
    prev_model_nos = ["A2026", "B2026", "C2026"]
    prev_line_id_counter = {}
    def prev_line_id(oid, mid):
        key = (oid, mid)
        if key not in prev_line_id_counter:
            prev_line_id_counter[key] = 0
        prev_line_id_counter[key] += 1
        return prev_line_id_counter[key]
    try:
        prev_oid = conn.execute(
            "INSERT INTO orders (order_no, year, month, remark) VALUES (?,?,?,?)",
            ("ORD-PREV", 2026, 3, "上月遗留订单")
        ).lastrowid
        for mn in prev_model_nos:
            if mn in model_ids:
                conn.execute("INSERT INTO order_models (order_id, model_id) VALUES (?,?)", (prev_oid, model_ids[mn]))
        for model_no in prev_model_nos:
            model_id = model_ids[model_no]
            line_id = prev_line_id(prev_oid, model_id)
            for emp_id in prev_emp_ids:
                qty = random.randint(5, 30)
                try:
                    conn.execute(
                        "INSERT INTO work_records "
                        "(year, month, order_id, order_no, model_id, emp_id, quantity, line_id) "
                        "VALUES (?,?,?,?,?,?,?,?)",
                        (2026, 3, prev_oid, "ORD-PREV", model_id, emp_id, qty, line_id)
                    )
                except Exception:
                    pass
    except Exception:
        pass

    conn.commit()
    print("[seed] 做货记录写入完成（2026-04 全量 + 2026-03 少量）")

    # ── 6. 人工增扣（emp_id 沿用原编号，对应测试姓名1,3,6,10,12）─────────────
    adj_examples = [
        (1,  0,   200,  "全勤奖"),
        (3,  -2,  -80,  "损坏物料"),
        (6,  0,   300,  "绩效奖金"),
        (10, -5,  -200, "请假扣款"),
        (12, 0,   500,  "高温补贴"),
    ]
    for emp_id, adj_qty, adj_amt, reason in adj_examples:
        try:
            conn.execute("""
                INSERT INTO salary_adjustments (emp_id, year, month, adj_quantity, adj_amount, reason)
                VALUES (?,?,?,?,?,?)
            """, (emp_id, YEAR, MONTH, adj_qty, adj_amt, reason))
        except Exception:
            pass
    conn.commit()
    print("[seed] 人工增扣写入完成")

    conn.close()
    print("\n✅ 测试数据生成完毕！可以在 UI 中查看 2026-04 月份数据。")


if __name__ == "__main__":
    seed()