@echo off
chcp 65001 >nul
title Terminal Financiera - Toma de Decisiones
cd /d "%~dp0"
echo ========================================================
echo Iniciando Terminal Financiera (BBDD SQLite + Vite React)
echo ========================================================
echo.

if not exist "node_modules\express" (
    echo [1/2] Instalando dependencias necesarias (npm install)...
    call npm install
)

if not exist "dist\index.html" (
    echo [2/2] Compilando interfaz grafica (npm run build)...
    call npm run build
)

npm run dev
pause
