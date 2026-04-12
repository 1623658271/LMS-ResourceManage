"""数据库连接管理"""
import sqlite3
import os
import sys


def get_base_dir():
    """获取项目根目录（支持 PyInstaller 打包后的环境）"""
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后的环境：使用 exe 所在目录
        return os.path.dirname(sys.executable)
    else:
        # 开发环境：使用脚本所在目录
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


BASE_DIR = get_base_dir()
DB_PATH = os.path.join(BASE_DIR, "data.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "database", "schema.sql")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()
    cur = conn.cursor()

    # 检查表是否存在
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='work_records'")
    has_work_records = cur.fetchone() is not None

    needs_migration = False
    if has_work_records:
        # 检查 work_records 是否有 order_id 列
        cur.execute("PRAGMA table_info(work_records)")
        cols = {row[1] for row in cur.fetchall()}
        needs_migration = 'order_id' not in cols
        has_line_id = 'line_id' in cols

    # 迁移 1：v1→v2（添加 order_id）
    if needs_migration:
        # 第一步：重命名旧表
        conn.execute("ALTER TABLE work_records RENAME TO _work_records_old")
        conn.commit()

    # 第二步：执行 schema（创建所有表）
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        sql = f.read()
    conn.executescript(sql)

    # 第三步：从旧表迁移数据
    if needs_migration:
        # 获取旧数据中的订单号
        cur.execute("SELECT DISTINCT order_no FROM _work_records_old")
        order_map = {}
        for (order_no,) in cur.fetchall():
            cur.execute(
                "INSERT INTO orders (order_no, year, month) VALUES (?,?,?)",
                (order_no, 2026, 4)
            )
            order_map[order_no] = cur.lastrowid
            cur.execute("SELECT id FROM models")
            for (mid,) in cur.fetchall():
                conn.execute(
                    "INSERT OR IGNORE INTO order_models (order_id, model_id) VALUES (?,?)",
                    (order_map[order_no], mid)
                )
        conn.commit()

        cur.execute(
            "SELECT year, month, order_no, model_id, emp_id, quantity FROM _work_records_old"
        )
        for (year, month, order_no, model_id, emp_id, quantity) in cur.fetchall():
            oid = order_map.get(order_no)
            if oid:
                conn.execute("""
                    INSERT INTO work_records
                    (year, month, order_id, order_no, model_id, emp_id, quantity)
                    VALUES (?,?,?,?,?,?,?)
                """, (year, month, oid, order_no, model_id, emp_id, quantity))
        conn.commit()

        conn.execute("DROP TABLE _work_records_old")
        conn.commit()
        print("[db] v1→v2 数据迁移完成")

    # 迁移 2：添加 line_id 列（已有 work_records 但缺少 line_id）
    if has_work_records and not has_line_id:
        cur.execute("ALTER TABLE work_records ADD COLUMN line_id INTEGER NOT NULL DEFAULT 0")
        conn.commit()
        print("[db] 添加 line_id 列完成")

    conn.close()
    print(f"[db] 数据库初始化完成: {DB_PATH}")
