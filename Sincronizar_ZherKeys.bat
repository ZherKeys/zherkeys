@echo off
title Zher Keys - Sincronizacao e Inicializacao IA
color 0A

echo ========================================================
echo   1. CERTIFICANDO QUE A IA (OLLAMA/CODELLAMA) ESTA ATIVA
echo ========================================================
echo.
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [Ollama] Ja esta ativo e rodando!
) else (
    echo [Ollama] Iniciando Ollama em segundo plano...
    start /b ollama serve
    timeout /t 3 /nobreak >nul
)

echo.
echo ========================================================
echo   2. SINCRONIZANDO SITE COM GITHUB E RENDER
echo ========================================================
echo.
cd "C:\Users\convidado 1\Documents\zherkeysite"

echo [1/3] Preparando arquivos modificados...
git add .

echo.
echo [2/3] Salvando alteracoes localmente...
git commit -m "Atualizacao automatica Zher Keys"

echo.
echo [3/3] Enviando para o GitHub...
echo (Se pedir para fazer login, confirme na janela que abrir)
git push origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo  SUCESSO! O codigo foi enviado!
    echo  A Render vai atualizar o site sozinha em 1 minuto.
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo  ERRO! Falha ao sincronizar. Verifique o aviso acima.
    echo ========================================================
)

echo.
echo ========================================================
echo   3. INICIANDO SITE LOCAL (LOCALHOST:3000)
echo ========================================================
echo.
echo [Node] Iniciando servidor do site em uma nova janela...
start "Zher Keys - Local Server" cmd /k npm start

echo.
echo Pronto! Voce ja pode abrir http://localhost:3000 no seu navegador.
echo.
pause
