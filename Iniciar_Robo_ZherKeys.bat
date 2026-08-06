@echo off
title Zher Keys - Robo de Auto-Compra Eneba (Local PC Agent)
color 0B

echo ========================================================
echo   ROBO AUTOMATICO ZHER KEYS - AGENTE LOCAL ENEBA
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/2] Iniciando monitoramento de pedidos em tempo real...
echo Deixe esta janela aberta no seu PC para que o robo compre 
echo e entregue as chaves automaticamente aos clientes!
echo.
node zherkeys_pc_bot_agent.js

pause
