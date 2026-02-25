@echo off
echo Testing Redbook Tool...
echo.
echo 1. Checking Node.js installation...
node --version
if errorlevel 1 (
  echo Error: Node.js is not installed
  pause
  exit /b 1
)
echo.
echo 2. Checking npm installation...
npm --version
if errorlevel 1 (
  echo Error: npm is not installed
  pause
  exit /b 1
)
echo.
echo 3. Checking project dependencies...
if not exist "node_modules" (
  echo Error: Node modules not found
  echo Installing dependencies...
  npm install
  if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
  )
)
echo.
echo 4. Testing application start...
echo The application should start in a new window
echo Press any key to start...
pause >nul
start "Redbook Tool" cmd /k "npm run dev"
echo.
echo Application starting...
echo Please check if the browser opens to http://localhost:3001
echo.
pause
