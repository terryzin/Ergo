@echo off
REM ============================
REM Ergo 一键启动脚本
REM ============================
REM 功能：
REM 1. 检查环境变量配置
REM 2. 启动所有必要服务
REM 3. 显示访问地址
REM ============================

cd /d "%~dp0\.."

echo ╔════════════════════════════════════════════╗
echo ║        Ergo - AI 管家控制台启动           ║
echo ╚════════════════════════════════════════════╝
echo.

REM 检查 .env 文件
if not exist .env (
    echo [ERROR] .env 文件不存在
    echo [INFO] 请复制 .env.example 为 .env 并配置参数
    echo.
    echo 执行命令:
    echo   copy .env.example .env
    echo   notepad .env
    echo.
    pause
    exit /b 1
)

REM 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js 未安装
    echo [INFO] 请访问 https://nodejs.org/ 安装
    pause
    exit /b 1
)

REM 检查依赖
if not exist node_modules (
    echo [INFO] 检测到 node_modules 缺失，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [INFO] 启动 Ergo 服务...
echo.

REM 使用 npm run start:all 启动所有服务
start "Ergo Services" cmd /k "npm run start:all"

echo.
echo ╔════════════════════════════════════════════╗
echo ║           服务已启动                      ║
echo ╠════════════════════════════════════════════╣
echo ║  本地访问: http://localhost:8081          ║
echo ║  公网访问: 见 cpolar 配置                 ║
echo ╠════════════════════════════════════════════╣
echo ║  健康检查: npm test                       ║
echo ║  查看日志: 见启动窗口                     ║
echo ╚════════════════════════════════════════════╝
echo.

timeout /t 3 >nul

REM 等待服务启动
echo [INFO] 等待服务初始化...
timeout /t 5 >nul

REM 运行健康检查
echo.
echo [INFO] 运行健康检查...
call npm test

echo.
echo [SUCCESS] Ergo 已启动完成
echo [INFO] 按任意键打开浏览器...
pause >nul

start http://localhost:8081
