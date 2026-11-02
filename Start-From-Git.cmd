@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js 24 LTS: https://nodejs.org/
  pause
  exit /b 1
)
node frontend\scripts\ensure-dependencies.cjs
if errorlevel 1 (
  pause
  exit /b 1
)
cd frontend
echo Open the Local URL printed below. Keep this window open. Ctrl+C stops the app.
call npm run dev
if errorlevel 1 pause
