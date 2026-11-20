<#
.SYNOPSIS
  Update, build, and deploy AMS Integrated System with an explicit Firebase environment.
.DESCRIPTION
  Pulls the configured Git branch (fast-forward only), validates the selected environment file, runs checks and build,
  updates the NSSM app/Caddy services, optionally configures firewall rules, then checks health.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -Domain "ams.bejodigitalprint.com"
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DeploymentEnv production -EnvFileName .env.production
#>

[CmdletBinding()]
param(
  [string]$Domain = "ams.bejodigitalprint.com",
  [string]$AppDir = "",
  [string]$DataDir = "C:\AMS\Data",
  [string]$SecretsDir = "C:\AMS\Secrets",
  [string]$LogsDir = "C:\AMS\Logs",
  [string]$BackupDir = "C:\AMS\Backups",
  [string]$CaddyDir = "C:\caddy",
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [ValidateSet("staging", "production")]
  [string]$DeploymentEnv = "staging",
  [string]$EnvFileName = "",
  [int]$Port = 3000,
  [switch]$SkipGitUpdate,
  [switch]$SkipTests,
  [switch]$ConfigureFirewall,
  [switch]$BlockPocketBasePort,
  [switch]$SkipServiceRestart
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
  Write-Host "`n[AMS Windows $DeploymentEnv] $msg" -ForegroundColor Cyan
}

function Assert-Command([string]$cmd, [string]$installHint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Perintah '$cmd' tidak ditemukan. $installHint"
  }
}

function Invoke-CheckedCommand([string]$cmd, [string[]]$arguments) {
  & $cmd @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Perintah '$cmd $($arguments -join ' ')' gagal dengan exit code $LASTEXITCODE."
  }
}

function Resolve-NssmPath([string]$serviceName) {
  $command = Get-Command "nssm.exe" -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $serviceKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
  if (Test-Path $serviceKey) {
    $imagePath = [string](Get-ItemProperty -LiteralPath $serviceKey).ImagePath
    $candidate = $null
    if ($imagePath -match '^\s*"([^"]*nssm\.exe)"') {
      $candidate = $Matches[1]
    } elseif ($imagePath -match '^\s*(.*?nssm\.exe)(?:\s|$)') {
      $candidate = $Matches[1].Trim('"')
    }
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "nssm.exe tidak ditemukan di PATH maupun dari konfigurasi service '$serviceName'."
}

if ([string]::IsNullOrWhiteSpace($AppDir)) {
  $AppDir = $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($EnvFileName)) {
  $EnvFileName = ".env.$DeploymentEnv"
}
if (-not (Test-Path $AppDir -PathType Container)) {
  throw "Direktori aplikasi tidak ditemukan: $AppDir"
}
$AppDir = (Resolve-Path $AppDir).Path

Write-Step "1. Memeriksa prasyarat sistem & versi Node.js..."
Assert-Command "node" "Pasang Node.js v22 LTS dari https://nodejs.org/"
Assert-Command "npm" "Pastikan npm ikut terpasang bersama Node.js v22 LTS."
if (-not $SkipGitUpdate) {
  Assert-Command "git" "Pasang Git for Windows dan pastikan tersedia di PATH."
}

$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) {
  throw "Node.js minimal versi 22 diperlukan. Versi aktif saat ini: $(node -v)"
}
Write-Host "Node.js aktif: $(node -v)" -ForegroundColor Green

