' 停止立杰人力资源管理系统服务
' 结束所有相关的 pythonw.exe 进程

Dim WshShell, WMIService, Processes, Process
Set WshShell = CreateObject("WScript.Shell")
Set WMIService = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")

' 获取当前目录
Dim currentDir
currentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)

' 查找并结束 web_server.py 相关的 pythonw 进程
Set Processes = WMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name='pythonw.exe'")

Dim count
count = 0
For Each Process In Processes
    ' 检查命令行是否包含 web_server.py
    If InStr(Process.CommandLine, "web_server.py") > 0 Then
        Process.Terminate
        count = count + 1
    End If
Next

If count > 0 Then
    MsgBox "已停止 " & count & " 个服务进程", 64, "停止服务"
Else
    MsgBox "没有找到运行中的服务", 64, "停止服务"
End If

Set WshShell = Nothing
Set WMIService = Nothing
