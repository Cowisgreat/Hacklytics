# Axiom Startup Script for Windows
# Starts both backend and frontend in separate windows

Write-Host "Starting Axiom Backend and Frontend..." -ForegroundColor Cyan

# Start Backend in new window
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\axiom-backend'; if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }; python main.py"

# Wait for backend to initialize
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start Frontend in new window
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev"

Write-Host "`nBoth servers are starting in separate windows." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173 (or check the terminal)" -ForegroundColor Cyan
Write-Host "`nPress any key to exit this window (servers will continue running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

