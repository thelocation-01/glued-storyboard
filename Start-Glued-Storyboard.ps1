$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $studioRoot

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'Node.js is missing. Run Setup-Glued-Storyboard.ps1 first.'
}

$requiredPaths = @(
  (Join-Path $studioRoot 'node_modules'),
  (Join-Path $studioRoot '.venv-kokoro\Scripts\python.exe'),
  (Join-Path $studioRoot 'models\kokoro\kokoro-v1.0.onnx'),
  (Join-Path $studioRoot 'models\kokoro\voices-v1.0.bin')
)
if ($requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }) {
  throw 'Glued Storyboard setup is incomplete. Run Setup-Glued-Storyboard.ps1 first.'
}
$appPort = 3210
while ($appPort -le 3219) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $appPort)
    $client.Dispose()
    $appPort += 1
  } catch {
    $client.Dispose()
    break
  }
}
if ($appPort -gt 3219) { throw 'Glued could not find a free local port from 3210 through 3219.' }
$env:PORT = [string]$appPort
$studioUrl = "http://localhost:$appPort"
Write-Host "Opening Glued Storyboard at $studioUrl" -ForegroundColor Green
$null = Start-Job -ArgumentList $studioUrl -ScriptBlock {
  param($url)
  Start-Sleep -Seconds 2
  Start-Process $url
}
& $nodeCommand.Source server.mjs
