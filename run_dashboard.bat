@echo off
title CSM Communication Tool
cd /d "%~dp0"

echo Starting CSM Communication Tool...
echo.

if not exist "NewLayout\backend\node_modules" (
  echo First run - installing backend dependencies...
  call npm install --prefix NewLayout\backend || goto :failed
)

if not exist "NewLayout\frontend\dist" (
  echo First run - building the dashboard...
  call npm install --include=dev --prefix NewLayout\frontend || goto :failed
  call npm run build --prefix NewLayout\frontend || goto :failed
)

echo.
echo Dashboard running at http://localhost:5001
echo Close this window to stop it.
echo.

start "" http://localhost:5001
node NewLayout\backend\server.js

goto :eof

:failed
echo.
echo Setup failed - see the errors above.
pause
