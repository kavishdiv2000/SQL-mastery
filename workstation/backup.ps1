<#
.SYNOPSIS
  Dumps shopdb and playground (with routines, triggers, views) to workstation/backups/.
.EXAMPLE
  .\backup.ps1
#>
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
$rootPw = Get-EnvValue 'MYSQL_ROOT_PASSWORD' 'rootpass'
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $script:WorkstationDir 'backups'
New-Item -ItemType Directory -Force $outDir | Out-Null

# Dump inside the container and copy the file out (avoids PowerShell re-encoding the output)
docker exec -e "MYSQL_PWD=$rootPw" sqlm-mysql sh -c 'mysqldump -uroot --routines --triggers --events --single-transaction --databases shopdb playground > /tmp/sqlm-backup.sql'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker cp sqlm-mysql:/tmp/sqlm-backup.sql (Join-Path $outDir "backup-$stamp.sql")
Write-Host "Backup written to backups\backup-$stamp.sql" -ForegroundColor Green
Write-Host "Restore with: .\restore.ps1 -File backups\backup-$stamp.sql"
