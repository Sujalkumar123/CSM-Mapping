@echo off
cd /d "%~dp0"
.venv\Scripts\python.exe patch_csm.py
pause
