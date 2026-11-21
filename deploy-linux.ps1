<#
.SYNOPSIS
  Deploy AMS to a pre-provisioned Linux VPS over SSH.
.DESCRIPTION
  Fast-forward updates a clean remote checkout, runs checks and a production/staging build,
  restarts only the selected AMS systemd unit, and verifies local and public health endpoints.
  It does not provision Linux, edit Nginx/firewall settings, or transfer environment secrets.
.EXAMPLE
  .\deploy-linux.ps1 -SshHost "staging.example.com" -SshUser "amsdeploy" `
    -Domain "staging.example.com" -DeploymentEnv staging `
    -ExpectedFirebaseProjectId "ams-integrated-staging" `
    -ExpectedFirestoreDatabaseId "(default)" -ServiceName "ams-staging"
.EXAMPLE
  .\deploy-linux.ps1 -SshHost "staging.example.com" -SshUser "amsdeploy" `
    -Domain "staging.example.com" -DeploymentEnv staging `
    -ExpectedFirebaseProjectId "ams-integrated-staging" `
    -ExpectedFirestoreDatabaseId "(default)" -WhatIf
#>

#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory)]
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9.-]*$')]
  [string]$SshHost,

  [Parameter(Mandatory)]
  [ValidatePattern('^(?!root$)[A-Za-z_][A-Za-z0-9_.-]*$')]
  [string]$SshUser,

  [Parameter(Mandatory)]
  [ValidatePattern('^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$')]
  [string]$Domain,

  [Parameter(Mandatory)]
  [ValidateSet("staging", "production")]
  [string]$DeploymentEnv,

  [Parameter(Mandatory)]
  [ValidatePattern('^[A-Za-z0-9-]+$')]
  [string]$ExpectedFirebaseProjectId,

  [Parameter(Mandatory)]
  [ValidatePattern('^[A-Za-z0-9._()-]+$')]
  [string]$ExpectedFirestoreDatabaseId,

  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._/-]*$')]
  [string]$Branch = "main",

  [ValidatePattern('^[A-Za-z0-9_.-]+$')]
  [string]$Remote = "origin",

  [ValidatePattern('^/opt/ams/app$')]
  [string]$AppDir = "/opt/ams/app",

  [ValidatePattern('^ams$')]
  [string]$AppUser = "ams",

  [ValidatePattern('^ams(?:-[A-Za-z0-9_.-]+)?(?:\.service)?$')]
  [string]$ServiceName = "ams",

  [ValidateRange(1, 65535)]
  [int]$SshPort = 22,

  [ValidateRange(1024, 65535)]
  [int]$AppPort = 3000,

  [string]$IdentityFile
)

$ErrorActionPreference = "Stop"
$DeploymentEnv = $DeploymentEnv.ToLowerInvariant()

function ConvertTo-BashSingleQuoted([string]$Value) {
  return "'" + $Value + "'"
}

$ssh = Get-Command "ssh.exe" -ErrorAction SilentlyContinue
if (-not $ssh) {
  $ssh = Get-Command "ssh" -ErrorAction SilentlyContinue
}
if (-not $ssh) {
  throw "OpenSSH client 'ssh' tidak ditemukan. Aktifkan/instal OpenSSH Client di Windows."
}

if ($IdentityFile) {
  if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
    throw "File SSH identity tidak ditemukan: $IdentityFile"
  }
  $IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
}

$remoteTarget = "$SshUser@$SshHost"
$remoteScriptTemplate = @'
#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=__APP_DIR__
APP_USER=__APP_USER__
SERVICE_NAME=__SERVICE_NAME__
REMOTE_NAME=__REMOTE_NAME__
BRANCH=__BRANCH__
DEPLOYMENT_ENV=__DEPLOYMENT_ENV__
APP_PORT=__APP_PORT__
EXPECTED_PROJECT_ID=__EXPECTED_PROJECT_ID__
EXPECTED_DATABASE_ID=__EXPECTED_DATABASE_ID__

for command_name in sudo git node npm curl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Required command is missing: $command_name" >&2
    exit 1
  }
done

sudo -n systemctl cat "$SERVICE_NAME" >/dev/null
service_user="$(sudo -n systemctl show "$SERVICE_NAME" --property=User --value)"
if [[ "$service_user" != "$APP_USER" ]]; then
  echo "Service $SERVICE_NAME runs as $service_user, expected $APP_USER." >&2
  exit 1
fi

sudo -n -u "$APP_USER" -- env \
  APP_DIR="$APP_DIR" \
  REMOTE_NAME="$REMOTE_NAME" \
  BRANCH="$BRANCH" \
  DEPLOYMENT_ENV="$DEPLOYMENT_ENV" \
  bash <<'APP_SCRIPT'
set -Eeuo pipefail

cd "$APP_DIR"
test -d .git || { echo "AppDir is not a Git checkout: $APP_DIR" >&2; exit 1; }
test -r ".env.$DEPLOYMENT_ENV" || {
  echo "Missing or unreadable environment file: .env.$DEPLOYMENT_ENV" >&2
  exit 1
}

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  echo "Node.js 22 or newer is required." >&2
  exit 1
}

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "Expected branch $BRANCH, found $current_branch; refusing deployment." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Remote checkout has local changes; refusing to overwrite them." >&2
  git status --short
  exit 1
fi

git fetch --prune "$REMOTE_NAME" "$BRANCH"
git pull --ff-only "$REMOTE_NAME" "$BRANCH"

npm ci
npm run lint
npm test -- --mode "$DEPLOYMENT_ENV"
npm run "build:$DEPLOYMENT_ENV"
APP_SCRIPT

