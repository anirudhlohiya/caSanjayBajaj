# Build production bundles locally and release them on the EC2/Lightsail host.
#
# Purpose: identical release to .github/workflows/deploy.yml (CI), driven from a
# Windows dev box. Both paths ship a single /tmp/frontend.tar.gz and then run the
# SAME server script:  deploy/release-on-server.sh
#
# Usage (from repo root or anywhere):
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN>
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN> -SkipBackend
#   powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN> -FrontendsOnly
#
# Requires: OpenSSH client, git, and the repo pushed to origin/main when the
# backend is being deployed. Server must be bootstrapped first
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

Write-Host '== Packaging single frontend bundle (site/ + admin/) ==' -ForegroundColor Cyan
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$tmpDir = Join-Path $env:TEMP "ca-deploy-$stamp"
$outDir = Join-Path $tmpDir 'out'
New-Item -ItemType Directory -Path "$outDir\site", "$outDir\admin" -Force | Out-Null
Copy-Item -Recurse -Force "$root\client\dist\client\browser\*" "$outDir\site\"
Copy-Item -Recurse -Force "$root\admin\dist\admin\browser\*"  "$outDir\admin\"
tar -czf "$tmpDir\frontend.tar.gz" -C $outDir .

Write-Host "== Uploading bundle to $Server ==" -ForegroundColor Cyan
$keyPath = "F:\Anirudh\ca-platform-key.pem"
$keyArgs = @()
if (Test-Path $keyPath) { $keyArgs = @('-i', $keyPath) }
scp -o StrictHostKeyChecking=no @keyArgs "$tmpDir\frontend.tar.gz" "${Server}:/tmp/frontend.tar.gz"

$skip = if ($SkipBackend -or $FrontendsOnly) { '1' } else { '0' }
Write-Host '== Running release-on-server.sh on the server ==' -ForegroundColor Cyan
$release = "cd /opt/ca-app/repo; git fetch origin; SKIP_BACKEND=$skip bash deploy/release-on-server.sh"
$release | ssh -o StrictHostKeyChecking=no @keyArgs $Server 'bash -s'

Remove-Item -Recurse -Force $tmpDir
Write-Host 'Deploy complete.' -ForegroundColor Green