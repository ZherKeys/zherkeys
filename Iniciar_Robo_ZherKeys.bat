chcp 65001 > nul
@echo off
title Zher Keys - Robo Tray Icon e Auto-Compra Eneba
color 0B
cd /d "%~dp0"

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo ========================================================
echo   ROBO AUTOMATICO ZHER KEYS - SYSTEM TRAY E NOTIFICACOES
echo ========================================================
echo.

:loop
echo [%date% %time%] Iniciando robo no canto da tela (System Tray)...
python zherkeys_tray_agent.py

echo.
echo [AVISO] O robo foi encerrado. Reiniciando em 5 segundos...
timeout /t 5 /nobreak > nul
goto loop

