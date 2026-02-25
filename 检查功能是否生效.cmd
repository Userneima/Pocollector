@echo off
echo 正在检查新功能是否生效...
echo.
echo 1. 检查开发服务器状态...
curl -s http://localhost:3001 >nul
if %errorlevel% equ 0 (
  echo ✓ 开发服务器正常运行
) else (
  echo ✗ 开发服务器未运行，请先启动服务器
  pause
  exit /b 1
)

echo.
echo 2. 检查图片分析API...
curl -s http://localhost:3001/api/analyze-image >nul
if %errorlevel% equ 0 (
  echo ✓ 图片分析API正常
) else (
  echo ✗ 图片分析API异常
)

echo.
echo 3. 检查下载API...
curl -s http://localhost:3001/api/download >nul
if %errorlevel% equ 0 (
  echo ✓ 下载API正常
) else (
  echo ✗ 下载API异常
)

echo.
echo 4. 功能说明：
echo    - 新功能包括：图片上传、删除、分析
echo    - 在编辑预览界面中查看
echo    - 右上角有"上传图片"按钮
echo    - 每张图片有删除和下载按钮
echo.
echo 5. 如果功能未显示：
echo    - 按 Ctrl+F5 强制刷新浏览器
echo    - 清除浏览器缓存
echo    - 使用无痕模式访问

echo.
pause