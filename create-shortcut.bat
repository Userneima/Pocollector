@echo off
set "SCRIPT_DIR=%~dp0"
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\小红书采集工具.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%SCRIPT_DIR%launch.cmd'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

echo 桌面快捷方式已创建: %SHORTCUT%
echo 请双击此快捷方式启动应用
echo 应用将在 http://localhost:3001 运行

pause
