@echo off
rem Starts the game for local testing and opens it in the default browser.
rem Close this window to stop the server.
title Space Mission Design Game (close this window to stop)
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install
)
call npm run dev -- --open
