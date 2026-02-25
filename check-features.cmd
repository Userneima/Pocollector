@echo off
echo Checking new features...
echo.

REM Check if server is running
echo 1. Checking development server...
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001' -TimeoutSec 5 | Out-Null; Write-Host '  OK - Server is running' } catch { Write-Host '  ERROR - Server not running' }"

echo.
echo 2. Checking image analysis API...
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001/api/analyze-image' -TimeoutSec 5 | Out-Null; Write-Host '  OK - Image analysis API working' } catch { Write-Host '  ERROR - Image analysis API failed' }"

echo.
echo 3. Checking download API...
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:3001/api/download' -TimeoutSec 5 | Out-Null; Write-Host '  OK - Download API working' } catch { Write-Host '  ERROR - Download API failed' }"

echo.
echo 4. Features should include:
echo    - Image upload button in edit modal
echo    - Delete button on each image (top-left)
echo    - Image analysis on upload
echo    - Manual product type detection

echo.
echo 5. If features not visible:
echo    - Press Ctrl+F5 to force refresh
echo    - Clear browser cache
echo    - Use incognito mode

echo.
pause