@echo off

REM 设计灵感采集器启动脚本
REM 此脚本会检查Node.js环境、安装依赖并启动API服务

echo ===================================
echo 设计灵感采集器启动脚本
echo ===================================
echo.

REM 检查是否安装了npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误：未找到Node.js环境
    echo.
    echo 请先下载并安装Node.js：
    echo Windows: https://nodejs.org/en/download/
    echo macOS: https://nodejs.org/en/download/
    echo Linux: 使用包管理器安装，如 "sudo apt install nodejs npm"
    echo.
    echo 安装完成后，请重新运行此脚本
    echo.
    pause
    exit /b 1
)

REM 检查Node.js版本
echo 正在检查Node.js版本...
node --version
npm --version
echo.

echo 正在检查依赖...
echo.

REM 安装依赖
if not exist "node_modules" (
    echo 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 错误：依赖安装失败
        echo 请检查网络连接后重试
        pause
        exit /b 1
    )
    echo 依赖安装成功！
    echo.
) else (
    echo 依赖已存在，跳过安装步骤
    echo.
)

REM 启动API服务
echo 正在启动API服务...
echo 服务启动后，请勿关闭此窗口
echo 服务地址：http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务
echo ===================================
echo.

npm run dev

pause