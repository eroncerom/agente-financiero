@echo off
chcp 65001 >nul
title Agente Financiero
cd /d "%~dp0"

if not exist "node_modules\express" (
    echo ==============================================================
    echo [Agente Financiero] Instalando dependencias por primera vez...
    echo ==============================================================
    call npm install
)

if not exist "dist\index.html" (
    echo ==============================================================
    echo [Agente Financiero] Compilando interfaz grafica (dist)...
    echo ==============================================================
    call npm run build
)

start "" "%~dp0Agente-Financiero.exe"
exit
