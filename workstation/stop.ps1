<#
.SYNOPSIS
  Stops the workstation. Your data is kept.
.PARAMETER Remove
  Also removes the containers (data volume is still kept; use reset.ps1 to wipe it).
#>
param([switch]$Remove)
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
if ($Remove) { docker compose down } else { docker compose stop }
