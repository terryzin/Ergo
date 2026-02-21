@echo off
REM ============================
REM 修复 Cpolar 隧道配置
REM 需要管理员权限运行
REM ============================

echo ╔════════════════════════════════════════════╗
echo ║     修复 Cpolar 隧道配置                  ║
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

echo [步骤 1/5] 停止 cpolar 服务...
sc stop cpolar
timeout /t 3 /nobreak >nul

echo [步骤 2/5] 卸载 cpolar 服务...
sc delete cpolar
timeout /t 2 /nobreak >nul

echo [步骤 3/5] 检查配置文件...
if not exist cpolar.yml (
    echo [ERROR] cpolar.yml 不存在
    pause
    exit /b 1
)
echo [INFO] 配置文件: %cd%\cpolar.yml
echo [INFO] 隧道名称: ergo
echo [INFO] 本地端口: 8081
echo [INFO] 子域名: terryzin
echo.

echo [步骤 4/5] 使用新配置重新安装 cpolar 服务...
cpolar service install -config "%cd%\cpolar.yml"
if errorlevel 1 (
    echo [ERROR] cpolar 服务安装失败
    echo [INFO] 尝试查找 cpolar 安装路径...
    where cpolar
    pause
    exit /b 1
)

echo [步骤 5/5] 启动 cpolar 服务...
cpolar service start
if errorlevel 1 (
    echo [ERROR] cpolar 服务启动失败
    pause
    exit /b 1
)

timeout /t 5 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════╗
echo ║          修复完成！                       ║
echo ╠════════════════════════════════════════════╣
echo ║  等待 10 秒让隧道初始化...               ║
echo ╚════════════════════════════════════════════╝
echo.

echo [INFO] 隧道初始化中...
timeout /t 10 /nobreak >nul

echo [INFO] 正在打开 Cpolar Web UI 验证配置...
start http://localhost:4040

echo.
echo ╔════════════════════════════════════════════╗
echo ║          验证步骤                         ║
echo ╠════════════════════════════════════════════╣
echo ║  1. 查看 http://localhost:4040            ║
echo ║  2. 确认看到隧道: ergo → 8081            ║
echo ║  3. 确认公网地址: terryzin.cpolar.cn    ║
echo ║  4. 访问测试: https://terryzin.cpolar.cn ║
echo ╚════════════════════════════════════════════╝
echo.

timeout /t 5 /nobreak >nul
start https://terryzin.cpolar.cn

echo.
echo [SUCCESS] 修复完成！
echo [INFO] 如果仍然 404，请等待 1-2 分钟让隧道完全初始化
echo.
pause
