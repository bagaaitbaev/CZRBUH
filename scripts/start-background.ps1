$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root ".server.pid"
$url = "http://127.0.0.1:4173"

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid) {
    $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Host "Project is already running: $url"
      exit 0
    }
  }
}

$node = Get-Command node -ErrorAction Stop
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $node.Source
$startInfo.Arguments = "local-server.cjs"
$startInfo.WorkingDirectory = $root
$startInfo.UseShellExecute = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$process = [System.Diagnostics.Process]::Start($startInfo)

Set-Content -Path $pidFile -Value $process.Id
Start-Sleep -Seconds 1

Write-Host "Project started in background: $url"
Write-Host "PID: $($process.Id)"
