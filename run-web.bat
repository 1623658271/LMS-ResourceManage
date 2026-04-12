@echo off
cd /d "%~dp0"

:: 使用 venv（如果存在）
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

:: 安装依赖
pip install -q -r requirements.txt

:: 启动 FastAPI 服务（完全隐藏窗口）
pythonw web_server.py
