@echo off
title Cai dat khoi dong Antigravity 1-Click
cd /d "%~dp0"

echo ========================================================
echo     CAI DAT PHIM TAT KHOI DONG ANTIGRAVITY 1-CLICK
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    pause
    exit /b 1
)

node scripts/install-shortcut.mjs
echo.
pause
