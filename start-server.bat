@echo off
setlocal

powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
set "exit_code=%errorlevel%"

if not "%exit_code%"=="0" pause
exit /b %exit_code%
