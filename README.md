# Gestão PIT STOP — MVP

Painel inicial com equipe, pausas, folgas, aniversários e botão de Novo Aviso integrado ao Hermes.

## Supabase
Rode `supabase/schema.sql` no SQL Editor do Supabase. Depois coloque sua URL e anon key em `gestao-pitstop.js`.

## Vercel
Variáveis necessárias:
- HERMES_URL
- API_SECRET

## Hermes
Rotas esperadas:
- POST /send/novo-aviso
- POST /send/pitstop-pausas
