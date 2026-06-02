<#
Instala/Verifica ffmpeg no Windows.

Uso:
 - Abra PowerShell como Administrador
 - Execute: .\scripts\install-ffmpeg.ps1

O script tenta, em ordem:
 1) Verificar se `ffmpeg` já está disponível
 2) Instalar via `winget` (Gyan.FFmpeg)
 3) Se winget não disponível, tentar `choco install ffmpeg`
 4) Caso nenhum gerenciador exista, mostra instruções manuais

Observação: este script apenas automatiza o processo local — eu não tenho acesso direto
ao seu Windows, portanto você precisa executá-lo aí.
#>

function Test-FFmpeg {
    try {
        $v = & ffmpeg -version 2>$null
        if ($LASTEXITCODE -eq 0) { return $true }
    } catch { }
    return $false
}

Write-Host "Verificando ffmpeg..."
if (Test-FFmpeg) {
    Write-Host "ffmpeg já instalado. Versão:" -NoNewline
    & ffmpeg -version | Select-Object -First 1
    exit 0
}

Write-Host "ffmpeg não encontrado. Tentando instalar via winget..."

$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
    Write-Host "Usando winget para instalar Gyan.FFmpeg (build estável)..."
    try {
        winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
    } catch {
        Write-Host "Falha ao executar winget. Saindo para tentativa alternativa." -ForegroundColor Yellow
    }

    if (Test-FFmpeg) {
        Write-Host "Instalação via winget concluída com sucesso." -ForegroundColor Green
        & ffmpeg -version | Select-Object -First 1
        exit 0
    } else {
        Write-Host "winget não conseguiu instalar ffmpeg." -ForegroundColor Yellow
    }
} else {
    Write-Host "winget não encontrado." -ForegroundColor Yellow
}

Write-Host "Tentando instalar via Chocolatey (choco)..."
$choco = Get-Command choco -ErrorAction SilentlyContinue
if ($choco) {
    try {
        choco install ffmpeg -y
    } catch {
        Write-Host "Falha ao executar choco." -ForegroundColor Yellow
    }

    if (Test-FFmpeg) {
        Write-Host "Instalação via Chocolatey concluída com sucesso." -ForegroundColor Green
        & ffmpeg -version | Select-Object -First 1
        exit 0
    } else {
        Write-Host "Chocolatey não conseguiu instalar ffmpeg." -ForegroundColor Yellow
    }
} else {
    Write-Host "Chocolatey não encontrado." -ForegroundColor Yellow
}

Write-Host "Não foi possível instalar automaticamente o ffmpeg neste sistema." -ForegroundColor Red
Write-Host "Opções:" -ForegroundColor Cyan
Write-Host " 1) Instale o winget (App Installer) e rode novamente o script." -ForegroundColor Cyan
Write-Host " 2) Instale Chocolatey (https://chocolatey.org/install) e rode novamente o script." -ForegroundColor Cyan
Write-Host " 3) Baixe manualmente: https://ffmpeg.org/download.html" -ForegroundColor Cyan

exit 2
