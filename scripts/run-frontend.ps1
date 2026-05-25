# Start Vite dev server on http://localhost:5173 (proxies /api to backend).
$ErrorActionPreference = "Stop"
$Frontend = Join-Path (Split-Path -Parent $PSScriptRoot) "frontend"
Push-Location $Frontend
if (-not (Test-Path "node_modules\vite\package.json")) {
    Write-Error "Run scripts/setup.ps1 first."
}
npm run dev
