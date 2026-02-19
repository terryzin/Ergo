@echo off
echo ========================================
echo Ergo Status Server 启动脚本
echo ========================================
echo.
echo 正在启动中转服务...

cd /d "%~dp0"

python status-server.py

pause
