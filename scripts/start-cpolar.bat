@echo off
REM ============================
REM Ergo Cpolar 隧道启动脚本
REM 单域名架构 (v1.7.0)
REM ============================

cd /d "%~dp0\.."

echo ╔════════════════════════════════════════════╗
echo ║     Ergo - Cpolar 隧道启动 (单域名)      ║
echo ╚════════════════════════════════════════════╝
echo.

REM 检查 cpolar 是否安装
where cpolar >nul 2>nul
if errorlevel 1 (
    echo [ERROR] cpolar 未安装或未添加到 PATH
    echo [INFO] 请访问 https://www.cpolar.com/ 下载安装
    pause
    exit /b 1
)

REM 检查 cpolar.yml 是否存在
if not exist cpolar.yml (
    echo [ERROR] cpolar.yml 配置文件不存在
    echo [INFO] 请确保项目根目录下有 cpolar.yml
    pause
    exit /b 1
)

echo [INFO] 启动 Ergo 隧道...
echo.
echo 配置文件: cpolar.yml
echo 隧道名称: ergo
echo 本地端口: 8081
echo 预期域名: https://terryzin.cpolar.top
echo.

REM 启动 cpolar（单隧道）
start "Cpolar Tunnel - Ergo" cpolar start ergo -config cpolar.yml

echo.
echo ╔════════════════════════════════════════════╗
echo ║          隧道已启动                       ║
echo ╠════════════════════════════════════════════╣
echo ║  查看状态: http://localhost:4040          ║
echo ║  公网访问: https://terryzin.cpolar.top    ║
echo ╚════════════════════════════════════════════╝
echo.
echo [INFO] 等待隧道初始化...
timeout /t 3 >nul

REM 打开 cpolar Web UI
echo [INFO] 打开 Cpolar Web UI...
start http://localhost:4040

echo.
echo [SUCCESS] Cpolar 隧道启动完成
echo [INFO] 请在 Cpolar Web UI 中确认隧道状态
echo.
pause
