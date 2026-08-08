# Lighthouse CI 本地测试脚本
# 用法: .\lhci-local.ps1 [autorun|collect|assert|serve|help]
#
# 前置条件:
#   1. 已安装 Node.js >= 18 (已检测到)
#   2. 已安装 Google Chrome 或 Microsoft Edge 浏览器
#
# 首次运行前请执行: npm install

param(
    [Parameter(Position=0)]
    [ValidateSet("autorun", "collect", "assert", "serve", "status", "help")]
    [string]$Command = "autorun"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Lighthouse CI 本地测试工具" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ========== 环境检查 ==========

# 检查 Node.js
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    $nodeExe = "C:\Program Files\nodejs\node.exe"
    if (Test-Path $nodeExe) {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    } else {
        Write-Host "[ERROR] 未找到 Node.js，请先安装: https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
}

# 检查 Chrome / Edge 浏览器
$chromePath = $null
$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
foreach ($c in $chromeCandidates) {
    if (Test-Path $c) {
        $chromePath = $c
        break
    }
}

if ($chromePath) {
    $browserName = if ($chromePath -match "Edge") { "Microsoft Edge" } else { "Google Chrome" }
    Write-Host "[INFO] 检测到浏览器: $browserName" -ForegroundColor Green
    Write-Host "[INFO] 路径: $chromePath" -ForegroundColor Gray
    $env:CHROME_PATH = $chromePath
} else {
    Write-Host "[ERROR] 未找到 Chrome 或 Edge 浏览器，请安装其中之一:" -ForegroundColor Red
    Write-Host "        Chrome: https://www.google.com/chrome/" -ForegroundColor Yellow
    Write-Host "        Edge:   https://www.microsoft.com/edge" -ForegroundColor Yellow
    exit 1
}

# 检查依赖是否安装
if (-not (Test-Path "$ProjectDir\node_modules\@lhci\cli")) {
    Write-Host "[INFO] 首次运行，正在安装依赖..." -ForegroundColor Yellow
    Push-Location $ProjectDir
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] 依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

# ========== 命令执行 ==========

switch ($Command) {
    "autorun" {
        Write-Host "[RUN] 执行完整 Lighthouse CI 流程 (collect + assert + upload)`n" -ForegroundColor Green
        Write-Host "[INFO] 测试目标: http://localhost:8080/旅行助手.html" -ForegroundColor Gray
        Write-Host "[INFO] 运行次数: 3 次 (取中位数)`n" -ForegroundColor Gray
        Push-Location $ProjectDir
        npx lhci autorun
        $exitCode = $LASTEXITCODE
        Pop-Location

        Write-Host ""
        if ($exitCode -eq 0) {
            Write-Host "[PASS] 所有阈值检查通过!" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] 存在未通过阈值的项目，请查看上方报告" -ForegroundColor Red
        }

        # 检查是否有报告生成
        $reportDir = "$ProjectDir\.lighthouseci"
        if (Test-Path $reportDir) {
            Write-Host "`n[INFO] 报告目录: $reportDir" -ForegroundColor Cyan
            $htmlReports = Get-ChildItem "$reportDir" -Filter "*.html" -ErrorAction SilentlyContinue
            if ($htmlReports) {
                Write-Host "[INFO] HTML 报告文件:" -ForegroundColor Cyan
                foreach ($r in $htmlReports) {
                    Write-Host "  -> $($r.FullName)" -ForegroundColor White
                }
                Write-Host "`n[提示] 在浏览器中打开上述 .html 文件可查看详细报告" -ForegroundColor Yellow
            }
            $jsonReports = Get-ChildItem "$reportDir" -Filter "*.json" -ErrorAction SilentlyContinue
            if ($jsonReports) {
                Write-Host "[INFO] JSON 数据文件: $($jsonReports.Count) 个" -ForegroundColor Gray
            }
        }
        exit $exitCode
    }

    "collect" {
        Write-Host "[RUN] 仅收集 Lighthouse 数据 (不执行阈值断言)`n" -ForegroundColor Green
        Push-Location $ProjectDir
        npx lhci collect
        Pop-Location
        Write-Host "`n[INFO] 数据已收集到 .lighthouseci/ 目录" -ForegroundColor Cyan
    }

    "assert" {
        Write-Host "[RUN] 仅执行阈值断言 (需先 collect)`n" -ForegroundColor Green
        Push-Location $ProjectDir
        npx lhci assert
        Pop-Location
    }

    "serve" {
        Write-Host "[RUN] 启动本地静态服务器`n" -ForegroundColor Green
        Write-Host "[INFO] 访问地址: http://localhost:8080/旅行助手.html" -ForegroundColor Cyan
        Write-Host "[INFO] 按 Ctrl+C 停止服务器`n" -ForegroundColor Yellow
        Push-Location $ProjectDir
        npx http-server $ProjectDir -p 8080 --cors -c-1
        Pop-Location
    }

    "status" {
        Write-Host "[INFO] 启动 Lighthouse CI 服务器查看历史报告`n" -ForegroundColor Green
        Write-Host "[INFO] 访问地址: http://localhost:9001" -ForegroundColor Cyan
        Push-Location $ProjectDir
        npx lhci server --port 9001
        Pop-Location
    }

    "help" {
        Write-Host "可用命令:`n" -ForegroundColor Yellow
        Write-Host "  .\lhci-local.ps1 autorun    - 完整测试流程 (默认): 收集数据 + 阈值断言" -ForegroundColor White
        Write-Host "  .\lhci-local.ps1 collect    - 仅收集 Lighthouse 数据，不断言" -ForegroundColor White
        Write-Host "  .\lhci-local.ps1 assert     - 仅执行阈值断言 (需先 collect)" -ForegroundColor White
        Write-Host "  .\lhci-local.ps1 serve      - 启动本地静态服务器 (端口 8080)" -ForegroundColor White
        Write-Host "  .\lhci-local.ps1 status     - 启动 LHCI 报告查看服务器 (端口 9001)" -ForegroundColor White
        Write-Host "`n阈值配置 (lighthouserc.json):" -ForegroundColor Yellow
        Write-Host "  Performance     >= 85 (error - 不通过则 CI 失败)" -ForegroundColor White
        Write-Host "  Accessibility   >= 90 (error - 不通过则 CI 失败)" -ForegroundColor White
        Write-Host "  Best Practices  >= 80 (warn  - 仅警告)" -ForegroundColor White
        Write-Host "  SEO             >= 80 (warn  - 仅警告)" -ForegroundColor White
        Write-Host "  PWA             >= 70 (warn  - 仅警告)" -ForegroundColor White
        Write-Host "`n环境变量:" -ForegroundColor Yellow
        Write-Host "  CHROME_PATH     - 自动检测 Chrome 或 Edge 路径" -ForegroundColor White
    }
}
