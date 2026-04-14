@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

:: 检查 Python 是否安装
where python >nul 2>nul
if errorlevel 1 (
    echo ==========================================
    echo   立杰人力资源管理系统 - 首次运行
    echo ==========================================
    echo.
    echo 未检测到 Python，请先安装 Python 3.8 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    echo.
    echo 安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

:: 获取 Python 版本
for /f "tokens=2" %%a in ('python --version 2^>^&1') do set PY_VER=%%a
echo [提示] 检测到 Python !PY_VER!

:: 检查 venv 是否存在且有效
set VENV_VALID=0
if exist "venv\Scripts\python.exe" (
    :: 尝试运行 venv 中的 python，检查是否可用
    venv\Scripts\python.exe -c "import sys; sys.exit(0)" >nul 2>nul
    if !errorlevel! == 0 (
        set VENV_VALID=1
    ) else (
        echo [提示] 检测到 venv 已损坏（可能因移动目录导致），正在重新创建...
        rmdir /s /q venv
    )
)

:: 如果 venv 不存在或无效，创建新的
if !VENV_VALID! == 0 (
    echo [提示] 正在创建虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
    echo [提示] 虚拟环境创建完成
)

:: 激活 venv
call venv\Scripts\activate.bat

:: 升级 pip
echo [提示] 升级 pip...
python -m pip install --upgrade pip -q

:: 安装依赖
echo [提示] 安装依赖...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo [错误] 安装依赖失败
    pause
    exit /b 1
)

:: 启动主程序
echo [提示] 启动立杰人力资源管理系统...
python main.py
pause
