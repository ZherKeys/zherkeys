@echo off
title Zher Keys - Robo Tray Icon e Auto-Compra Eneba
color 0B

echo ========================================================
echo   ROBO AUTOMATICO ZHER KEYS - SYSTEM TRAY E NOTIFICACOES
echo ========================================================
echo.
cd /d "%~dp0"

:loop
echo [%date% %time%] Iniciando robo no canto da tela (System Tray)...
python zherkeys_tray_agent.py

echo.
echo ⚠️ O robo foi encerrado. Reiniciando em 5 segundos...
timeout /t 5 /nobreak > nul
goto loop
