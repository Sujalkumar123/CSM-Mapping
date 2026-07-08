@echo off
title CSM React Full-Stack Dashboard
cd /d "%~dp0"

echo ============================================================
echo      CSM DIRECTORY - REACT + EXPRESS FULL-STACK ENGINE
============================================================
echo.

:: Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or path not loaded.
    echo Please make sure you have installed Node.js from https://nodejs.org/
    echo If you just installed it, please restart your computer to apply the path changes.
    echo.
    pause
    exit /b
)

:: Install Backend Dependencies
echo 1. Checking backend dependencies...
cd NewLayout\backend
if not exist node_modules (
    echo [INFO] Installing backend node packages: cors, express, xlsx...
    call npm install
) else (
    echo [INFO] Backend dependencies already installed.
)
cd ..\..

:: Install Frontend Dependencies
echo.
echo 2. Checking frontend dependencies...
cd NewLayout\frontend
if not exist node_modules (
    echo [INFO] Installing frontend node packages: react, react-dom, vite...
    call npm install
) else (
    echo [INFO] Frontend dependencies already installed.
)
cd ..\..

echo.
echo ============================================================
echo      STARTING FRONTEND AND BACKEND SERVERS
============================================================
echo.

:: Start Express Backend in a new window
echo [INFO] Starting Backend API Server (Port 5001)...
cd /d "%~dp0NewLayout\backend"
start "CSM Dashboard Backend" cmd /k "node server.js"
cd /d "%~dp0"

:: Start React Frontend in the current window
echo [INFO] Starting React Frontend (Port 5173)...
echo [INFO] Close this window to stop both servers.
echo.
cd /d "%~dp0NewLayout\frontend"
call npm run dev

pause
