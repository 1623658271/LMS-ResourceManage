"""pywebview 入口 - 启动 FastAPI 后台服务 + 渲染窗口"""
import webview
import threading
import time
import sys
import os
import json
import webbrowser

# 解决 Windows 上的 stdout 缓冲问题
sys.stdout.reconfigure(line_buffering=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def get_window_settings():
    """读取窗口设置配置文件"""
    try:
        # 获取配置文件路径（支持 PyInstaller 打包后的环境）
        if getattr(sys, 'frozen', False):
            config_path = os.path.join(os.path.dirname(sys.executable), 'window_settings.json')
        else:
            config_path = os.path.join(BASE_DIR, 'window_settings.json')
        
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    
    # 返回默认设置
    return {
        "width": 1400,
        "height": 900,
        "fullscreen": False,
        "maximized": False
    }


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

    # 读取窗口设置
    win_settings = get_window_settings()
    
    # 全屏模式和最大化窗口互斥
    is_fullscreen = win_settings.get('fullscreen', False)
    is_maximized = win_settings.get('maximized', False)
    
    # 如果两者都为 True，优先使用全屏模式（避免冲突）
    if is_fullscreen and is_maximized:
        is_maximized = False
    
    # 创建 pywebview 窗口
    # 计算窗口位置：水平居中，垂直顶部对齐（避免被任务栏遮挡）
    import ctypes
    try:
        # 获取主屏幕分辨率
        user32 = ctypes.windll.user32
        screen_width = user32.GetSystemMetrics(0)
        screen_height = user32.GetSystemMetrics(1)
        
        win_width = win_settings.get('width', 1400)
        win_height = win_settings.get('height', 900)
        
        # 计算居中位置
        x = max(0, (screen_width - win_width) // 2)
        y = 0  # 从屏幕顶部开始，避免被任务栏遮挡
    except Exception:
        x = 100
        y = 0
    
    window = webview.create_window(
        title="立杰工资管理系统",
        url="http://127.0.0.1:8765",
        width=win_settings.get('width', 1400),
        height=win_settings.get('height', 900),
        x=x,
        y=y,
        fullscreen=is_fullscreen,
        min_size=(1000, 680),
        resizable=True,
    )
    
    # 暴露 Python 函数给 JS 调用（用于运行时切换全屏/最大化）
    def _toggle_fullscreen():
        """切换全屏模式"""
        try:
            window.toggle_fullscreen()
            return True
        except Exception as e:
            print(f"切换全屏失败: {e}")
            return False

    def _toggle_maximize():
        """切换最大化模式"""
        try:
            if window.attributes.fullscreen:
                window.toggle_fullscreen()
            else:
                if window.ui_state['inactive'] or not window.ui_state['maximized']:
                    window.maximize()
                else:
                    window.restore()
            return True
        except Exception as e:
            print(f"切换最大化失败: {e}")
            return False

    def _open_external_url(url: str):
        """在系统默认浏览器中打开网页链接。"""
        try:
            target = str(url or "").strip()
            if not target.startswith(("http://", "https://")):
                return False
            webbrowser.open(target)
            return True
        except Exception as e:
            print(f"打开外部链接失败: {e}")
            return False

    class ApiBridge:
        def toggle_fullscreen(self):
            return _toggle_fullscreen()

        def toggle_maximize(self):
            return _toggle_maximize()

        def open_external_url(self, url: str):
            return _open_external_url(url)

    # 将函数暴露给 JS: pywebview.api.toggle_fullscreen()
    webview.api = ApiBridge()
    
    # 如果设置了最大化（且不是全屏），在窗口加载完成后最大化
    if is_maximized and not is_fullscreen:
        def on_loaded():
            try:
                window.maximize()
            except Exception as e:
                print(f"最大化窗口失败: {e}")
        window.events.loaded += on_loaded

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
