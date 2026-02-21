@echo off
REM ============================
REM Cpolar 隧道状态检查脚本
REM ============================

echo ╔════════════════════════════════════════════╗
echo ║     Cpolar 隧道状态诊断                   ║
echo ╚════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM 1. 检查 cpolar 服务
echo [1/5] 检查 cpolar 服务状态...
sc query cpolar | findstr "STATE"
if errorlevel 1 (
    echo [ERROR] cpolar 服务未运行
    echo [FIX] 运行: FIX_CPOLAR_TUNNEL.bat
) else (
    echo [OK] cpolar 服务正在运行
)
echo.

REM 2. 检查本地服务
echo [2/5] 检查本地服务端口...
netstat -ano | findstr ":8081" >nul
if errorlevel 1 (
    echo [ERROR] 端口 8081 未监听（前端服务未启动）
    echo [FIX] 运行: npm run start:all
) else (
    echo [OK] 端口 8081 正在监听
)

netstat -ano | findstr ":8082" >nul
if errorlevel 1 (
    echo [ERROR] 端口 8082 未监听（API Bridge 未启动）
    echo [FIX] 运行: npm run start:all
) else (
    echo [OK] 端口 8082 正在监听
)

netstat -ano | findstr ":18789" >nul
if errorlevel 1 (
    echo [ERROR] 端口 18789 未监听（Gateway 未启动）
) else (
    echo [OK] 端口 18789 正在监听
)
echo.

REM 3. 检查 cpolar Web UI
echo [3/5] 检查 cpolar Web UI...
netstat -ano | findstr ":4040" >nul
if errorlevel 1 (
    echo [ERROR] 端口 4040 未监听（Web UI 未启动）
) else (
    echo [OK] 端口 4040 正在监听
    echo [INFO] 访问: http://localhost:4040
)
echo.

REM 4. 测试本地服务
echo [4/5] 测试本地服务访问...
curl -s -o nul -w "%%{http_code}" http://localhost:8081 >temp_status.txt
set /p LOCAL_STATUS=<temp_status.txt
del temp_status.txt

if "%LOCAL_STATUS%"=="200" (
    echo [OK] 本地 8081 响应: %LOCAL_STATUS% OK
) else (
    echo [ERROR] 本地 8081 响应: %LOCAL_STATUS%
)

curl -s http://localhost:8082/api/health >nul
if errorlevel 1 (
    echo [ERROR] API Bridge 健康检查失败
) else (
    echo [OK] API Bridge 健康检查通过
)
echo.

REM 5. 检查配置文件
echo [5/5] 检查配置文件...
if exist cpolar.yml (
    echo [OK] cpolar.yml 存在
    findstr "addr: 8081" cpolar.yml >nul
    if errorlevel 1 (
        echo [ERROR] cpolar.yml 配置错误（应该指向 8081）
    ) else (
        echo [OK] cpolar.yml 配置正确（指向 8081）
    )
) else (
    echo [ERROR] cpolar.yml 不存在
)
echo.

echo ╔════════════════════════════════════════════╗
echo ║          诊断完成                         ║
echo ╠════════════════════════════════════════════╣
echo ║  如果所有检查都通过但仍然 404:           ║
echo ║  1. 等待 1-2 分钟让隧道初始化            ║
echo ║  2. 访问 http://localhost:4040 查看隧道   ║
echo ║  3. 确认子域名是 terryzin                ║
echo ║  4. 如果子域名错误，运行修复脚本         ║
echo ╚════════════════════════════════════════════╝
echo.

echo [INFO] 现在打开 Cpolar Web UI...
timeout /t 2 >nul
start http://localhost:4040

echo.
pause
