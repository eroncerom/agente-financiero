@echo off
title Detener Agente Financiero
echo ===================================================
echo Deteniendo servidor de Agente Financiero...
echo ===================================================
"%~dp0Agente-Financiero.exe" --stop
echo Listo.
exit
