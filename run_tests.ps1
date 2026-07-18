#!/usr/bin/env pwsh
# run_tests.ps1
# Runs backend and frontend tests

Write-Host "Running Backend API Tests..." -ForegroundColor Cyan
python manage.py test api

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend tests failed. Stopping." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Backend tests passed!`n" -ForegroundColor Green

Write-Host "Running Frontend E2E Tests..." -ForegroundColor Cyan
Push-Location frontend
npm run test:e2e
$FrontendExitCode = $LASTEXITCODE
Pop-Location

if ($FrontendExitCode -ne 0) {
    Write-Host "Frontend tests failed." -ForegroundColor Red
    exit $FrontendExitCode
}

Write-Host "All tests passed successfully!" -ForegroundColor Green
exit 0
