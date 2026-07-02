@echo off
cd /d "%~dp0"
echo Starting Purrfect Circuit server...
start "Purrfect Circuit Server" cmd /k "cd /d "%~dp0" && node server\index.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
echo.
echo Server window opened. Friends join at your LAN IP (shown in server window) on port 3000.
echo Use CREATE ROOM or JOIN ROOM in the game — do not open index.html directly for multiplayer.
pause