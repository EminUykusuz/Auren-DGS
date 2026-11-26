# Auren API dağıtım betiği (Windows VDS, GitHub Actions self-hosted runner üzerinde çalışır).
# Akış: yedekle → sunucu kodunu ve derlenmiş arayüzü (client-dist) kopyala (.env ve node_modules korunur) → npm ci → migrate → yeniden başlat → sağlık kontrolü.
# Sağlık kontrolü başarısız olursa önceki sürüme otomatik döner ve iş başarısız sayılır.
param(
  [string]$AppDir  = $(if ($env:AUREN_APP_DIR) { $env:AUREN_APP_DIR } else { 'C:\auren' }),
  [int]   $Port    = $(if ($env:AUREN_PORT) { [int]$env:AUREN_PORT } else { 5050 }),
  [string]$Service = 'AurenAPI'   # Windows hizmeti (NSSM vb.) veya aynı adlı zamanlanmış görev
)
$ErrorActionPreference = 'Stop'
$repo   = Split-Path -Parent $PSScriptRoot
$srcNew = Join-Path $repo 'server'
$srv    = Join-Path $AppDir 'server'
$dist   = Join-Path $AppDir 'client\dist'      # sunucu ../../client/dist'i servis eder
$distNew = Join-Path $repo 'client-dist'
$distBak = Join-Path $AppDir 'backup\client-dist'
$bak    = Join-Path $AppDir 'backup\server'
$log    = Join-Path $AppDir 'logs'

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Green }
function Copy-Dist($from, $to) {
  robocopy $from $to /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy (arayüz) başarısız (kod $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0
}
function Copy-Server($from, $to) {
  # /MIR hedefte olmayanı siler; .env ve node_modules hariç tutulduğu için silinmez
  robocopy $from $to /MIR /XD node_modules logs /XF .env /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy başarısız (kod $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0
}
function Stop-Api {
  $svc = Get-Service -Name $Service -ErrorAction SilentlyContinue
  if ($svc) { if ($svc.Status -ne 'Stopped') { Stop-Service $Service -Force }; return }
  if (Get-ScheduledTask -TaskName $Service -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $Service -ErrorAction SilentlyContinue }
  # Port hâlâ dinleniyorsa (elle açılmış node süreci) o süreci kapat
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}
function Start-Api {
  $svc = Get-Service -Name $Service -ErrorAction SilentlyContinue
  if ($svc) { Start-Service $Service; return }
  Write-Host "Zamanlanmış görev '$Service' güncelleniyor (NETWORK SERVICE hesabıyla)."
  $node = (Get-Command node -ErrorAction Stop).Source
  $launcher = Join-Path $AppDir 'start-api.cmd'
  "@echo off`r`ncd /d `"$srv`"`r`n`"$node`" src\index.js >> `"$log\api.log`" 2>&1`r`n" |
    Set-Content -LiteralPath $launcher -Encoding ASCII
  $act = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/d /c `"$launcher`"" -WorkingDirectory $srv
  $trg = New-ScheduledTaskTrigger -AtStartup
  $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\NETWORK SERVICE' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $Service -Action $act -Trigger $trg -Settings $set -Principal $principal -Force | Out-Null
  Start-ScheduledTask -TaskName $Service
}
function Wait-Healthy {
  for ($i = 0; $i -lt 30; $i++) {
    try { if ((Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 3).ok) { return $true } } catch {}
    Start-Sleep -Seconds 1
  }
  return $false
}

Step "Ön kontrol (AppDir=$AppDir, Port=$Port)"
Get-Command node -ErrorAction Stop | Out-Null
if (-not (Test-Path (Join-Path $distNew 'index.html'))) { throw "Derlenmiş arayüz bulunamadı: $distNew (workflow artifact'ı indirmeli)" }
New-Item -ItemType Directory -Force -Path $srv, $bak, $log, $dist, $distBak | Out-Null
if (-not (Test-Path (Join-Path $srv '.env'))) { throw "$srv\.env bulunamadı. Üretim ayarlarını (DB, JWT_SECRET, CORS_ORIGINS...) bir kez elle oluşturun; deploy bu dosyaya dokunmaz." }

Step 'Mevcut sürümü yedekle'
if (Test-Path (Join-Path $srv 'src')) { Copy-Server $srv $bak }
if (Test-Path (Join-Path $dist 'index.html')) { Copy-Dist $dist $distBak }

Step 'API durduruluyor'
Stop-Api

Step 'Yeni kod kopyalanıyor'
Copy-Server $srcNew $srv
Copy-Dist $distNew $dist

try {
  Step 'Bağımlılıklar (npm ci --omit=dev)'
  Push-Location $srv
  npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci başarısız' }

  # Migration'dan önce veritabanı yedeği (kod geri dönüşü şemayı geri almaz). En iyi çaba: yedek alınamazsa deploy durmaz, uyarır.
  Step 'Veritabanı yedeği'
  try {
    $envFile = Join-Path $srv '.env'
    $dbName = ((Get-Content $envFile | Where-Object { $_ -match '^\s*DB_NAME\s*=' }) -replace '^\s*DB_NAME\s*=\s*', '').Trim()
    $sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($dbName -and $sqlcmd) {
      $dbDir = Join-Path $AppDir 'backup\db'
      New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
      $bakFile = Join-Path $dbDir ("$dbName-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.bak')
      & $sqlcmd.Source -S localhost -E -C -b -Q "BACKUP DATABASE [$dbName] TO DISK=N'$bakFile' WITH INIT, CHECKSUM, COMPRESSION" | Out-Host
      if ($LASTEXITCODE -ne 0) { Write-Host "UYARI: veritabanı yedeği alınamadı (kod $LASTEXITCODE); devam ediliyor." -ForegroundColor Yellow }
      else { Get-ChildItem $dbDir -Filter "$dbName-*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | Remove-Item -Force -ErrorAction SilentlyContinue }
      $global:LASTEXITCODE = 0
    } else { Write-Host 'UYARI: sqlcmd ya da DB_NAME bulunamadı, veritabanı yedeği atlandı.' -ForegroundColor Yellow }
  } catch { Write-Host "UYARI: veritabanı yedeği hatası: $_" -ForegroundColor Yellow; $global:LASTEXITCODE = 0 }

  Step 'Veritabanı migrasyonları'
  npm run migrate
  if ($LASTEXITCODE -ne 0) { throw 'migrate başarısız' }
  Pop-Location

  Step 'API başlatılıyor'
  Start-Api
  if (-not (Wait-Healthy)) { throw "Sağlık kontrolü başarısız (http://127.0.0.1:$Port/api/health)" }
  Write-Host "`nDağıtım tamam." -ForegroundColor Green
}
catch {
  Write-Host "`nHATA: $_" -ForegroundColor Red
  Pop-Location -ErrorAction SilentlyContinue
  Write-Host 'Önceki sürüme dönülüyor...' -ForegroundColor Yellow
  try {
    Stop-Api
    if (Test-Path (Join-Path $distBak 'index.html')) { Copy-Dist $distBak $dist }
    if (Test-Path (Join-Path $bak 'src')) { Copy-Server $bak $srv; Push-Location $srv; npm ci --omit=dev --no-audit --no-fund; Pop-Location }
    Start-Api
    if (Wait-Healthy) { Write-Host 'Önceki sürüm geri yüklendi ve çalışıyor.' -ForegroundColor Yellow } else { Write-Host 'Önceki sürüm de ayağa kalkmadı; elle müdahale gerekli.' -ForegroundColor Red }
  } catch { Write-Host "Geri dönüş de başarısız: $_" -ForegroundColor Red }
  exit 1
}
