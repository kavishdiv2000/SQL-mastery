<#
.SYNOPSIS
  Builds and starts the SQL Mastery workstation (MySQL + Adminer + learning app).
.EXAMPLE
  .\setup.ps1
#>
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
Initialize-EnvFile

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Wait-ForMySql) { Show-Urls }
