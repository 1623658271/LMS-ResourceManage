' 立杰工资管理系统 - 静默启动（无命令行窗口）
' 使用 VBScript 隐藏命令行窗口启动 Python

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' 获取当前目录
Dim currentDir
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)

' 检查 Python 是否安装
Dim pythonCheck
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
pythonCheck = WshShell.Run("cmd /c where python >nul 2>nul", 0, True)

If pythonCheck <> 0 Then
    MsgBox "未检测到 Python，请先安装 Python 3.8 或更高版本" & vbCrLf & vbCrLf & _
           "下载地址: https://www.python.org/downloads/" & vbCrLf & vbCrLf & _
           "安装时请勾选 'Add Python to PATH'", vbExclamation, "立杰工资管理系统 - 首次运行"
    WScript.Quit 1
End If

' 检查 venv 是否存在且有效
Dim fso, venvPython
Set fso = CreateObject("Scripting.FileSystemObject")
venvPython = currentDir & "\venv\Scripts\python.exe"

Dim needCreateVenv
needCreateVenv = False

If fso.FileExists(venvPython) Then
    ' 尝试运行 venv 中的 python
    Dim testCmd, testResult
    testCmd = "cmd /c """ & venvPython & """ -c ""import sys; sys.exit(0)"""""" 2>nul"
    testResult = WshShell.Run(testCmd, 0, True)
    If testResult <> 0 Then
        needCreateVenv = True
        ' 删除损坏的 venv
        If fso.FolderExists(currentDir & "\venv") Then
            On Error Resume Next
            fso.DeleteFolder currentDir & "\venv", True
            On Error GoTo 0
        End If
    End If
Else
    needCreateVenv = True
End If

' 构建命令
Dim cmd
cmd = "cmd /c cd /d """ & currentDir & """ && "

' 如果需要，创建 venv
If needCreateVenv Then
    cmd = cmd & "echo [提示] 正在创建虚拟环境... && python -m venv venv && echo [提示] 虚拟环境创建完成 && "
End If

' 激活 venv 并安装依赖
cmd = cmd & "call venv\Scripts\activate.bat && "
cmd = cmd & "python -m pip install --upgrade pip -q && "
cmd = cmd & "pip install -q -r requirements.txt && "
cmd = cmd & "echo [提示] 启动立杰工资管理系统... && "

' 启动主程序
cmd = cmd & "pythonw main.py"

' 使用 pythonw 运行（无控制台窗口）
WshShell.Run cmd, 0, False

Set WshShell = Nothing
