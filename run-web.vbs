' 立杰人力资源管理系统 - 浏览器模式启动
' 先启动服务（run-web.bat），然后用默认浏览器打开

Dim WshShell, FSO
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 获取当前目录
Dim currentDir
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)

' 检查 run-web.bat 是否存在
If Not FSO.FileExists(currentDir & "\run-web.bat") Then
    MsgBox "找不到 run-web.bat 文件", 16, "错误"
    WScript.Quit 1
End If

' 启动服务（无窗口）
WshShell.Run "cmd /c cd /d """ & currentDir & """ && start /min run-web.bat", 0, False

' 等待服务启动
WScript.Sleep 3000

' 用默认浏览器打开
WshShell.Run "http://127.0.0.1:8765", 1, False

Set WshShell = Nothing
Set FSO = Nothing
