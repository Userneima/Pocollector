@echo off
cd /d "%~dp0"
echo 正在启动小红书采集工具...
echo 应用将在 http://localhost:3001 运行
echo.
start http://localhost:3001
npm run dev
pause
