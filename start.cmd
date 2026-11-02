@echo off
setlocal
cd /d "%~dp0frontend"
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto node_missing
where npm >nul 2>nul
if errorlevel 1 goto node_missing
if exist node_modules\.package-lock.json goto run
call npm ci --include=dev --no-audit --no-fund
if errorlevel 1 goto install_failed
:run
set "NEXT_PUBLIC_DATA_MODE=demo"
echo.
echo Open http://localhost:3000 after Ready appears.
echo Press Ctrl+C to stop the website.
call npm run dev -- -H 127.0.0.1 -p 3000
pause
exit /b
:node_missing
echo Please install Node.js 24 or newer from https://nodejs.org/
echo Then run this file again.
pause
exit /b 1
:install_failed
echo Dependency installation failed. Check your internet connection and retry.
pause
exit /b 1
