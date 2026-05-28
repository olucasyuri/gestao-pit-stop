# 🚀 Guia de Produção — Gestão PIT STOP + PEV

Este pacote deixa o site pronto para produção, fechando os três problemas
críticos (sem login, banco aberto, secret contornável) e aplicando as
melhorias operacionais. Siga na ordem.

---

## 📦 O que tem neste pacote

| Arquivo | Substitui / é novo | O que faz |
|---|---|---|
| `supabase-rls-setup.sql` | **novo** | Liga o RLS em todas as tabelas: sem login, ninguém acessa o banco |
| `auth-gate.js` | **novo** | Tela de login + anexa o token às chamadas `/api/*` automaticamente |
| `index.html` | substitui | Igual ao seu, só com 1 linha a mais carregando o `auth-gate.js` |
| `vercel.json` | substitui | Headers de segurança (CSP, HSTS…) + cache correto |
| `api/_auth.js` | **novo** | Valida o token de sessão no servidor |
| `api/_ratelimit.js` | **novo** | Rate limit por IP |
| `api/pev-importacao.js` | substitui | Remove o bypass do secret; ações internas exigem login |
| `api/hermes.js` | substitui | Exige login + rate limit + CORS restrito |
| `api/notificacoes.js` | substitui | Exige login + rate limit + CORS restrito |
| `api/treinamentos.js` | substitui | Exige login + rate limit + CORS restrito |

Copie todos para a raiz do seu projeto (mantendo a pasta `api/`),
sobrescrevendo os antigos.

---

## ✅ Passo a passo

### 1. Supabase — ligar o RLS
1. Abra o **Supabase → SQL Editor → New query**.
2. Cole TODO o conteúdo de `supabase-rls-setup.sql` e clique **Run**.
3. Confira na aba **Authentication → Policies**: todas as tabelas devem
   aparecer com RLS ligado e a policy `auth_full_access`.

> A partir daqui, a chave `anon` (pública, no JS) **não acessa mais nada
> sem login**. As rotas `/api` continuam funcionando porque usam a
> `service_role`, que ignora o RLS.

### 2. Supabase — criar o(s) usuário(s) gestor(es)
1. **Authentication → Users → Add user** → defina e-mail e senha.
2. **Authentication → Providers → Email**: **desligue** "Enable signups"
   (assim ninguém cria conta sozinho; só você adiciona usuários).

### 3. Vercel — variáveis de ambiente
Em **Project → Settings → Environment Variables**, garanta que existam:

```
SUPABASE_URL=https://ffzzkjkhwylbskfxwmfc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Settings → API → service_role — NUNCA vai pro front)
SUPABASE_ANON_KEY=eyJ...           (Settings → API → anon public — usada para validar tokens)
HERMES_URL=https://seu-hermes.railway.app
API_SECRET=uma_chave_secreta_forte
PUBLIC_SITE_URL=https://SEU-DOMINIO.vercel.app   (sua URL real — usada no CORS)
```

> `SUPABASE_ANON_KEY` e `PUBLIC_SITE_URL` são **novas** e necessárias para a
> validação de sessão e o CORS restrito. Sem `PUBLIC_SITE_URL`, o CORS não
> libera o navegador.

### 4. Deploy
Faça o commit/deploy. Ao abrir o site, deve aparecer a **tela de login**.
Entre com o usuário criado no passo 2 — o app recarrega já autenticado.

### 5. Atualizar o bot do Discord (se necessário)
O bot continua chamando `POST /api/pev-importacao` com o header
`x-api-secret: <API_SECRET>`. Isso **não mudou** — só a criação de registro
aceita o secret. As ações de aprovar/reprovar/excluir agora exigem um gestor
logado no site (não são feitas pelo bot).

---

## 🧪 Como testar se fechou os buracos

- **Sem login:** abra o site numa aba anônima → deve travar na tela de login.
- **Banco fechado:** tente ler uma tabela direto com a chave anon (sem login):
  ```
  curl "https://ffzzkjkhwylbskfxwmfc.supabase.co/rest/v1/colaboradores?select=*" \
    -H "apikey: <ANON_KEY>"
  ```
  Deve voltar vazio `[]` ou erro de permissão — **não** a lista de colaboradores.
- **Secret não contornável:** tente aprovar sem login:
  ```
  curl -X POST "https://SEU-SITE/api/pev-importacao" \
    -H "Content-Type: application/json" -d '{"action":"aprovar","id":"x"}'
  ```
  Deve retornar **401** (Sessão necessária).

---

## 🧹 Limpeza do repositório (antes do deploy)

Remova arquivos que não devem ir para produção:

```
dashboard-charts.js.bak      # backup
api_treinamentos.js          # duplicado da raiz (a versão boa é api/treinamentos.js)
pev-importacao.js            # duplicado da raiz (a versão boa é api/pev-importacao.js)
patch-index-fds-btn.txt      # nota de patch
```

E crie um `.gitignore` com pelo menos:
```
*.bak
.env
.env.local
.vercel
node_modules
```

---

## 📈 Melhorias operacionais recomendadas (próximos passos)

1. **Monitoramento de erros** — adicione o Sentry (plano free) ou use os
   Vercel Logs/Analytics. Hoje os erros só caem em `console.error` e somem.
2. **Ambiente de staging** — crie um projeto Supabase separado para testes e
   use os *Preview Deployments* da Vercel, para nunca testar nos dados reais.
3. **Rate limit global** — o `_ratelimit.js` é por instância (proteção
   básica). Para limite global rígido, troque por **Upstash Redis** ou
   **Vercel KV** (`@upstash/ratelimit`).
4. **Backups do Supabase** — confirme que os backups automáticos estão
   ligados (o plano free tem retenção curta; o Pro guarda mais).
5. **LGPD** — há dados pessoais (nomes, IDs de Discord, CNPJs). Com o login +
   RLS você já restringe o acesso; vale também registrar quem acessa
   (auditoria) e ter um responsável definido pelos dados.

---

## ⚠️ Observações

- O `auth-gate.js` reaproveita a sessão do cliente Supabase do app — por isso
  ele **precisa** carregar depois do `supabase-js` e antes do
  `gestao-pitstop.js` (já está assim no `index.html` deste pacote).
- O wrapper de `fetch` anexa o token só em chamadas para `/api/*`; chamadas
  diretas ao Supabase (`.from(...)`) já usam a sessão automaticamente.
- A chave `anon` no front continua pública — isso é normal e **seguro** agora,
  porque o RLS exige login. O que protege o banco é o RLS, não esconder a chave.
