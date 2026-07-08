@echo off
title Clean CSM Dashboard Project
cd /d "%~dp0"

echo ============================================================
echo      CLEANING OUTDATED STREAMLIT & PYTHON WORKSPACE FILES
echo ============================================================
echo.
echo This will delete all old Streamlit files, Python .venv, and temporary scripts.
echo Your new React frontend, Node backend, and Excel database will remain untouched.
echo.
set /p confirm="Are you sure you want to clean the workspace? (Y/N): "
if /i "%confirm%" neq "Y" (
    echo Cleaning cancelled.
    pause
    exit /b
)

echo.
echo Deleting outdated Streamlit code...
if exist Main.py del /q Main.py
if exist data_loader.py del /q data_loader.py
if exist style.css del /q style.css
if exist requirements.txt del /q requirements.txt
if exist start_streamlit.py del /q start_streamlit.py
if exist run_dashboard.bat del /q run_dashboard.bat

echo Deleting temporary reference files...
if exist test.txt del /q test.txt
if exist inspect_xlsx.ps1 del /q inspect_xlsx.ps1
if exist NewLayout\csm-dashboard-v2.html del /q NewLayout\csm-dashboard-v2.html
if exist NewLayout\backend\test_read.js del /q NewLayout\backend\test_read.js
if exist scratch rmdir /s /q scratch

echo Deleting old lookup/patch scripts...
if exist auto_lookup_slack.py del /q auto_lookup_slack.py
if exist auto_lookup_slack.bat del /q auto_lookup_slack.bat
if exist match_slack_export.py del /q match_slack_export.py
if exist match_slack_export.bat del /q match_slack_export.bat
if exist patch_csm.py del /q patch_csm.py
if exist patch_csm.bat del /q patch_csm.bat

echo Deleting large Python Virtual Environment (.venv)...
if exist .venv rmdir /s /q .venv

echo.
echo ============================================================
echo      CLEANUP COMPLETE!
echo ============================================================
echo.
pause
