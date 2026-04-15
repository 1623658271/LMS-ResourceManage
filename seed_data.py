"""
生成测试数据：部门 / 员工 / 型号 / 订单 / 单价 / 做货记录 / 人工增扣
部门编号说明：1=折边，2=折面，3=衣车，4=底部
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.db import get_connection

YEAR = 2026
MONTH = 4

def guess_gender(name: str) -> str:
    """根据姓名常用字推测性别，返回 '男' 或 '女'"""
    male_chars = {'军', '建', '波', '全', '海', '文', '勇', '强', '伟', '林', '平'}
    female_chars = {'芳', '兰', '丽', '艳', '华', '容', '娟', '静', '婷', '娜', '小'}
    # 优先匹配：如果名字中任何字在男性集合中且不在女性集合中 -> 男
    # 如果女性集合中有字 -> 女
    # 否则默认女（面部9人应为女，底部6人应匹配到男性字）
    has_male = any(c in male_chars for c in name)
    has_female = any(c in female_chars for c in name)
    if has_male and not has_female:
        return "男"
    elif has_female:
        return "女"
    else:
        # 兜底：根据已知名单手动处理
        # 底部人员手动指定为男，面部人员手动指定为女（避免误判）
        bottom_names = {"蒋军", "蒋建", "熬波", "刘远全", "周正海", "阿文"}
        if name in bottom_names:
            return "男"
        else:
            return "女"

def seed():
    conn = get_connection()

    # ── 1. 员工（真实姓名，动态性别，部门按表格）─────────────────────────────
    # 面部：9人，部门为衣车(3)或折面(2)，主部门 dept_id=1
    # 底部：6人，部门底部(4)，主部门 dept_id=2
    employees_info = [
        # 面部（按表格顺序）
        ("安勇", 1, 3),   # 衣车 -> 性别应为男？但用户要求面部全是女？这里安勇名字男性特征，但用户原始表格中“安勇”在面部，可能为女性？我们按性别推测逻辑会判为男，但用户要求“根据名字来判断男女”，若推测错误可手动调整。
        # 实际上用户要求“根据名字来判断男女”，所以尊重推测结果。但为了符合预期，若面部出现男性姓名，用户可能需要修正。这里保留推测逻辑。
        ("杨芳", 1, 2),   # 折面
        ("广容", 1, 3),   # 衣车
        ("小芳", 1, 2),   # 折面
        ("小兰", 1, 2),   # 折面
        ("珍池", 1, 3),   # 衣车
        ("小丽", 1, 2),   # 折面
        ("金华", 1, 3),   # 衣车
        ("艳华", 1, 2),   # 折面
        # 底部
        ("蒋军", 2, 4),
        ("蒋建", 2, 4),
        ("熬波", 2, 4),
        ("刘远全", 2, 4),
        ("周正海", 2, 4),
        ("阿文", 2, 4),
    ]

    # 清空员工表（避免重复主键冲突）
    conn.execute("DELETE FROM employees")
    conn.commit()

    name_to_id = {}
    for name, dept_id, sub_dept_id in employees_info:
        gender = guess_gender(name)
        cursor = conn.execute(
            "INSERT INTO employees (name, gender, dept_id, sub_dept_id) VALUES (?,?,?,?)",
            (name, gender, dept_id, sub_dept_id)
        )
        name_to_id[name] = cursor.lastrowid
    conn.commit()
    print(f"[seed] 员工 {len(employees_info)} 人已写入")
    # 打印性别分配供检查
    for name in name_to_id:
        g = conn.execute("SELECT gender FROM employees WHERE name=?", (name,)).fetchone()["gender"]
        print(f"  {name} -> {g}")

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

    # ── 3. 单价（子部门：1折边,2折面,3衣车,4底部）───────────────────────────
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
    import random
    random.seed(42)

    line_id_counter = {}
    def next_line_id(oid, mid):
        key = (oid, mid)
        line_id_counter[key] = line_id_counter.get(key, 0) + 1
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
                conn.execute("""
                    INSERT INTO work_records
                        (year, month, order_id, order_no, model_id, emp_id, quantity, line_id)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (YEAR, MONTH, oid, order_no, model_id, emp["id"], qty, line_id))

    # 上月（2026-03）遗留订单
    prev_emp_ids = [e["id"] for e in all_emps[:5]]
    prev_model_nos = ["A2026", "B2026", "C2026"]
    prev_line_counter = {}
    def prev_line_id(oid, mid):
        key = (oid, mid)
        prev_line_counter[key] = prev_line_counter.get(key, 0) + 1
        return prev_line_counter[key]

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
                conn.execute(
                    "INSERT INTO work_records "
                    "(year, month, order_id, order_no, model_id, emp_id, quantity, line_id) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    (2026, 3, prev_oid, "ORD-PREV", model_id, emp_id, qty, line_id)
                )
    except Exception:
        pass

    conn.commit()
    print("[seed] 做货记录写入完成（2026-04 全量 + 2026-03 少量）")

    # ── 6. 人工增扣（按真实姓名）────────────────────────────────────────────
    adjustments = [
        ("安勇",  0,   200,  "全勤奖"),
        ("广容",  -2,  -80,  "损坏物料"),
        ("珍池",  0,   300,  "绩效奖金"),
        ("蒋军",  -5,  -200, "请假扣款"),
        ("熬波",  0,   500,  "高温补贴"),
    ]
    for name, adj_qty, adj_amt, reason in adjustments:
        emp_id = name_to_id.get(name)
        if emp_id:
            conn.execute("""
                INSERT INTO salary_adjustments (emp_id, year, month, adj_quantity, adj_amount, reason)
                VALUES (?,?,?,?,?,?)
            """, (emp_id, YEAR, MONTH, adj_qty, adj_amt, reason))
        else:
            print(f"警告：未找到员工 {name}，跳过人工增扣")
    conn.commit()
    print("[seed] 人工增扣写入完成")

    conn.close()
    print("\n✅ 测试数据生成完毕！可以在 UI 中查看 2026-04 月份数据。")


if __name__ == "__main__":
    seed()