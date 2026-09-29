@echo off
title Orbit AI - Desktop Companion & App Launcher
color 0b
echo ========================================================
echo       ORBIT AI - LOCAL DESKTOP COMPANION & AGENT
echo ========================================================
echo.
echo Starting Orbit Desktop Agent on port 38291...
echo This enables physical Windows disk scanning (%%TEMP%%, Downloads),
echo native folder creation, and WhatsApp QR synchronization.
echo.

cd /d "%~dp0"

if exist "dist\OrbitAI-win32-x64\OrbitAI.exe" (
    echo [OK] Found native executable: dist\OrbitAI-win32-x64\OrbitAI.exe
    echo Launching Orbit AI Desktop Application...
    start "" "dist\OrbitAI-win32-x64\OrbitAI.exe"
    echo.
    echo Orbit AI is now running natively and listening at http://127.0.0.1:38291!
    echo Your web browser (https://orbit-ai-drab.vercel.app) is also now connected
    echo and can scan your hard drive, clean junk, and create real folders.
    echo.
    echo You can keep this window open or minimize it.
    pause
    exit /b 0
)

echo [INFO] Starting companion background agent with Node.js...
node electron/desktop-agent.js
pause
