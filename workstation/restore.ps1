<#
.SYNOPSIS
  Restores a .sql dump (e.g. one made by backup.ps1) into the workstation MySQL.
.EXAMPLE
  .\restore.ps1 -File backups\backup-20260101-120000.sql
#>
param([Parameter(Mandatory = $true)][string]$File)
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
$path = Resolve-Path $File
$rootPw = Get-EnvValue 'MYSQL_ROOT_PASSWORD' 'rootpass'
docker cp $path sqlm-mysql:/tmp/sqlm-restore.sql
docker exec -e "MYSQL_PWD=$rootPw" sqlm-mysql sh -c 'mysql -uroot < /tmp/sqlm-restore.sql'
if ($LASTEXITCODE -eq 0) { Write-Host "Restored $File" -ForegroundColor Green }
