$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $studioRoot

Write-Host 'Setting up Glued Storyboard...' -ForegroundColor Cyan

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'Node.js 22 or newer is required. Install it from https://nodejs.org and run this setup again.'
}

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmCommand) {
  & $pnpmCommand.Source install
} else {
  $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
  if (-not $corepackCommand) {
    throw 'pnpm or Corepack is required. Install pnpm, then run this setup again.'
  }
  & $corepackCommand.Source pnpm install
}
if ($LASTEXITCODE -ne 0) { throw 'Node dependency installation failed.' }

$venvPath = Join-Path $studioRoot '.venv-kokoro'
if (-not (Test-Path -LiteralPath (Join-Path $venvPath 'Scripts\python.exe'))) {
  $pyCommand = Get-Command py -ErrorAction SilentlyContinue
  if ($pyCommand) {
    & $pyCommand.Source -3.12 -m venv $venvPath
  } else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
      throw 'Python 3.12 is required. Install it from https://python.org and run this setup again.'
    }
    & $pythonCommand.Source -m venv $venvPath
  }
  if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed.' }
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $studioRoot 'requirements-tts.txt')
if ($LASTEXITCODE -ne 0) { throw 'Kokoro dependency installation failed.' }

$modelDir = Join-Path $studioRoot 'models\kokoro'
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null

$downloads = @(
  @{
    Name = 'kokoro-v1.0.onnx'
    Url = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx'
    Sha256 = '7D5DF8ECF7D4B1878015A32686053FD0EEBE2BC377234608764CC0EF3636A6C5'
  },
  @{
    Name = 'voices-v1.0.bin'
    Url = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin'
    Sha256 = 'BCA610B8308E8D99F32E6FE4197E7EC01679264EFED0CAC9140FE9C29F1FBF7D'
  }
)

foreach ($download in $downloads) {
  $destination = Join-Path $modelDir $download.Name
  if (-not (Test-Path -LiteralPath $destination)) {
    Write-Host "Downloading $($download.Name)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $download.Url -OutFile $destination
  }
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
  if ($actualHash -ne $download.Sha256) {
    throw "Hash verification failed for $($download.Name). Delete that file and run setup again."
  }
}

Write-Host 'Glued Storyboard is ready. Run Start-Glued-Storyboard.cmd.' -ForegroundColor Green

