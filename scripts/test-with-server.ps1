# Run integration tests with environment variables from .env
# Usage: .\scripts\test-with-server.ps1

Write-Host "Running integration tests with .env configuration..." -ForegroundColor Cyan

# Navigate to project root
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with JWT_SECRET and other variables" -ForegroundColor Yellow
    exit 1
}

# Load .env file and export variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''
        Set-Item -Path "env:$key" -Value $value
        Write-Host "Loaded: $key" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Running integration tests..." -ForegroundColor Green
npm run test:integration

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Integration tests passed!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] Integration tests failed" -ForegroundColor Red
    exit 1
}
