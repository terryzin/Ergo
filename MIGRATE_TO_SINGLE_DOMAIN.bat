@echo off
REM ============================
REM Ergo 单域名迁移脚本
REM 需要管理员权限运行
REM ============================

echo ╔════════════════════════════════════════════╗
echo ║     Ergo - 单域名架构迁移                 ║
echo ║     从双域名切换到单域名                  ║
echo ╚════════════════════════════════════════════╝
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 需要管理员权限
    echo [INFO] 请右键点击此脚本，选择"以管理员身份运行"
    pause
    exit /b 1
)

cd /d "%~dp0"

echo [步骤 1/4] 停止 cpolar 服务...
sc stop cpolar
timeout /t 3 /nobreak >nul

echo [步骤 2/4] 卸载 cpolar 服务...
sc delete cpolar
timeout /t 2 /nobreak >nul

echo [步骤 3/4] 使用新配置重新安装 cpolar 服务...
echo [INFO] 配置文件: %cd%\cpolar.yml
cpolar service install -config "%cd%\cpolar.yml"
if errorlevel 1 (
    echo [ERROR] cpolar 服务安装失败
    echo [INFO] 请确保 cpolar 已正确安装并添加到 PATH
    pause
    exit /b 1
)

echo [步骤 4/4] 启动 cpolar 服务...
cpolar service start
if errorlevel 1 (
    echo [ERROR] cpolar 服务启动失败
    pause
    exit /b 1
)

timeout /t 3 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════╗
echo ║          迁移完成！                       ║
echo ╠════════════════════════════════════════════╣
echo ║  查看状态: http://localhost:4040          ║
echo ║  公网访问: https://terryzin.cpolar.cn    ║
echo ║  隧道数量: 1 (ergo)                       ║
echo ║  释放域名: 1 (留给其他项目)              ║
echo ╚════════════════════════════════════════════╝
echo.

echo [INFO] 正在打开 Cpolar Web UI 验证配置...
timeout /t 2 /nobreak >nul
start http://localhost:4040

echo.
echo [SUCCESS] 迁移完成！
echo [INFO] 请在 Cpolar Web UI 中确认只有 1 个隧道 (ergo)
echo.
pause
