"""数据库初始化与连接管理"""
import sqlite3
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')


def get_connection():
    """获取数据库连接（每次请求新建连接，线程安全）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """初始化数据库：执行 schema.sql + 自动迁移"""
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        sql = f.read()
    conn = get_connection()
    conn.executescript(sql)
    conn.commit()
    # 自动迁移：quick_calc_saves 旧表结构 → 新结构
    _migrate_quick_calc_saves(conn)
    conn.close()
    print(f"[db_manager] 数据库初始化完成: {DB_PATH}")


def _migrate_quick_calc_saves(conn):
    """迁移 quick_calc_saves 表：旧列(qc_model_selects, pt_model_selects, pt_prices) → 新列(dept_rows)"""
    cur = conn.execute("PRAGMA table_info(quick_calc_saves)")
    columns = [row[1] for row in cur.fetchall()]
    if 'qc_model_selects' in columns and 'dept_rows' not in columns:
        print("[db_manager] 迁移 quick_calc_saves 表...")
        # 重建表
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS quick_calc_saves_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                dept_rows TEXT NOT NULL DEFAULT '{}',
                qty_data TEXT NOT NULL DEFAULT '{}',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(year, month)
            );
            INSERT OR IGNORE INTO quick_calc_saves_new (year, month, dept_rows, qty_data, updated_at)
                SELECT year, month, '{}' || qc_model_selects || pt_model_selects || pt_prices, qty_data, updated_at
                FROM quick_calc_saves;
            DROP TABLE quick_calc_saves;
            ALTER TABLE quick_calc_saves_new RENAME TO quick_calc_saves;
        """)
        conn.commit()
        print("[db_manager] quick_calc_saves 迁移完成")


if __name__ == '__main__':
    init_database()
