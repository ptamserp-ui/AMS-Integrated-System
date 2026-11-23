<#
.SYNOPSIS
  Read-only preflight dan post-deploy verification untuk Windows Server VPS bersama (C:\Apps\AMS).
.DESCRIPTION
  Memeriksa direktori, .env.staging, Caddyfile bersama (tanpa memodifikasi/merestart Caddy),
  status service AMS_AppService, serta kesehatan endpoint lokal dan domain publik.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-windows-vps.ps1
#>

[CmdletBinding()]
param(
  [string]$AppDir = "C:\Apps\AMS",
  [string]$DataDir = "C:\AMS\Data",
  [string]$CaddyfilePath = "C:\caddy\Caddyfile",
  [string]$Domain = "ams.bejodigitalprint.com",
  [int]$Port = 3100
)

$ErrorActionPreference = "Stop"

Write-Host "[AMS Verify] Memeriksa struktur file & service VPS bersama..." -ForegroundColor Cyan

$requiredPaths = @(
  (Join-Path $AppDir "deploy.ps1"),
  (Join-Path $AppDir ".env.staging"),
  $CaddyfilePath,
  $DataDir
)

foreach ($p in $requiredPaths) {
  if (-not (Test-Path -LiteralPath $p)) {
    throw "Path wajib tidak ditemukan: $p"
  }
  Write-Host "  OK  Path ada: $p" -ForegroundColor Green
}

$hasDomain = Select-String -Path $CaddyfilePath -Pattern ([regex]::Escape($Domain)) -Quiet
$hasUpstream = Select-String -Path $CaddyfilePath -Pattern ([regex]::Escape("127.0.0.1:$Port")) -Quiet
if (-not $hasDomain -or -not $hasUpstream) {
  throw "Caddyfile bersama ($CaddyfilePath) tidak memuat route '$Domain' -> '127.0.0.1:$Port'. Hentikan deploy dan periksa administrator Caddy."
}
Write-Host "  OK  Caddyfile memuat $Domain -> 127.0.0.1:$Port (read-only verified)" -ForegroundColor Green

$svc = Get-Service -Name "AMS_AppService" -ErrorAction SilentlyContinue
if (-not $svc) {
  throw "Service Windows 'AMS_AppService' tidak terdaftar."
}
Write-Host "  OK  AMS_AppService status: $($svc.Status)" -ForegroundColor Green

if ($svc.Status -eq "Running") {
  $localHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 15
  $localDb = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/system/db-config" -TimeoutSec 15
  Write-Host "  OK  Local /api/health: status=$($localHealth.status), env=$($localHealth.deploymentEnv)" -ForegroundColor Green
  Write-Host "  OK  Local /api/system/db-config: driver=$($localDb.activeDriver), project=$($localDb.firebase.projectId), db=$($localDb.firebaseAdmin.databaseId), adminConnected=$($localDb.firebaseAdmin.connected)" -ForegroundColor Green

  try {
    $pubHealth = Invoke-RestMethod -Uri "https://$Domain/api/health" -TimeoutSec 15
    Write-Host "  OK  Public https://$Domain/api/health: status=$($pubHealth.status)" -ForegroundColor Green
  } catch {
    Write-Warning "Endpoint publik https://$Domain/api/health belum dapat diakses dari dalam VPS: $($_.Exception.Message)"
  }
}

Write-Host "`nPreflight & verifikasi VPS Windows selesai." -ForegroundColor Cyan
