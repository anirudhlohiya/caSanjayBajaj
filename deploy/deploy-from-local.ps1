# Build production bundles locally and release them on the EC2 host.
#
# Usage (from repo root or anywhere):
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN>
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN> -SkipBackend
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN> -FrontendsOnly
#
# Requires: OpenSSH client (ssh/scp ship with Windows 10/11), git, and the repo pushed
# to origin/main when deploying the backend. Server must be bootstrapped first
# (see deploy/bootstrap-server.sh).
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [switch]$SkipBackend,
  [switch]$FrontendsOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host '== Building admin (production, base-href /admin/) ==' -ForegroundColor Cyan
Push-Location "$root\admin"
npx ng build --configuration production --base-href=/admin/
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'admin build failed' }
Pop-Location

Write-Host '== Building client PWA (production; also patches service worker) ==' -ForegroundColor Cyan
Push-Location "$root\client"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'client build failed' }
Pop-Location

Write-Host '== Packaging bundles ==' -ForegroundColor Cyan
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$tmpDir = Join-Path $env:TEMP "ca-deploy-$stamp"
New-Item -ItemType Directory -Path $tmpDir | Out-Null
tar -czf "$tmpDir\admin.tar.gz"  -C "$root\admin\dist\admin\browser"  .
tar -czf "$tmpDir\client.tar.gz" -C "$root\client\dist\client\browser" .

Write-Host "== Uploading bundles to $Server ==" -ForegroundColor Cyan
$keyPath = "F:\Anirudh\ca-platform-key.pem"
if (Test-Path $keyPath) {
  scp -o StrictHostKeyChecking=no -i $keyPath "$tmpDir\admin.tar.gz" "$tmpDir\client.tar.gz" "${Server}:/tmp/"
} else {
  scp -o StrictHostKeyChecking=no "$tmpDir\admin.tar.gz" "$tmpDir\client.tar.gz" "${Server}:/tmp/"
}

if (-not ($SkipBackend -or $FrontendsOnly)) {
  Write-Host '== Updating backend on server from origin/main ==' -ForegroundColor Cyan
  $backendUpdate = @'
set -euo pipefail
cd /opt/ca-app/backend
git fetch origin
git reset --hard origin/main
npm ci
npm run migration:run
npm run build
echo "backend build ok"
'@
  if (Test-Path $keyPath) {
    $backendUpdate | ssh -o StrictHostKeyChecking=no -i $keyPath $Server 'bash -s'
  } else {
    $backendUpdate | ssh -o StrictHostKeyChecking=no $Server 'bash -s'
  }
}

Write-Host '== Releasing static sites + restarting API ==' -ForegroundColor Cyan
$release = @'
set -euo pipefail
SITE=/opt/ca-app/frontend/site
REPO=/opt/ca-app/repo

# Extract OUTSIDE the web root: rsync --delete would otherwise treat a
# source dir nested inside the destination as extraneous and delete it
# mid-transfer (rsync exit 24).
INCOMING=/opt/ca-app/frontend/.incoming-client
rm -rf "$INCOMING"
mkdir -p "$INCOMING"
tar -xzf /tmp/client.tar.gz -C "$INCOMING"
mkdir -p "$SITE"
rsync -a --delete --exclude '/admin/' "$INCOMING/" "$SITE/"
rm -rf "$INCOMING"

ADMIN_INCOMING=/opt/ca-app/frontend/.incoming-admin
rm -rf "$ADMIN_INCOMING" "$SITE/admin.old"
mkdir -p "$ADMIN_INCOMING"
tar -xzf /tmp/admin.tar.gz -C "$ADMIN_INCOMING"
[ -d "$SITE/admin" ] && mv "$SITE/admin" "$SITE/admin.old"
mv "$ADMIN_INCOMING" "$SITE/admin"
rm -rf "$SITE/admin.old" /tmp/client.tar.gz /tmp/admin.tar.gz

sudo nginx -t
sudo systemctl reload nginx

pm2 startOrReload "$REPO/deploy/ecosystem.config.js"
pm2 save
sleep 3
curl -fsS http://127.0.0.1:3000/api/v1/health > /dev/null && echo "DEPLOY OK: health check passed"
'@
  if (Test-Path $keyPath) {
    $release | ssh -o StrictHostKeyChecking=no -i $keyPath $Server 'bash -s'
  } else {
    $release | ssh -o StrictHostKeyChecking=no $Server 'bash -s'
  }

Remove-Item -Recurse -Force $tmpDir
Write-Host 'Deploy complete.' -ForegroundColor Green
