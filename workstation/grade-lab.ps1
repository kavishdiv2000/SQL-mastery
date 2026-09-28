<#
.SYNOPSIS
  Auto-grades your lab answer sheet (lab/answer-sheet.sql) against the live database.
.PARAMETER File
  Answer file name inside the lab folder (default: answer-sheet.sql).
.EXAMPLE
  .\grade-lab.ps1
  .\grade-lab.ps1 -File my-attempt-2.sql
#>
param([string]$File = 'answer-sheet.sql')
. (Join-Path $PSScriptRoot 'scripts\lib.ps1')

Assert-Docker
docker exec sqlm-app node scripts/grade-lab.js "/content/lab/$File"
