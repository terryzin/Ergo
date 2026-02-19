@echo off
REM Ergo 启动脚本
REM 同时启动前端（8081）和 API Bridge（8082）

echo.
echo ╔════════════════════════════════════════════╗
echo ║   Ergo - AI 管家控制台                    ║
echo ╠════════════════════════════════════════════╣
echo ║   启动服务...                             ║
echo ╚════════════════════════════════════════════╝
echo.

REM 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Node.js 未安装或不在 PATH 中
    pause
    exit /b 1
)

REM 检查 Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Python 未安装或不在 PATH 中
    pause
    exit /b 1
)

REM 启动 API Bridge（后台）
echo [1/2] 启动 API Bridge (http://localhost:8082)...
start /B "Ergo API Bridge" cmd /c "node server\api-bridge.js"
timeout /t 2 /nobreak >nul

REM 启动前端服务器
echo [2/2] 启动 Ergo 前端 (http://localhost:8081)...
echo.
echo ════════════════════════════════════════════
echo   Ergo 已启动！
echo ════════════════════════════════════════════
echo.
echo   前端:  http://localhost:8081
echo   API:   http://localhost:8082/api/status
echo.
echo   按 Ctrl+C 停止服务器
echo ════════════════════════════════════════════
echo.

REM 启动前端（前台）
python -m http.server 8081