if (-not $SkipGitUpdate) {
  Write-Step "2. Memperbarui source dari $Remote/$Branch secara fast-forward..."
  $branchAktif = (& git -C $AppDir branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $branchAktif) {
    throw "Direktori '$AppDir' bukan working tree Git dengan branch aktif."
  }
  if ($branchAktif -ne $Branch) {
    throw "Branch aktif '$branchAktif' berbeda dari '$Branch'. Pindah branch secara eksplisit sebelum deploy."
  }
  & git -C $AppDir diff --quiet -- . ":(exclude)public/website-published.json"
  if ($LASTEXITCODE -ne 0) {
    throw "Ada perubahan tracked yang belum di-commit di '$AppDir'. Commit atau simpan perubahan sebelum deploy."
  }
  & git -C $AppDir diff --cached --quiet -- . ":(exclude)public/website-published.json"
  if ($LASTEXITCODE -ne 0) {
    throw "Ada perubahan staged yang belum di-commit di '$AppDir'. Commit atau simpan perubahan sebelum deploy."
  }
  $snapshotRelativePath = "public/website-published.json"
  $snapshotPath = Join-Path $AppDir $snapshotRelativePath
  $snapshotChanged = $false
  $snapshotWasPresent = Test-Path -LiteralPath $snapshotPath -PathType Leaf
  $snapshotBackupPath = $null
  & git -C $AppDir diff --quiet HEAD -- $snapshotRelativePath
  if ($LASTEXITCODE -gt 1) {
    throw "Gagal memeriksa perubahan snapshot '$snapshotPath'."
  }
  $snapshotChanged = $LASTEXITCODE -eq 1
  if ($snapshotChanged) {
    if ($snapshotWasPresent) {
      New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
      $snapshotBackupPath = Join-Path $BackupDir (
        "website-published-before-deploy-{0}.json" -f [guid]::NewGuid().ToString("N")
      )
      Copy-Item -LiteralPath $snapshotPath -Destination $snapshotBackupPath
    }

    Invoke-CheckedCommand "git" @(
      "-C", $AppDir, "restore", "--source=HEAD", "--staged", "--worktree", "--", $snapshotRelativePath
    )
  }
  try {
    Invoke-CheckedCommand "git" @("-C", $AppDir, "fetch", "--prune", $Remote, $Branch)
    Invoke-CheckedCommand "git" @("-C", $AppDir, "pull", "--ff-only", $Remote, $Branch)
  } finally {
    if ($snapshotChanged) {
      if ($snapshotWasPresent) {
        Copy-Item -LiteralPath $snapshotBackupPath -Destination $snapshotPath -Force
        Write-Host "Snapshot lokal dipulihkan dari backup: $snapshotBackupPath" -ForegroundColor Yellow
      } elseif (Test-Path -LiteralPath $snapshotPath) {
        Remove-Item -LiteralPath $snapshotPath
      }
    }
  }
}

Write-Step "3. Menyiapkan direktori persisten Windows di luar folder source..."
$caddyLogs = Join-Path $CaddyDir "logs"
New-Item -ItemType Directory -Force -Path $AppDir, $DataDir, $SecretsDir, $LogsDir, $BackupDir, $CaddyDir, $caddyLogs | Out-Null

$envPath = Join-Path $AppDir $EnvFileName
$exampleEnvPath = Join-Path $AppDir ".env.$DeploymentEnv.example"
if (-not (Test-Path $envPath)) {
  if (Test-Path $exampleEnvPath) {
    Copy-Item $exampleEnvPath $envPath
    throw "File '$envPath' belum ada sehingga disalin dari '$exampleEnvPath'. Isi konfigurasi Firebase $DeploymentEnv dan rahasia server langsung di VPS, lalu jalankan ulang."
  } else {
    throw "File '$envPath' tidak ditemukan."
  }
}

Write-Step "4. Memvalidasi konfigurasi Firebase $DeploymentEnv dari $EnvFileName..."
$envMap = @{}
Get-Content $envPath -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eqIdx = $line.IndexOf("=")
  if ($eqIdx -lt 1) { return }
  $key = $line.Substring(0, $eqIdx).Trim()
  $val = $line.Substring($eqIdx + 1).Trim().Trim('"').Trim("'")
  $envMap[$key] = $val
}

$requiredKeys = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_EXPECTED_PROJECT_ID",
  "VITE_FIREBASE_ADMIN_EMAIL",
  "VITE_FIRESTORE_DATABASE_ID",
  "DEPLOYMENT_ENV",
  "VITE_DEPLOYMENT_ENV",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_EXPECTED_PROJECT_ID",
  "FIRESTORE_DATABASE_ID",
  "FIREBASE_FIRESTORE_DATABASE_ID",
  "FIRESTORE_EXPECTED_DATABASE_ID",
  "FIREBASE_SERVICE_ACCOUNT_PATH",
  "FIREBASE_ADMIN_EMAILS",
  "SESSION_SECRET"
)

