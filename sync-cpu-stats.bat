@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0sync-cpu-stats.ps1"
if errorlevel 1 pause