<#
.SYNOPSIS
  Wipes the MySQL data volume and re-seeds everything from mysql/init/*.sql.
  (For a quicker reset of just the practice data, use "Reset database" in the app.)
.PARAMETER Force
  Skip the confirmation prompt.
#>
param([switch]$Force)
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
if (-not $Force) {
    $answer = Read-Host 'This deletes ALL data in the workstation database (including your own tables). Type YES to continue'
    if ($answer -ne 'YES') { Write-Host 'Cancelled.'; exit 0 }
}

Initialize-EnvFile
docker compose down -v
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (Wait-ForMySql) { Show-Urls }
