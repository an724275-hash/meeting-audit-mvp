@echo off
cd /d "%~dp0"
where codex >nul 2>&1
if errorlevel 1 (
  echo Codex CLI not found. Recording and transcription will work; analysis needs Codex CLI.
)
if not exist ".venv\Scripts\python.exe" python -m venv .venv
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
echo Open http://127.0.0.1:8060/
".venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8060