foreach ($rk in $requiredKeys) {
  $val = $envMap[$rk]
  if ([string]::IsNullOrWhiteSpace($val) -or $val -like "GANTI_*") {
    throw "Variabel '$rk' di '$envPath' belum diisi dengan nilai Firebase $DeploymentEnv yang valid."
  }
}

$expectedProjectId = if ($DeploymentEnv -eq "production") { "ams-integrated-system" } else { "ams-integrated-staging" }
foreach ($projectKey in @("VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_EXPECTED_PROJECT_ID", "FIREBASE_PROJECT_ID", "FIREBASE_EXPECTED_PROJECT_ID")) {
  if ($envMap[$projectKey] -ne $expectedProjectId) {
    throw "Variabel '$projectKey' harus bernilai '$expectedProjectId' untuk DEPLOYMENT_ENV=$DeploymentEnv."
  }
}
foreach ($databaseKey in @("VITE_FIRESTORE_DATABASE_ID", "FIRESTORE_DATABASE_ID", "FIREBASE_FIRESTORE_DATABASE_ID", "FIRESTORE_EXPECTED_DATABASE_ID")) {
  if ($envMap[$databaseKey] -ne $envMap["FIRESTORE_DATABASE_ID"]) {
    throw "Variabel '$databaseKey' harus sama dengan FIRESTORE_DATABASE_ID pada $envPath."
  }
}
if ($envMap["DEPLOYMENT_ENV"] -ne $DeploymentEnv -or $envMap["VITE_DEPLOYMENT_ENV"] -ne $DeploymentEnv) {
  throw "DEPLOYMENT_ENV dan VITE_DEPLOYMENT_ENV di '$envPath' harus sama dengan '$DeploymentEnv'."
}
if ($envMap["VITE_FIREBASE_ADMIN_EMAIL"] -notmatch "(?i)(^|,)\s*ptams\.erp@gmail\.com\s*(,|$)" -or
    $envMap["FIREBASE_ADMIN_EMAILS"] -notmatch "(?i)(^|,)\s*ptams\.erp@gmail\.com\s*(,|$)") {
  throw "VITE_FIREBASE_ADMIN_EMAIL dan FIREBASE_ADMIN_EMAILS harus mengizinkan ptams.erp@gmail.com."
}
if ([string]::IsNullOrWhiteSpace($envMap["FIREBASE_SERVICE_ACCOUNT_PATH"]) -or
    -not (Test-Path -LiteralPath $envMap["FIREBASE_SERVICE_ACCOUNT_PATH"] -PathType Leaf)) {
  throw "Service Account Firebase $DeploymentEnv harus tersedia di FIREBASE_SERVICE_ACCOUNT_PATH."
}
try {
  $serviceAccount = Get-Content -LiteralPath $envMap["FIREBASE_SERVICE_ACCOUNT_PATH"] -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  throw "File Service Account Firebase $DeploymentEnv tidak valid: $($envMap["FIREBASE_SERVICE_ACCOUNT_PATH"])"
}
if ($serviceAccount.project_id -ne $expectedProjectId) {
  throw "Service Account harus berasal dari proyek '$expectedProjectId'; file saat ini menargetkan '$($serviceAccount.project_id)'."
}

foreach ($clientConfigKey in ($requiredKeys | Where-Object { $_ -like "VITE_*" })) {
  [Environment]::SetEnvironmentVariable($clientConfigKey, $envMap[$clientConfigKey], "Process")
}

