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
set "RC=%ERRORLEVEL%"
echo exit=%RC%>> logs\foodstory-sync.log
if not "%RC%"=="0" (
  set "MSG=FoodStory sync FAILED - check deploy\logs\foodstory-sync.log"
  if "%RC%"=="2" set "MSG=FoodStory COOKIE EXPIRED - refresh: node scripts/foodstory_setcookie.mjs"
  powershell -NoProfile -Command "(New-Object -ComObject Wscript.Shell).Popup($env:MSG,90,'KanomMae FoodStory Sync',48)" >nul 2>&1
)
endlocal
