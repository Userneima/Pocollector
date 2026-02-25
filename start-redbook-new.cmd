@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
cd /d "%SCRIPT_DIR%"

set "PORT=3001"
set "EXISTING_PID="

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue ^| Select-Object -First 1 -ExpandProperty OwningProcess)"`) do set "EXISTING_PID=%%i"

if defined EXISTING_PID (
  start "Redbook" "http://localhost:%PORT%"
  exit /b 0
)

if not exist ".next\BUILD_ID" (
  echo 正在构建生产版本，请稍候...
  call npm run build
  if errorlevel 1 (
    echo 构建失败，请检查报错信息。
    pause
    exit /b 1
  )
)

start "Redbook Lite Server" /min cmd /k "cd /d "%SCRIPT_DIR%" && npm run start"

timeout /t 3 /nobreak >nul
start "Redbook" "http://localhost:%PORT%"