[Environment]::SetEnvironmentVariable("DEPLOYMENT_ENV", $DeploymentEnv, "Process")
[Environment]::SetEnvironmentVariable("VITE_DEPLOYMENT_ENV", $DeploymentEnv, "Process")
[Environment]::SetEnvironmentVariable("FIREBASE_PROJECT_ID", $envMap["FIREBASE_PROJECT_ID"], "Process")
[Environment]::SetEnvironmentVariable("FIREBASE_EXPECTED_PROJECT_ID", $expectedProjectId, "Process")
[Environment]::SetEnvironmentVariable("FIRESTORE_DATABASE_ID", $envMap["FIRESTORE_DATABASE_ID"], "Process")
[Environment]::SetEnvironmentVariable("FIREBASE_FIRESTORE_DATABASE_ID", $envMap["FIREBASE_FIRESTORE_DATABASE_ID"], "Process")
[Environment]::SetEnvironmentVariable("FIRESTORE_EXPECTED_DATABASE_ID", $envMap["FIRESTORE_EXPECTED_DATABASE_ID"], "Process")
[Environment]::SetEnvironmentVariable("AMS_DB_DRIVER", "firebase", "Process")
[Environment]::SetEnvironmentVariable("AMS_DATA_DIR", $DataDir, "Process")

$svcName = "AMS_AppService"
$caddyServiceName = if (Get-Service -Name "Caddy" -ErrorAction SilentlyContinue) { "Caddy" } else { "CaddyWebServer" }
$nssmExe = if (-not $SkipServiceRestart) { Resolve-NssmPath $svcName } else { $null }
$appService = if (-not $SkipServiceRestart) { Get-Service -Name $svcName -ErrorAction SilentlyContinue } else { $null }
$appServiceWasRunning = $appService -and $appService.Status -eq "Running"
$buildSucceeded = $false
$locationPushed = $false

Write-Step "5. Menginstal dependensi, menjalankan pemeriksaan, dan membangun aplikasi..."
try {
  if ($appServiceWasRunning) {
    Write-Host "Menghentikan $svcName sementara agar npm ci dapat memperbarui dependensi..." -ForegroundColor Yellow
    Stop-Service -Name $svcName -Force
    $appService.WaitForStatus(
      [System.ServiceProcess.ServiceControllerStatus]::Stopped,
      [TimeSpan]::FromSeconds(30)
    )
  }
  Push-Location $AppDir
  $locationPushed = $true
  Invoke-CheckedCommand "npm" @("ci", "--include=dev")
  if (-not $SkipTests) {
    Invoke-CheckedCommand "npm" @("run", "lint")
    Invoke-CheckedCommand "npm" @("test", "--", "--mode", $DeploymentEnv)
  }
  Invoke-CheckedCommand "npm" @("run", "build:$DeploymentEnv")
  $buildSucceeded = $true
} finally {
  if ($locationPushed) {
    Pop-Location
  }
  if (-not $buildSucceeded -and $appServiceWasRunning) {
    try {
      $currentAppService = Get-Service -Name $svcName
      if ($currentAppService.Status -ne "Running") {
        Start-Service -Name $svcName
        $currentAppService.WaitForStatus(
          [System.ServiceProcess.ServiceControllerStatus]::Running,
          [TimeSpan]::FromSeconds(30)
        )
      }
    } catch {
      Write-Warning "Deploy gagal dan service '$svcName' tidak berhasil dinyalakan kembali: $($_.Exception.Message)"
    }
  }
}

if ($ConfigureFirewall) {
  Write-Step "6. Mengonfigurasi Windows Defender Firewall (buka 80/443, blokir akses langsung ke $Port/8091)..."
  $rulesToEnsure = @(
    @{ Name = "AMS-HTTP-80"; Port = 80; Action = "Allow" },
    @{ Name = "AMS-HTTPS-443"; Port = 443; Action = "Allow" },
    @{ Name = "AMS-Block-Direct-Node-$Port"; Port = $Port; Action = "Block" }
  )
  # Port 8091 hanya diblokir bila diminta eksplisit; aplikasi lain di VPS ini
  # (mis. Bejo Stiker POS) mungkin memakai port tersebut.
  if ($BlockPocketBasePort) {
    $rulesToEnsure += @{ Name = "AMS-Block-Direct-PocketBase-8091"; Port = 8091; Action = "Block" }
  }
  foreach ($rule in $rulesToEnsure) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) { Remove-NetFirewallRule -DisplayName $rule.Name }
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action $rule.Action | Out-Null
  }
}

