@echo off
SET BRANCH=main
echo Procurando arquivos .mkv versionados no Git...
for /f "delims=" %%F in ('git ls-files "*.mkv"') do (
  echo Removendo %%F do índice (mantido localmente)...
  git rm --cached "%%F"
)

echo Criando commit de remoção...
git commit -m "Remover arquivos .mkv do repositório (mantidos localmente)"

echo Fazendo push para origin/%BRANCH%...
git push origin %BRANCH%

echo Pronto.
