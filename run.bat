@echo off
cd /d "%~dp0"
where python >nul 2>nul || (echo 请先安装 Python 3.8+ & pause & exit /b 1)

:: 使用 venv（如果存在）
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo [提示] 未检测到 venv，直接使用系统 Python
)

:: 安装依赖
pip install -q -r requirements.txt

:: 启动主程序
python main.py
pause
