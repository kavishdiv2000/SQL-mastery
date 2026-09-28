<#
.SYNOPSIS
  Opens the mysql command-line client inside the container.
.PARAMETER Root
  Connect as root instead of learner (needed for some admin experiments).
.PARAMETER Database
  Database to connect to (default: shopdb).
.EXAMPLE
  .\mysql-cli.ps1
  .\mysql-cli.ps1 -Database playground
  .\mysql-cli.ps1 -Root
#>
param([switch]$Root, [string]$Database = 'shopdb')
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
if ($Root) {
    $user = 'root'; $pw = Get-EnvValue 'MYSQL_ROOT_PASSWORD' 'rootpass'
} else {
    $user = 'learner'; $pw = Get-EnvValue 'MYSQL_PASSWORD' 'learnerpass'
}
docker exec -it -e "MYSQL_PWD=$pw" sqlm-mysql mysql "-u$user" --default-character-set=utf8mb4 $Database
