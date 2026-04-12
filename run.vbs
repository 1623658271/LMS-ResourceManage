' 立杰人力资源管理系统 - 静默启动（无命令行窗口）
' 使用 VBScript 隐藏命令行窗口启动 Python

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' 获取当前目录
Dim currentDir
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)

' 构建命令
cmd = "cmd /c cd /d """ & currentDir & """ && "

' 检查并激活 venv
If CreateObject("Scripting.FileSystemObject").FolderExists(currentDir & "\venv") Then
    cmd = cmd & "call venv\Scripts\activate.bat && "
End If

' 安装依赖并启动
cmd = cmd & "pip install -q -r requirements.txt && pythonw main.py"

' 使用 pythonw 运行（无控制台窗口）
WshShell.Run cmd, 0, False

Set WshShell = Nothing