loaded_state="$(sudo -n systemctl show "$SERVICE_NAME" --property=LoadState --value)"
if [[ "$loaded_state" != "loaded" ]]; then
  echo "Systemd unit is not loaded: $SERVICE_NAME" >&2
  exit 1
fi

echo "Restarting only systemd unit: $SERVICE_NAME"
sudo -n systemctl restart "$SERVICE_NAME"

health_ok=false
for attempt in $(seq 1 12); do
  health_json="$(curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null || true)"
  if [[ -n "$health_json" ]] && printf '%s' "$health_json" | \
    EXPECTED_DEPLOYMENT_ENV="$DEPLOYMENT_ENV" \
    EXPECTED_PROJECT_ID="$EXPECTED_PROJECT_ID" \
    node -e '
      let raw = "";
      process.stdin.on("data", (chunk) => raw += chunk);
      process.stdin.on("end", () => {
        try {
          const health = JSON.parse(raw);
          const valid = health.status === "aktif" &&
            health.deploymentEnv === process.env.EXPECTED_DEPLOYMENT_ENV &&
            health.firebaseProjectId === process.env.EXPECTED_PROJECT_ID &&
            health.firebaseVpsValidation?.readyForStableConnection === true;
          process.exit(valid ? 0 : 1);
        } catch {
          process.exit(1);
        }
      });
    '; then
    db_json="$(curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/api/system/db-config" 2>/dev/null || true)"
    if [[ -n "$db_json" ]] && printf '%s' "$db_json" | \
      EXPECTED_PROJECT_ID="$EXPECTED_PROJECT_ID" \
      EXPECTED_DATABASE_ID="$EXPECTED_DATABASE_ID" \
      node -e '
        let raw = "";
        process.stdin.on("data", (chunk) => raw += chunk);
        process.stdin.on("end", () => {
          try {
            const config = JSON.parse(raw);
            const client = config.firebase;
            const admin = config.firebaseAdmin;
            const valid = client?.projectId === process.env.EXPECTED_PROJECT_ID &&
              client?.firestoreDatabaseId === process.env.EXPECTED_DATABASE_ID &&
              admin?.projectId === process.env.EXPECTED_PROJECT_ID &&
              admin?.databaseId === process.env.EXPECTED_DATABASE_ID &&
              admin?.connected === true;
            process.exit(valid ? 0 : 1);
          } catch {
            process.exit(1);
          }
        });
      '; then
      health_ok=true
      break
    fi
  fi
  sleep 5
done

if [[ "$health_ok" != true ]]; then
  echo "Local health/Firebase validation failed after restarting $SERVICE_NAME." >&2
  sudo -n systemctl status "$SERVICE_NAME" --no-pager || true
  exit 1
fi

echo "Remote health OK: environment=$DEPLOYMENT_ENV, Firebase project=$EXPECTED_PROJECT_ID, database=$EXPECTED_DATABASE_ID"
'@

$replacements = @{
  "__APP_DIR__" = (ConvertTo-BashSingleQuoted $AppDir)
  "__APP_USER__" = (ConvertTo-BashSingleQuoted $AppUser)
  "__SERVICE_NAME__" = (ConvertTo-BashSingleQuoted $ServiceName)
  "__REMOTE_NAME__" = (ConvertTo-BashSingleQuoted $Remote)
  "__BRANCH__" = (ConvertTo-BashSingleQuoted $Branch)
  "__DEPLOYMENT_ENV__" = (ConvertTo-BashSingleQuoted $DeploymentEnv)
  "__APP_PORT__" = [string]$AppPort
  "__EXPECTED_PROJECT_ID__" = (ConvertTo-BashSingleQuoted $ExpectedFirebaseProjectId)
  "__EXPECTED_DATABASE_ID__" = (ConvertTo-BashSingleQuoted $ExpectedFirestoreDatabaseId)
}
foreach ($placeholder in $replacements.Keys) {
  $remoteScriptTemplate = $remoteScriptTemplate.Replace($placeholder, [string]$replacements[$placeholder])
}

$encodedRemoteScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScriptTemplate))
$remoteCommand = "printf '%s' '$encodedRemoteScript' | base64 --decode | bash"
$sshArguments = @(
  "-p", [string]$SshPort,
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "ConnectTimeout=15",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=3"
)
if ($IdentityFile) {
  $sshArguments += @("-i", $IdentityFile)
}

if (-not $PSCmdlet.ShouldProcess(
  "$remoteTarget ($AppDir)",
  "Fetch/build $DeploymentEnv and restart only systemd service '$ServiceName'"
)) {
  return
}

Write-Host "Deploying AMS to $remoteTarget ($DeploymentEnv)..." -ForegroundColor Cyan
& $ssh.Source @sshArguments $remoteTarget $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Remote Linux deployment failed with SSH exit code $LASTEXITCODE. Review the remote output; no other services were targeted."
}

$publicHealth = $null
for ($attempt = 1; $attempt -le 6; $attempt++) {
  try {
    $publicHealth = Invoke-RestMethod -Uri "https://$Domain/api/health" -TimeoutSec 15
    break
  } catch {
    if ($attempt -eq 6) { throw }
    Start-Sleep -Seconds 5
  }
}
if (
  -not $publicHealth -or
  $publicHealth.status -ne "aktif" -or
  $publicHealth.deploymentEnv -ne $DeploymentEnv -or
  $publicHealth.firebaseProjectId -ne $ExpectedFirebaseProjectId
) {
  throw "Public health check failed or returned an unexpected environment/Firebase project for https://$Domain."
}

Write-Host "Deploy OK: $Domain, env=$DeploymentEnv, Firebase=$ExpectedFirebaseProjectId." -ForegroundColor Green
