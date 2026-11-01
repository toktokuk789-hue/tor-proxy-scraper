@echo off
title TOR PULSE - Rotating Proxy Scraper Bot
echo ========================================================
echo   TOR PULSE — Cybernetic Tor Rotating Proxy Bot
echo ========================================================
echo.
echo Starting backend server and UI dashboard...
start "" "http://localhost:3000"
node server.js
pause
