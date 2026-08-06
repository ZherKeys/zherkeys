@echo off
title Zher Keys - Robo de Auto-Compra Eneba (Local PC Agent)
color 0B

echo ========================================================
echo   ROBO AUTOMATICO ZHER KEYS - AGENTE LOCAL ENEBA
echo ========================================================
echo.
cd /d "%~dp0"

:loop
echo [%date% %time%] Iniciando monitoramento de pedidos em tempo real...
echo Deixe esta janela aberta no seu PC para que o robo compre 
echo e entregue as chaves automaticamente aos clientes!
echo.
node zherkeys_pc_bot_agent.js

echo.
echo ⚠️ ATENCAO: O robo foi reiniciado automaticamente para manter o servico ativo.
echo Reiniciando em 5 segundos...
timeout /t 5 /nobreak > nul
goto loop
