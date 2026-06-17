@echo off
REM foodstory-sync.cmd — wrapper สำหรับ Windows Task Scheduler
REM รัน sync เดือนปัจจุบัน + เขียน log · ใช้กับ schtasks (ดู docs/foodstory-integration.md)
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\Program Files\nodejs\node.exe"
echo ===== %DATE% %TIME% =====>> logs\foodstory-sync.log
"%NODE%" scripts\foodstory_sync.mjs --current>> logs\foodstory-sync.log 2>&1
echo exit=%ERRORLEVEL%>> logs\foodstory-sync.log
endlocal
