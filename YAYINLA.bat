@echo off
setlocal
title Auren Study - Manuel Yayin
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\manual-deploy.ps1"
set "result=%ERRORLEVEL%"

if "%result%"=="0" (
  echo.
  echo Yayin tamamlandi.
) else (
  echo.
  echo Yayin basarisiz. Yukaridaki hatayi kontrol edin.
)

pause
exit /b %result%
