@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
cd /d "%SCRIPT_DIR%"

set "PORT=3001"

REM 检查端口是否已被占用
tasklist /FI "PID eq %PORT%" 2>NUL | find /I "PID" >NUL
if %ERRORLEVEL% EQU 0 (
  echo 端口 %PORT% 已被占用，直接打开浏览器...
  start "Redbook" "http://localhost:%PORT%"
  exit /b 0
)

REM 检查是否需要构建
if not exist ".next\BUILD_ID" (
  echo 正在构建生产版本，请稍候...
  npm run build
  if errorlevel 1 (
    echo 构建失败，请检查报错信息。
    pause
    exit /b 1
  )
)

REM 启动服务器
echo 正在启动服务器...
start "Redbook Server" /min cmd /k "npm run start"

REM 等待服务器启动
echo 等待服务器启动...
timeout /t 3 /nobreak >nul

REM 打开浏览器
echo 打开浏览器...
start "Redbook" "http://localhost:%PORT%"
