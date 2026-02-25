@echo off
echo Creating desktop shortcut...
powershell -Command "& { $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\Redbook Tool.lnk'); $s.TargetPath = '%~dp0start-redbook.cmd'; $s.WorkingDirectory = '%~dp0'; $s.Save(); Write-Host 'Desktop shortcut created successfully.' }"
echo.
echo Desktop shortcut created successfully!
echo You can now double-click "Redbook Tool" on your desktop to start the application.
echo The app will run at http://localhost:3001
pause
