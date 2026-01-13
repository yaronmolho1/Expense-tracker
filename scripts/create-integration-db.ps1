# Create integration test database if it doesn't exist
# Usage: .\scripts\create-integration-db.ps1

$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "expenseuser" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "expensepass" }
$TEST_DB_NAME = "expense_tracker_integration"

Write-Host "Creating integration test database: $TEST_DB_NAME" -ForegroundColor Cyan

# Navigate to project root (parent of scripts directory)
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

# Check if database service is running, start if not
Write-Host "Checking database service..." -ForegroundColor Gray
$dbStatus = docker compose ps postgres --format json 2>$null | ConvertFrom-Json

if (-not $dbStatus -or $dbStatus.State -ne "running") {
    Write-Host "Starting database service..." -ForegroundColor Yellow
    docker compose up -d postgres
    
    # Wait for database to be ready
    Write-Host "Waiting for database to be ready..." -ForegroundColor Gray
    $maxAttempts = 30
    $attempt = 0
    $ready = $false
    
    while (-not $ready -and $attempt -lt $maxAttempts) {
        $attempt++
        Start-Sleep -Seconds 1
        $testResult = docker compose exec -T postgres psql -U $DB_USER -d postgres -c "SELECT 1;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
        }
    }
    
    if (-not $ready) {
        Write-Host "[ERROR] Database did not become ready in time" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Database is ready" -ForegroundColor Green
} else {
    Write-Host "[OK] Database is already running" -ForegroundColor Green
}

# Check if database exists
Write-Host "Checking if integration test database exists..." -ForegroundColor Gray
$checkQuery = "SELECT 1 FROM pg_database WHERE datname='$TEST_DB_NAME'"
$result = docker compose exec -T postgres psql -U $DB_USER -d postgres -tAc $checkQuery 2>$null

if ($result -match "1") {
    Write-Host "[OK] Integration test database already exists: $TEST_DB_NAME" -ForegroundColor Green
} else {
    Write-Host "Creating integration test database..." -ForegroundColor Yellow
    $createCmd = "CREATE DATABASE $TEST_DB_NAME;"
    docker compose exec -T postgres psql -U $DB_USER -d postgres -c $createCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Integration test database created: $TEST_DB_NAME" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to create integration test database" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Integration test database ready!" -ForegroundColor Green
$connString = "postgresql://${DB_USER}:***@localhost:5432/${TEST_DB_NAME}"
Write-Host "Connection string: $connString" -ForegroundColor Gray
