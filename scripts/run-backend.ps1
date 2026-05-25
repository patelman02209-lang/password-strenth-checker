# Start Flask API on http://127.0.0.1:5000
$ErrorActionPreference = "Stop"
$Backend = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
Push-Location $Backend
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Run scripts/setup.ps1 first."
}
$env:FLASK_APP = "run:app"
& .\.venv\Scripts\python.exe run.py
