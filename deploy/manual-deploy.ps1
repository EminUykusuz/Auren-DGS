$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $env:TEMP ('Auren-DGS-deploy-' + [Guid]::NewGuid().ToString('N'))
$gitPath = $null
$worktreeAdded = $false
$failure = $null

function Invoke-External {
  param(
    [string]$Path,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $Path @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$([IO.Path]::GetFileName($Path)) exited with code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

try {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'YAYINLA.bat dosyasini yonetici olarak calistirin.'
  }

  if (-not (Test-Path (Join-Path $repoRoot 'server\.env'))) {
    throw "Uretim ayarlari bulunamadi: $repoRoot\server\.env"
  }

  $gitPath = (Get-Command git.exe -ErrorAction Stop).Source
  $serverChanges = & $gitPath -C $repoRoot status --porcelain --untracked-files=all -- server
  if ($LASTEXITCODE -ne 0) { throw 'Git server klasorunun durumunu okuyamadi.' }
  if ($serverChanges) {
    throw "server klasorunde yerel degisiklik var; dosyalar ezilmesin diye yayin durduruldu:`n$($serverChanges -join "`n")"
  }

  $cachedNodeRoot = Join-Path $env:USERPROFILE 'actions-runner\_work\_tool\node'
  if (Test-Path $cachedNodeRoot) {
    $nodeDirectories = Get-ChildItem $cachedNodeRoot -Directory |
      Where-Object { $_.Name -match '^22\.\d+\.\d+$' } |
      Sort-Object { [version]$_.Name } -Descending

    foreach ($nodeDirectory in $nodeDirectories) {
      $candidate = Join-Path $nodeDirectory.FullName 'x64'
      if (Test-Path (Join-Path $candidate 'node.exe')) {
        $env:Path = "$candidate;$env:Path"
        break
      }
    }
  }

  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $nodeVersion = & $nodePath --version
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v22\.') {
    throw "Node.js 22 gerekli; bulunan surum: $nodeVersion"
  }
  $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  Write-Host "Node.js $nodeVersion kullaniliyor."

  Write-Host "`n==> GitHub main guncelleniyor"
  Invoke-External $gitPath @('-C', $repoRoot, 'fetch', 'origin', 'main') $repoRoot
  Invoke-External $gitPath @('-C', $repoRoot, 'worktree', 'add', '--detach', $stage, 'origin/main') $repoRoot
  $worktreeAdded = Test-Path $stage
  if (-not $worktreeAdded) { throw 'Gecici yayin kopyasi olusturulamadi.' }

  $stageClient = Join-Path $stage 'client'
  Write-Host "`n==> Arayuz bagimliliklari kuruluyor"
  Invoke-External $npmPath @('ci', '--no-audit', '--no-fund') $stageClient

  Write-Host "`n==> Arayuz derleniyor"
  Invoke-External $npmPath @('run', 'build', '--', '--outDir', '..\client-dist', '--emptyOutDir') $stageClient

  Write-Host "`n==> Sunucuya yayin yapiliyor"
  $deployScript = Join-Path $stage 'deploy\deploy.ps1'
  $arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -AppDir "{1}" -Port 5050' -f $deployScript, $repoRoot
  $deployProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Wait -PassThru -NoNewWindow
  if ($deployProcess.ExitCode -ne 0) { throw "deploy.ps1 basarisiz oldu (kod $($deployProcess.ExitCode))." }

  Write-Host "`nYayin basariyla tamamlandi: https://aurenstudy.com.tr"
} catch {
  $failure = $_
  Write-Host "`nHATA: $failure" -ForegroundColor Red
} finally {
  if ($worktreeAdded) {
    & $gitPath -C $repoRoot worktree remove --force $stage
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Gecici yayin kopyasi temizlenemedi: $stage"
    }
  }
}

if ($failure) { exit 1 }
