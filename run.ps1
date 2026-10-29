# Start FindiT on Windows: Django API on :8000 and the Vite dev server on :5173.
# First run sets everything up (venv, packages, database, demo data).
#   .\run.ps1          dev mode (two servers, hot reload)
#   .\run.ps1 -Single  one port: builds the frontend and serves it through Django on :8000
#   add -Lan           also reachable from other devices on your network (phone, laptop)
# Needs the local MongoDB service running (DATABASE_URI in backend\.env).
param([switch]$Single, [switch]$Lan)
$bind = if ($Lan) { "0.0.0.0:8000" } else { "127.0.0.1:8000" }
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$py = Join-Path $backend "venv\Scripts\python.exe"

function Step($what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FindiT: $what failed (exit code $LASTEXITCODE). See the messages above." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path $py)) {
    Write-Host "Creating the Python virtual env..."
    Step "creating the virtual env" { python -m venv (Join-Path $backend "venv") }
    Step "installing Python packages" { & $py -m pip install -q -r (Join-Path $backend "requirements.txt") }
}

Push-Location $backend
Step "database migration" { & $py manage.py migrate -v 0 }
Step "demo data" { & $py manage.py seed_demo }   # safe to repeat: skips data that already exists
Pop-Location

Push-Location $frontend
if (-not (Test-Path "node_modules")) { Step "npm install" { npm install } }

function Show-LanUrls($port) {
    if (-not $Lan) { return }
    $virtual = Get-NetAdapter -ErrorAction SilentlyContinue |
        Where-Object { $_.InterfaceDescription -match 'VirtualBox|Hyper-V|VMware|WSL' } |
        Select-Object -ExpandProperty ifIndex
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $virtual -notcontains $_.InterfaceIndex } |
        Select-Object -ExpandProperty IPAddress
    foreach ($ip in $ips) { Write-Host "  On your network: http://${ip}:$port" -ForegroundColor Green }
}

if ($Single) {
    Step "frontend build" { npm run build }
    Pop-Location
    Write-Host "FindiT is running at http://127.0.0.1:8000" -ForegroundColor Green
    Show-LanUrls 8000
    Push-Location $backend
    & $py manage.py runserver $bind
    Pop-Location
    exit
}
Pop-Location

$api = Start-Process -FilePath $py -ArgumentList "manage.py", "runserver", $bind -WorkingDirectory $backend -PassThru -NoNewWindow
try {
    Write-Host "API on http://127.0.0.1:8000 - open the app at http://localhost:5173" -ForegroundColor Green
    Show-LanUrls 5173
    Push-Location $frontend
    if ($Lan) { npm run dev -- --host 0.0.0.0 } else { npm run dev }
} finally {
    Pop-Location
    Stop-Process -Id $api.Id -ErrorAction SilentlyContinue
}
