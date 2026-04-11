"""pywebview 入口 - 启动 FastAPI 后台服务 + 渲染窗口"""
import webview
import threading
import time
import sys
import os

# 解决 Windows 上的 stdout 缓冲问题
sys.stdout.reconfigure(line_buffering=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def start_fastapi():
    """在独立线程中启动 FastAPI（uvicorn）"""
    import uvicorn
    # 使用 --reload 会开启文件监控，不适合打包场景
    # 直接用 uvicorn API 启动，避免子进程问题
    from api_server import app
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="error",
        access_log=False,
    )


if __name__ == "__main__":
    # 初始化数据库
    from services.db import init_database
    init_database()

    # 后台启动 FastAPI
    server_thread = threading.Thread(target=start_fastapi, daemon=True)
    server_thread.start()
    time.sleep(1.5)  # 等待服务启动

    # 创建 pywebview 窗口
    window = webview.create_window(
        title="立杰人力资源管理系统",
        url="http://127.0.0.1:8765",
        width=1280,
        height=800,
        min_size=(1000, 680),
        resizable=True,
    )

    # 窗口关闭前保存设置（使用线程非阻塞方式）
    def on_closing():
        try:
            def save_in_thread():
                try:
                    window.evaluate_js("""
                        if (typeof saveSettings === 'function') {
                            try { saveSettings(true); } catch(e) { console.error(e); }
                        }
                    """)
                except Exception:
                    pass
            threading.Thread(target=save_in_thread, daemon=True).start()
        except Exception:
            pass

    window.events.closing += on_closing

    webview.start(debug=False)
