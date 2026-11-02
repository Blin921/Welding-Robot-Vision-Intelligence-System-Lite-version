@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
  echo Please install Git for Windows: https://git-scm.com/download/win
  pause
  exit /b 1
)
git pull --ff-only
if errorlevel 1 (
  echo Update failed. Your local changes have not been forcibly overwritten.
  pause
  exit /b 1
)
call Start-From-Git.cmd
