@echo off
chcp 65001 >nul
REM UTF-8 encoding for Chinese characters

echo ========================================
echo   Ergo - Manual Tunnel Start
echo   (Bypassing config file)
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Check local service (8081)...
curl -s -o nul -w "%%{http_code}" http://localhost:8081 > temp.txt
set /p STATUS=<temp.txt
del temp.txt

if "%STATUS%"=="200" (
    echo [OK] Port 8081 is responding: %STATUS%
) else (
    echo [ERROR] Port 8081 not responding: %STATUS%
    echo [INFO] Please run: npm run start:all
    pause
    exit /b 1
)
echo.

echo Step 2: Stop cpolar service...
net stop cpolar 2>nul
timeout /t 2 /nobreak >nul
echo.

echo Step 3: Start tunnel manually...
echo [INFO] Tunnel config:
echo   Local Port: 8081
echo   Subdomain: terryzin
echo   Region: cn
echo   Public URL: https://terryzin.cpolar.cn
echo.
echo [INFO] Starting tunnel...
echo.

REM Start cpolar in a new window
start "Cpolar Tunnel - Ergo" cpolar http 8081 -subdomain=terryzin -region=cn

echo.
echo [INFO] Waiting for tunnel to initialize (10 seconds)...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Tunnel Started!
echo ========================================
echo   Web UI: http://localhost:4040
echo   Public URL: https://terryzin.cpolar.cn
echo ========================================
echo.

echo [INFO] Opening Web UI to verify...
timeout /t 2 /nobreak >nul
start http://localhost:4040

echo.
echo [INFO] Opening public URL to test...
timeout /t 2 /nobreak >nul
start https://terryzin.cpolar.cn

echo.
echo [SUCCESS] Tunnel started!
echo [INFO] Check the Cpolar window to see tunnel status
echo [INFO] DO NOT close the Cpolar window!
echo.
pause
