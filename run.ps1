$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Write-Host 'Codex CLI не найден: запись и расшифровка будут работать, анализ потребует установки Codex CLI.'
}

if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $python -m pip install -r requirements-local.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Откройте http://127.0.0.1:8060/'
& $python -m uvicorn app:app --host 127.0.0.1 --port 8060
