@echo off
echo 测试脚本开始运行...
echo 当前目录: %cd%
echo 脚本目录: %~dp0

REM 检查 Node.js 是否安装
echo 检查 Node.js 版本...
node --version
if errorlevel 1 (
  echo 错误: Node.js 未安装或未添加到 PATH
  pause
  exit /b 1
)

REM 检查 npm 是否可用
echo 检查 npm 版本...
npm --version
if errorlevel 1 (
  echo 错误: npm 未安装或未添加到 PATH
  pause
  exit /b 1
)

REM 检查项目依赖
echo 检查项目依赖...
if not exist "node_modules" (
  echo 错误: 项目依赖未安装
  echo 正在安装依赖...
  npm install
  if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
  )
)

REM 测试启动开发服务器
echo 测试启动开发服务器...
start "Test Server" cmd /k "npm run dev"

echo 服务器已启动，请检查浏览器是否打开
pause
