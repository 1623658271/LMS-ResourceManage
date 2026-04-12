@echo off
cd /d "%~dp0"

:: 使用 venv（如果存在）
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

:: 安装依赖
pip install -q -r requirements.txt

:: 启动 FastAPI 服务（使用 pythonw 无窗口）
pythonw -c "
import threading
import time
import sys
sys.stdout = open('nul', 'w')
sys.stderr = open('nul', 'w')

from services.db import init_database
init_database()

def start_server():
    import uvicorn
    from api_server import app
    uvicorn.run(app, host='127.0.0.1', port=8765, log_level='error', access_log=False)

threading.Thread(target=start_server, daemon=True).start()

# 保持运行
while True:
    time.sleep(1)
"
