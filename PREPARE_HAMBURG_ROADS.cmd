@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0prototype\scripts\prepare-hamburg-roads-on-windows.ps1" %*
set "exit_code=%ERRORLEVEL%"
if not "%exit_code%"=="0" (
  echo.
  echo Hamburg road preparation stopped with exit code %exit_code%.
  pause
)
exit /b %exit_code%
