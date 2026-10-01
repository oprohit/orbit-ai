@echo off
title Orbit AI - Standalone Local Desktop Software
color 0b
echo ========================================================
echo       ORBIT AI - LOCAL DESKTOP SOFTWARE ENGINE
echo ========================================================
echo.
echo [1] Starting embedded high-speed UI engine (127.0.0.1:3000)...
echo [2] Starting native Windows companion agent (127.0.0.1:38291)...
echo.
echo 0ms WAN Latency - All tabs, buttons, and navigation run 100%% local!
echo.

cd /d "%~dp0"

if exist "dist\OrbitAI-win32-x64\OrbitAI.exe" (
    echo [OK] Found native standalone executable: dist\OrbitAI-win32-x64\OrbitAI.exe
    echo Launching Orbit AI Desktop Software...
    start "" "dist\OrbitAI-win32-x64\OrbitAI.exe"
    echo.
    echo Orbit AI is now running locally on your laptop!
    echo Tab switching is instantaneous and runs completely offline/locally.
    echo.
    echo You may close this launcher window at any time.
    timeout /t 5 >nul
    exit /b 0
)

echo [INFO] Dist package not found. Launching via local Electron development runner...
npm run desktop
pause
