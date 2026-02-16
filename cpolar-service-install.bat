@echo off
echo ========================================
echo Cpolar Service 安装脚本 (需管理员运行)
echo ========================================
echo.

echo 正在安装cpolar为Windows服务...
D:\tools\cpolar\cpolar.exe service install

echo.
echo 正在启动服务...
D:\tools\cpolar\cpolar.exe service start

echo.
echo 检查服务状态...
sc query Cpolar

echo.
echo 完成！Cpolar现在会开机自动启动。
echo 如果需要停止服务: cpolar service stop
echo 如果需要卸载: cpolar service uninstall
pause
