# 小红书采集工具启动脚本
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Port = 3001

# 检查端口是否已被占用
try {
    $ExistingProcess = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ExistingProcess) {
        Write-Host "端口 $Port 已被占用，直接打开浏览器..."
        Start-Process "http://localhost:$Port"
        exit 0
    }
} catch {
    Write-Host "检查端口时出错: $_"
}

# 检查是否需要构建
if (-not (Test-Path ".next\BUILD_ID")) {
    Write-Host "正在构建生产版本，请稍候..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "构建失败，请检查报错信息。"
        Read-Host "按 Enter 键退出..."
        exit 1
    }
}

# 启动服务器
Write-Host "正在启动服务器..."
$CmdArgs = "/k", "cd", "/d", "$ScriptDir", "&", "npm", "run", "start"
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList $CmdArgs

# 等待服务器启动
Write-Host "等待服务器启动..."
Start-Sleep -Seconds 3

# 打开浏览器
Write-Host "打开浏览器..."
Start-Process "http://localhost:$Port"
