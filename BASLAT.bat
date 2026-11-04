@echo off
setlocal
title Auren DGS
cd /d "%~dp0"

if not exist "server\node_modules" (
  echo [1/4] Sunucu paketleri kuruluyor...
  pushd server & call npm install & popd
)
if not exist "client\node_modules" (
  echo [2/4] Istemci paketleri kuruluyor...
  pushd client & call npm install & popd
)

if not exist "client\dist\index.html" (
  echo [3/4] Arayuz derleniyor...
  pushd client & call npm run build & popd
)

echo [4/4] Veritabani semasi kontrol ediliyor...
pushd server & call npm run migrate & popd
if errorlevel 1 (
  echo.
  echo HATA: SQL Server'a baglanilamadi. MSSQLSERVER servisinin calistigindan emin olun.
  pause & exit /b 1
)

start "Auren DGS" /min cmd /k "cd /d %~dp0server && npm start"
echo Sunucu aciliyor...
timeout /t 4 /nobreak >nul
start "" http://localhost:5050
echo.
echo Auren DGS calisiyor: http://localhost:5050
echo Kapatmak icin "Auren DGS" penceresini kapatin.
echo Arayuzde degisiklik yaptiysaniz: client\dist klasorunu silip tekrar baslatin.
timeout /t 5 >nul
