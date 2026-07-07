@echo off
cd /d "%~dp0"
.venv\Scripts\python.exe match_slack_export.py
pause
