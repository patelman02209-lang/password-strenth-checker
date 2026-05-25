# Start backend and frontend in separate terminal windows.
$ErrorActionPreference = "Stop"
$Scripts = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $Scripts "run-backend.ps1")
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $Scripts "run-frontend.ps1")
Write-Host "Backend: http://127.0.0.1:5000/api/v1/health"
Write-Host "Frontend: http://localhost:5173"
