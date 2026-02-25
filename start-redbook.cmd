@echo off
cd /d "%~dp0"
echo Starting Redbook Tool...
echo App will run at http://localhost:3001
echo.
start http://localhost:3001
npm run dev
pause
