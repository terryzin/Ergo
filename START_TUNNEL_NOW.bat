@echo off
chcp 65001 >nul

echo ========================================
echo   Starting Ergo Tunnel
echo ========================================
echo.
echo Please wait...
echo.

cd /d "%~dp0"

REM Start cpolar tunnel
echo Starting: cpolar http 8081 -subdomain=terryzin -region=cn
echo.
echo IMPORTANT: Keep this window open!
echo Closing this window will stop the tunnel.
echo.
echo ========================================
echo.

cpolar http 8081 -subdomain=terryzin -region=cn
