@echo off
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe go_live.py
) else (
    python go_live.py
)
pause
