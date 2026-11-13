# Weekly Bursarly verification sweep.
# Register with:
#   schtasks /Create /SC WEEKLY /D SUN /TN "Bursarly verification" ^
#     /TR "powershell -ExecutionPolicy Bypass -File <path>\run_weekly_verification.ps1" /ST 03:00
#
# The sweep is read-versus-official-pages only: it never invents data. Records whose
# page returns 404 are hidden from the public catalogue until someone fixes the URL.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "venv\Scripts\python.exe"
$logDir = Join-Path $PSScriptRoot "logs"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir ("verify_{0}.log" -f (Get-Date -Format "yyyyMMdd_HHmmss"))

Push-Location $PSScriptRoot
try {
    & $python verify_official.py --all *>&1 | Tee-Object -FilePath $log
    Write-Output "Verification finished. Log: $log"
}
finally {
    Pop-Location
}
