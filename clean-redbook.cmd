@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
cd /d "%SCRIPT_DIR%"

echo 正在清理缓存与日志...
if exist ".next" rmdir /s /q ".next"
if exist ".redbook-dev.log" del /f /q ".redbook-dev.log"

echo 清理完成。
