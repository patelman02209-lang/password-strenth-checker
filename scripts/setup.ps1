# One-time local setup: Python venv + npm dependencies.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Setting up backend..."
Push-Location (Join-Path $Root "backend")
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created backend/.env from .env.example — edit DATABASE_URI if needed."
}
Pop-Location

Write-Host "Setting up frontend..."
Push-Location (Join-Path $Root "frontend")
if (Test-Path "node_modules") { Remove-Item -Recurse -Force node_modules }
if (Test-Path "package-lock.json") { Remove-Item -Force package-lock.json }
npm install
Pop-Location

Write-Host "Done. Run scripts/run-dev.ps1 to start the app."
