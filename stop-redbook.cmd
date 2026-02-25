@echo off
setlocal
set "PORT=3000"
set "TARGET_PID="

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty OwningProcess)"`) do set "TARGET_PID=%%i"

if not defined TARGET_PID (
  echo 未检测到 %PORT% 端口上的服务。
  exit /b 0
)

echo 正在停止 PID %TARGET_PID% ...
taskkill /PID %TARGET_PID% /F >nul 2>&1
if errorlevel 1 (
  echo 停止失败，请尝试手动结束进程。
  exit /b 1
)

echo 已停止本地服务。
