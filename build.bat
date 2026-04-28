@echo off
chcp 65001 >nul
setlocal
title Li-Jie Wage System - Build Tool

echo ==========================================
echo   Li-Jie Wage System - Build Tool
echo ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [Error] Python not found!
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)

echo Select build option:
echo.
echo  [1] Normal build ^(no console window, recommended^)
echo  [2] Debug build ^(with console window for troubleshooting^)
echo  [3] Clean build files only
echo  [Q] Quit
echo.
set /p choice=Enter option (1/2/3/Q): 

if "%choice%"=="1" goto normal
if "%choice%"=="2" goto debug
if "%choice%"=="3" goto clean
if /i "%choice%"=="Q" goto end

echo Invalid option!
pause
exit /b 1

:normal
echo.
echo [Info] Building normal version...
python build.py
pause
exit /b %errorlevel%

:debug
echo.
echo [Info] Building debug version...
python build.py --debug
pause
exit /b %errorlevel%

:clean
echo.
echo [Info] Cleaning build files...
python build.py --clean
pause
exit /b %errorlevel%

:end
exit /b 0
