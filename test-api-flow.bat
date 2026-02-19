@echo off
REM 测试 Ergo API 流程
echo.
echo ════════════════════════════════════════════
echo   Ergo API 流程测试
echo ════════════════════════════════════════════
echo.

echo [1/4] 测试 API Bridge 健康检查...
curl -s http://localhost:8082/health | jq .
if %ERRORLEVEL% NEQ 0 (
    echo [错误] API Bridge 未运行或健康检查失败
    goto :error
)
echo [✓] 健康检查通过
echo.

echo [2/4] 测试获取 Gateway 状态...
curl -s http://localhost:8082/api/status | jq ".gateway.status"
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法获取 Gateway 状态
    goto :error
)
echo [✓] Gateway 状态获取成功
echo.

echo [3/4] 测试获取 Agents 数据...
curl -s http://localhost:8082/api/status | jq ".agents[0].name"
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法获取 Agents 数据
    goto :error
)
echo [✓] Agents 数据获取成功
echo.

echo [4/4] 完整响应数据...
curl -s http://localhost:8082/api/status | jq .
echo.

echo ════════════════════════════════════════════
echo   ✅ 所有测试通过！
echo ════════════════════════════════════════════
echo.
echo 前端访问: http://localhost:8081
echo API 文档: server\README.md
echo.
pause
exit /b 0

:error
echo.
echo ════════════════════════════════════════════
echo   ❌ 测试失败
echo ════════════════════════════════════════════
echo.
echo 请检查:
echo 1. API Bridge 是否运行: npm run api
echo 2. OpenClaw Gateway 是否运行: openclaw gateway status
echo 3. 端口 8082 是否被占用: netstat -ano ^| findstr :8082
echo.
pause
exit /b 1
