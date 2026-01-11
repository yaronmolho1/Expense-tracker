# Start dev server configured for integration tests
# Usage: .\scripts\dev-for-integration.ps1

Write-Host "Starting dev server for integration tests..." -ForegroundColor Cyan

# Navigate to project root
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

# Load .env file first
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^["'']|["'']$', ''
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "[OK] Loaded .env configuration" -ForegroundColor Green
}

# Override DATABASE_URL for integration tests
$env:DATABASE_URL = "postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_integration"
Write-Host "[OK] Using integration database: expense_tracker_integration" -ForegroundColor Green

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Yellow
Write-Host "Run 'npm run test:integration' in another terminal to test" -ForegroundColor Gray
Write-Host ""

npm run dev
