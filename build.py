#!/usr/bin/env python3
"""
立杰工资管理系统 - PyInstaller 打包脚本
使用方法: python build.py [--debug] [--clean]
"""

import os
import sys
import shutil
import subprocess


def clean_build():
    """清理构建文件"""
    print("[Clean] Removing build files...")
    dirs_to_remove = ['build', 'dist']
    for d in dirs_to_remove:
        if os.path.exists(d):
            shutil.rmtree(d)
            print(f"  Removed: {d}")
    
    # Remove .spec files
    for f in os.listdir('.'):
        if f.endswith('.spec'):
            os.remove(f)
            print(f"  Removed: {f}")
    
    print("[Clean] Done!")


def build(debug=False):
    """打包应用程序"""
    print("=" * 50)
    print("  立杰工资管理系统 - 打包")
    print("=" * 50)
    print()
    
    # Clean old builds
    clean_build()
    
    # Build command (use --onedir instead of --onefile for data persistence)
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        'main.py',
        '--name', '立杰工资管理系统',
        '--onedir',  # Directory mode: data persists in the folder
        '--add-data', 'web;web',
        '--add-data', 'database;database',
        '--add-data', 'services;services',
        '--add-data', 'b.json;.',
        '--add-data', 'api.py;.',
        '--add-data', 'api_server.py;.',
        '--hidden-import', 'webview',
        '--hidden-import', 'webview.platforms.winforms',
        '--clean',
        '--noconfirm',
    ]
    
    if debug:
        cmd.append('--console')
        print("[Build] Debug mode (with console window)")
    else:
        cmd.append('--windowed')
        print("[Build] Normal mode (no console window)")
    
    print()
    print("[Build] Starting...")
    print("[Build] This may take a few minutes, please wait...")
    print()
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print()
        print("=" * 50)
        print("  Build Successful!")
        print("=" * 50)
        print()
        print("Output: dist\\立杰工资管理系统.exe")
        print()
        print("You can distribute the 'dist' folder to other machines.")
        print("No Python installation required on target machines.")
    else:
        print()
        print("[Error] Build failed!")
        sys.exit(1)


def main():
    args = sys.argv[1:]
    
    if '--clean' in args:
        clean_build()
        return
    
    debug = '--debug' in args
    build(debug=debug)


if __name__ == '__main__':
    main()
