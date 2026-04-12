' 立杰人力资源管理系统 - 浏览器模式启动（完全无窗口）
' 启动 FastAPI 服务后自动用默认浏览器打开

Dim WshShell, FSO
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 获取当前目录
Dim currentDir
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)

' 检查 web_server.py 是否存在
If Not FSO.FileExists(currentDir & "\web_server.py") Then
    MsgBox "找不到 web_server.py 文件", 16, "错误"
    WScript.Quit 1
End If

' 构建 Python 命令
Dim pythonCmd, venvPython
venvPython = currentDir & "\venv\Scripts\pythonw.exe"

If FSO.FileExists(venvPython) Then
    ' 使用 venv 中的 pythonw
    pythonCmd = """" & venvPython & """ """ & currentDir & "\web_server.py""""
Else
    ' 使用系统 pythonw
    pythonCmd = "pythonw """ & currentDir & "\web_server.py""""
End If

' 后台启动服务（完全隐藏窗口）
WshShell.Run pythonCmd, 0, False

' 等待服务启动
WScript.Sleep 3000

' 用默认浏览器打开
WshShell.Run "http://127.0.0.1:8765", 1, False

Set WshShell = Nothing
Set FSO = Nothing
