@echo off
title ZherKeys - Login Eneba
cd /d "%~dp0"
echo ===================================================
echo   ABRINDO NAVEGADOR PARA LOGIN NA ENEBA...
echo   Faça login na janela que abrir e feche quando terminar.
echo ===================================================
node init_eneba_login.js
pause
