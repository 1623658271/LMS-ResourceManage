@echo off
chcp 65001 >nul
title Li-Jie Wage System - Build Tool

echo ==========================================
echo   Li-Jie Wage System - Build Tool
echo ==========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [Error] Python not found!
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)

echo Select build option:
echo.
echo  [1] Normal build (no console window, recommended)
echo  [2] Debug build (with console window for troubleshooting)
echo  [3] Clean build files only
echo  [Q] Quit
echo.
set /p choice="Enter option (1/2/3/Q): "

if "%choice%"=="1" goto normal
if "%choice%"=="2" goto debug
if "%choice%"=="3" goto clean
if /i "%choice%"=="Q" goto end

echo Invalid option!
pause
exit /b 1

:normal
echo.
echo [Info] Building normal version (directory mode for data persistence)...
python -m PyInstaller main.py --name "立杰工资管理系统" --windowed --onedir --icon "立杰鞋业工资管理系统.ico" --add-data "web;web" --add-data "database;database" --add-data "services;services" --add-data "b.json;." --add-data "api.py;." --add-data "api_server.py;." --hidden-import webview --hidden-import webview.platforms.winforms --clean --noconfirm
if errorlevel 1 (
    echo [Error] Build failed!
    pause
    exit /b 1
)
echo [Success] Build complete! Output: dist\立杰工资管理系统.exe
pause
exit /b 0

:debug
echo.
echo [Info] Building debug version (directory mode for data persistence)...
python -m PyInstaller main.py --name "立杰工资管理系统" --console --onedir --icon "立杰鞋业工资管理系统.ico" --add-data "web;web" --add-data "database;database" --add-data "services;services" --add-data "b.json;." --add-data "api.py;." --add-data "api_server.py;." --hidden-import webview --hidden-import webview.platforms.winforms --clean --noconfirm
if errorlevel 1 (
    echo [Error] Build failed!
    pause
    exit /b 1
)
echo [Success] Build complete! Output: dist\立杰工资管理系统.exe
pause
exit /b 0

:clean
echo.
echo [Info] Cleaning build files...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist "*.spec" del /f /q "*.spec"
echo [Success] Clean complete!
pause
exit /b 0

:end
exit /b 0
