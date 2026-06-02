param(
    [string]$Branch = "main"
)

Write-Host "Procurando arquivos .mkv versionados em Git..."
$mkvs = git ls-files -- "*.mkv"
if (-not $mkvs) {
    Write-Host "Nenhum arquivo .mkv encontrado no índice do Git. Nada a fazer."
    exit 0
}

$mkvsArray = $mkvs -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
Write-Host "Arquivos a remover do índice:`n" + ($mkvsArray -join "`n")

Write-Host "Removendo do índice (será mantido localmente)..."
git rm --cached -- $mkvsArray

Write-Host "Criando commit de remoção..."
git commit -m "Remover arquivos .mkv do repositório (mantidos localmente)"

Write-Host "Fazendo push para origin/$Branch..."
git push origin $Branch

Write-Host "Pronto. Verifique que os arquivos permanecem localmente e não foram enviados ao remoto."