$caddyfilePath = Join-Path $CaddyDir "Caddyfile"
$caddyfileChanged = $false
if (-not (Test-Path $caddyfilePath)) {
  Write-Step "Menulis Caddyfile awal ke $caddyfilePath..."
  $caddyContent = @"
# Caddyfile AMS Integrated System (Firebase $DeploymentEnv - Windows Server VPS)
$Domain {
    encode gzip zstd

    reverse_proxy 127.0.0.1:$Port {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    log {
        output file $CaddyDir\logs\ams_access.log {
            roll_size 20mb
            roll_keep 10
        }
    }
}
"@
  Set-Content -Path $caddyfilePath -Value $caddyContent -Encoding UTF8
  $caddyfileChanged = $true
}

if (-not $SkipServiceRestart) {
  Write-Step "7. Mengatur service Windows via NSSM (1 instance tunggal)..."
  $nodeExe = (Get-Command node).Source
  $serverJs = Join-Path $AppDir "server.js"

  $svcExists = Get-Service -Name $svcName -ErrorAction SilentlyContinue
  if (-not $svcExists) {
    Invoke-CheckedCommand $nssmExe @("install", $svcName, $nodeExe, $serverJs)
  } else {
    Invoke-CheckedCommand $nssmExe @("set", $svcName, "Application", $nodeExe)
    Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppParameters", $serverJs)
  }
  $firestoreDbId = $envMap["FIRESTORE_DATABASE_ID"]
  $defaultSaPath = Join-Path $SecretsDir "firebase-service-account.json"
  $saPath = if ($envMap["FIREBASE_SERVICE_ACCOUNT_PATH"]) { $envMap["FIREBASE_SERVICE_ACCOUNT_PATH"] } else { $defaultSaPath }
  if (-not (Test-Path $saPath) -and -not $envMap["FIREBASE_SERVICE_ACCOUNT_JSON"]) {
    Write-Host "Peringatan: File Service Account Admin SDK belum ditemukan di '$saPath'. Server akan berjalan pada mode fallback hingga file JSON diletakkan." -ForegroundColor Yellow
  }

  $serviceEnvironment = @(
    "NODE_ENV=production",
    "DEPLOYMENT_ENV=$DeploymentEnv",
    "VITE_DEPLOYMENT_ENV=$DeploymentEnv",
    "AMS_DB_DRIVER=firebase",
    "PORT=$Port",
    "APP_URL=https://$Domain",
    "AMS_DATA_DIR=$DataDir",
    "FIREBASE_PROJECT_ID=$expectedProjectId",
    "FIREBASE_EXPECTED_PROJECT_ID=$expectedProjectId",
    "VITE_FIREBASE_PROJECT_ID=$expectedProjectId",
    "VITE_FIREBASE_EXPECTED_PROJECT_ID=$expectedProjectId",
    "VITE_FIRESTORE_DATABASE_ID=$firestoreDbId",
    "FIRESTORE_DATABASE_ID=$firestoreDbId",
    "FIREBASE_FIRESTORE_DATABASE_ID=$firestoreDbId",
    "FIRESTORE_EXPECTED_DATABASE_ID=$firestoreDbId",
    "FIREBASE_SERVICE_ACCOUNT_PATH=$saPath"
  )
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppDirectory", $AppDir)
  Invoke-CheckedCommand $nssmExe (@("set", $svcName, "AppEnvironmentExtra") + $serviceEnvironment)
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppStdout", (Join-Path $LogsDir "service_output.log"))
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppStderr", (Join-Path $LogsDir "service_error.log"))
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppRotateFiles", "1")
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "AppRotateBytes", "10485760")
  Invoke-CheckedCommand $nssmExe @("set", $svcName, "Start", "SERVICE_AUTO_START")

  $caddyExe = Join-Path $CaddyDir "caddy.exe"
  if (Test-Path $caddyExe) {
    $caddySvc = Get-Service -Name $caddyServiceName -ErrorAction SilentlyContinue
    if (-not $caddySvc) {
      Invoke-CheckedCommand $nssmExe @("install", $caddyServiceName, $caddyExe, "run --config `"$caddyfilePath`"")
    }
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "Application", $caddyExe)
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "AppParameters", "run --config `"$caddyfilePath`"")
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "AppDirectory", $CaddyDir)
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "AppStdout", (Join-Path $caddyLogs "caddy_stdout.log"))
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "AppStderr", (Join-Path $caddyLogs "caddy_stderr.log"))
    Invoke-CheckedCommand $nssmExe @("set", $caddyServiceName, "Start", "SERVICE_AUTO_START")
  } else {
    Write-Host "Catatan: $caddyExe belum ditemukan; lewati registrasi CaddyWebServer." -ForegroundColor Yellow
  }

  # Hanya AMS_AppService yang di-restart penuh. Caddy dipakai bersama aplikasi
  # lain di VPS ini (mis. Bejo Stiker POS), jadi jangan di-stop/start sembarangan:
  # reload graceful bila konfigurasi berubah, biarkan bila tidak.
  $appSvc = Get-Service -Name "AMS_AppService" -ErrorAction SilentlyContinue
  if ($appSvc -and $appSvc.Status -eq "Running") {
    Stop-Service -Name "AMS_AppService" -Force
    $appSvc.WaitForStatus(
      [System.ServiceProcess.ServiceControllerStatus]::Stopped,
      [TimeSpan]::FromSeconds(30)
    )
  }
  Start-Service -Name "AMS_AppService"

  if (Test-Path $caddyExe) {
    $caddySvc = Get-Service -Name $caddyServiceName -ErrorAction SilentlyContinue
    if ($caddySvc -and $caddySvc.Status -eq "Running") {
      if ($caddyfileChanged) {
        & $caddyExe reload --config $caddyfilePath
        if ($LASTEXITCODE -ne 0) {
          Write-Warning "caddy reload gagal (exit $LASTEXITCODE). Konfigurasi baru belum aktif; periksa Caddy secara manual tanpa me-restart service agar situs lain tidak terganggu."
        }
      } else {
        Write-Host "Caddy sudah berjalan dengan konfigurasi yang sama; tidak di-restart agar situs lain di VPS tidak terganggu." -ForegroundColor Green
      }
    } else {
      Start-Service -Name $caddyServiceName
    }
  }

  Write-Step "8. Memeriksa endpoint kesehatan lokal http://127.0.0.1:$Port/api/health..."
  $health = $null
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 15
      break
    } catch {
      if ($attempt -eq 12) { throw }
      Start-Sleep -Seconds 5
    }
  }
  if (-not $health -or $health.status -ne "aktif") {
    throw "Health check tidak mengembalikan status aktif."
  }
  if ($health.deploymentEnv -ne $DeploymentEnv -or $health.firebaseProjectId -ne $expectedProjectId) {
    throw "Runtime tidak sesuai target: env=$($health.deploymentEnv), Firebase=$($health.firebaseProjectId), target env=$DeploymentEnv / project=$expectedProjectId."
  }
  $dbCfg = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/system/db-config" -TimeoutSec 15
  if ($dbCfg.firebase.projectId -ne $expectedProjectId -or $dbCfg.firebase.firestoreDatabaseId -ne $firestoreDbId) {
    throw "Konfigurasi Firebase client tidak cocok dengan target proyek/database yang diminta."
  }
  if ($dbCfg.firebaseAdmin.projectId -ne $expectedProjectId -or $dbCfg.firebaseAdmin.databaseId -ne $firestoreDbId) {
    throw "Konfigurasi Firebase Admin tidak cocok dengan target proyek/database yang diminta."
  }
  if (-not $dbCfg.firebaseAdmin.connected) {
    throw "Koneksi Firebase Admin ke proyek/database target belum terverifikasi."
  }
  Write-Host "Health OK: status=$($health.status), env=$($health.deploymentEnv), firebaseProjectId=$($dbCfg.firebase.projectId), adminConnected=$($dbCfg.firebaseAdmin.connected), databaseId=$($dbCfg.firebaseAdmin.databaseId)" -ForegroundColor Green
}

Write-Host "`nDeployment Firebase $DeploymentEnv di Windows Server VPS selesai." -ForegroundColor Green
Write-Host "Jangan lupa tambahkan '$Domain' ke Firebase Console -> Authentication -> Settings -> Authorized domains!" -ForegroundColor Yellow
