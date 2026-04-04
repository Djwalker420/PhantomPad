@echo off
title PhantomPad v3
echo.
echo   ======================================
echo      PhantomPad v3 — Starting...
echo   ======================================
echo.
echo   Dashboard:  http://localhost:3000
echo   Mobile App: http://localhost:3000/mobile
echo.
start "" http://localhost:3000
node "%~dp0server\index.js"
pause
