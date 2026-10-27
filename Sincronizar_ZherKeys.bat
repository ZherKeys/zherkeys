@echo off
title Zher Keys - Sincronizacao Segura Bidirecional
color 0A

echo ========================================================
echo   1. SINCRONIZANDO SITE AO VIVO + GITHUB COM SEU PC
echo ========================================================
echo.
cd /d "C:\Users\convidado 1\Documents\zherkeysite"

echo [1/4] Baixando novidades do GitHub e do Site Ao Vivo (Usuarios, Carteiras, Z-Points e Produtos)...
git pull --rebase --autostash origin main
node scripts/auto-sync-pc.js --once --stage

echo.
echo [2/4] Preparando arquivos modificados...
git add .

echo.
echo [3/4] Salvando alteracoes localmente...
git commit -m "Atualizacao automatica Zher Keys"

echo.
echo [4/4] Enviando para o GitHub e Render...
git pull --rebase --autostash origin main
git push origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo  SUCESSO! O codigo e os backups foram sincronizados!
    echo  Nenhuma alteracao do site foi sobrescrita.
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo  AVISO: Verifique a mensagem acima.
    echo ========================================================
)
pause
