# Shared helpers for the PowerShell workstation scripts (dot-sourced).
# 'Continue' (not 'Stop'): Windows PowerShell 5.1 turns redirected stderr from
# native tools like docker into terminating errors under 'Stop'.
$ErrorActionPreference = 'Continue'
$script:WorkstationDir = Split-Path -Parent $PSScriptRoot
Set-Location $script:WorkstationDir

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host 'Docker was not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/' -ForegroundColor Red
        exit 1
    }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Docker is installed but not running. Start Docker Desktop and try again.' -ForegroundColor Red
        exit 1
    }
}

function Initialize-EnvFile {
    if (-not (Test-Path (Join-Path $script:WorkstationDir '.env'))) {
        Copy-Item (Join-Path $script:WorkstationDir '.env.example') (Join-Path $script:WorkstationDir '.env')
        Write-Host 'Created .env from .env.example'
    }
}

function Get-EnvValue([string]$Name, [string]$Default) {
    $file = Join-Path $script:WorkstationDir '.env'
    if (Test-Path $file) {
        foreach ($line in Get-Content $file) {
            if ($line -match "^\s*$Name\s*=\s*(.*)$") { return $Matches[1].Trim() }
        }
    }
    return $Default
}

function Wait-ForMySql([int]$TimeoutMinutes = 6) {
    Write-Host 'Waiting for MySQL to become healthy (the first start seeds ~210k rows and takes 1-3 minutes)' -NoNewline
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    do {
        Start-Sleep -Seconds 3
        Write-Host '.' -NoNewline
        $status = docker inspect -f '{{.State.Health.Status}}' sqlm-mysql 2>$null
    } until ($status -eq 'healthy' -or (Get-Date) -gt $deadline)
    Write-Host ''
    if ($status -ne 'healthy') {
        Write-Host "MySQL is not healthy yet (status: $status). Check the logs with: docker logs sqlm-mysql" -ForegroundColor Yellow
        return $false
    }
    return $true
}

function Show-Urls {
    $app     = Get-EnvValue 'APP_PORT' '3000'
    $adminer = Get-EnvValue 'ADMINER_PORT' '8081'
    $mysql   = Get-EnvValue 'MYSQL_PORT' '3306'
    $pw      = Get-EnvValue 'MYSQL_PASSWORD' 'learnerpass'
    Write-Host ''
    Write-Host 'SQL Mastery workstation is ready' -ForegroundColor Green
    Write-Host "  Learning app : http://localhost:$app"
    Write-Host "  Adminer GUI  : http://localhost:$adminer   (server: mysql, user: learner, password: $pw)"
    Write-Host "  MySQL        : localhost:$mysql            (user: learner, password: $pw, database: shopdb)"
    Write-Host ''
}
