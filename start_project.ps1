# SiteHub Launch Script for Windows (PowerShell)

Write-Host "--- SiteHub Launch Script ---" -ForegroundColor Yellow

# 1. Start Backend (Django) in a new window
Write-Host "[1/3] Starting Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\python.exe manage.py runserver"

# 2. Start Frontend (Next.js) in a new window
Write-Host "[2/3] Starting Frontend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# 3. Wait for servers to initialize
Write-Host "[3/3] Waiting for servers to initialize..." -ForegroundColor Green
Start-Sleep -Seconds 8

# 4. Open Browser
Write-Host "Opening application in browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "`nAll systems launching! Check the new windows for server logs." -ForegroundColor White
