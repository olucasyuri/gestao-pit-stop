#!/usr/bin/env bash
# Remove arquivos que não devem ir para produção. Rode na raiz do projeto.
set -e
rm -f dashboard-charts.js.bak
rm -f api_treinamentos.js
rm -f pev-importacao.js
rm -f patch-index-fds-btn.txt
echo "✅ Arquivos de lixo removidos (backups e duplicados da raiz)."
echo "   As versões corretas das APIs ficam na pasta api/."
