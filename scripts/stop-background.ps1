$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".server.pid"

if (!(Test-Path $pidFile)) {
  Write-Host "Project is not running."
  exit 0
}

$serverPid = Get-Content $pidFile -ErrorAction SilentlyContinue
$process = if ($serverPid) { Get-Process -Id $serverPid -ErrorAction SilentlyContinue } else { $null }

if ($process) {
  Stop-Process -Id $serverPid -Force
  Write-Host "Project stopped."
} else {
  Write-Host "Project process was not found."
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
