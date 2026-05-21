# Gestão Unificada — PIT STOP + PEV

Plataforma de gestão operacional unificada com dois setores integrados.

## Estrutura

```
index.html                  — Ponto de entrada único
gestao-pitstop.js           — Lógica do setor Pit Stop (inalterada)
gestao-pitstop.css          — Estilos + extensões PEV
gestao-pev.js               — Lógica do setor PEV (escala, almoço, equipe)
gestao-pev-importacoes.js   — Módulo de importações Discord
api/hermes.js               — API proxy Hermes (Pit Stop)
api/notificacoes.js         — API notificações (Pit Stop)
api/pev-importacao.js       — API importações Discord (PEV) ← NOVO
vercel.json                 — Rotas Vercel
supabase-pev-schema.sql     — SQL para criar tabela no Supabase ← NOVO
```

## Configuração

### 1. Supabase — criar tabela PEV
Execute o conteúdo de `supabase-pev-schema.sql` no SQL Editor do Supabase.

### 2. Variáveis de ambiente (Vercel)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HERMES_URL=https://seu-hermes.railway.app
API_SECRET=sua_chave_secreta
```

### 3. Bot Discord — Integração /importação de dados
Configure seu bot Discord para enviar um POST ao comando `/importação de dados`:

**Endpoint:** `POST https://seu-site.vercel.app/api/pev-importacao`

**Headers:**
```
Content-Type: application/json
x-api-secret: sua_chave_secreta   ← se API_SECRET estiver configurado
```

**Body (JSON):**
```json
{
  "empresa": "Nome da Empresa",
  "cnpj": "00.000.000/0001-00",
  "importacao": "sim",
  "data_virada": "2025-08-15",
  "discord_user": "colaborador#1234",
  "obs": "Observação opcional"
}
```

**Resposta de sucesso:**
```json
{ "ok": true, "data": { "id": "pev_xxx", "empresa": "...", ... } }
```

## Funcionalidades PEV

| Aba | Funcionalidade |
|-----|----------------|
| Escala | Status de presença de cada colaborador, mensagem formatada, envio Discord |
| Almoço | Controle de horários de almoço, mensagem formatada, envio Discord |
| Equipe | Adicionar/editar/remover colaboradores PEV |
| Importações Discord | Ver/editar/excluir registros vindos do bot; adicionar manualmente |

## Como o bot Discord envia dados

1. Colaborador digita `/importação de dados` no Discord
2. Bot coleta: Nome da empresa, CNPJ, Vai ter importação? (sim/não)
3. Bot faz POST para `/api/pev-importacao`
4. Registro aparece automaticamente na aba **Importações Discord** do site
5. Gestores podem editar ou excluir registros diretamente no site
