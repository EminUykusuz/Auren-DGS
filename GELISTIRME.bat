@echo off
cd /d "%~dp0"
start "Auren DGS - API" /min cmd /k "cd /d %~dp0server && npm run dev"
start "Auren DGS - Arayuz (dev)" /min cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
