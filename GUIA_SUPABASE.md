# 🗄️ Guia de Configuração do Supabase

Este guia explica como garantir que os dados estejam corretamente configurados no Supabase para que o Dashboard e o Mapa funcionem perfeitamente.

---

## 📋 Tabelas Necessárias

### 1. Tabela: `folgas`

#### **Estrutura:**
```sql
CREATE TABLE public.folgas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    colaborador_nome TEXT NOT NULL,
    data_folga DATE NOT NULL,
    data_fim DATE,
    status TEXT NOT NULL,
    motivo TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Campos Importantes:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único (auto-gerado) |
| `colaborador_nome` | TEXT | Sim | Nome do colaborador (ex: "Caue") |
| `data_folga` | DATE | Sim | Data de início (formato: YYYY-MM-DD) |
| `data_fim` | DATE | Não | Data de término (para férias) |
| `status` | TEXT | Sim | **IMPORTANTE:** Use `"ferias"` ou `"Férias"` |
| `motivo` | TEXT | Não | Descrição do motivo |

#### **⚠️ ATENÇÃO: Campo `status`**

O campo `status` determina se a folga aparece como "Folga" ou "Férias" no dashboard.

**Para FÉRIAS:**
- ✅ Use: `"ferias"` (minúsculo, sem acento)
- ✅ Use: `"Férias"` (com acento, maiúscula)
- ❌ NÃO use: `"FERIAS"`, `"ferias:"`, `"Ferias"`

**Para FOLGAS:**
- ✅ Use: `"folga"`, `"liberada"`, qualquer outro valor

#### **Exemplo de Dados:**
```sql
INSERT INTO folgas (colaborador_nome, data_folga, data_fim, status, motivo) VALUES
('Caue', '2027-02-01', '2027-02-28', 'ferias', 'Férias'),
('Fabio', '2026-08-01', '2026-08-31', 'ferias', 'Férias'),
('Jannekeli', '2026-08-01', '2026-08-31', 'ferias', 'Férias');
```

---

### 2. Tabela: `pev_colaboradores`

#### **Estrutura:**
```sql
CREATE TABLE public.pev_colaboradores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    horario TEXT NOT NULL,
    regiao TEXT NOT NULL,
    almoco TIME NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Campos Importantes:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | TEXT | Sim | ID único (ex: "pev_colab_xyz123") |
| `nome` | TEXT | Sim | Nome completo |
| `horario` | TEXT | Sim | Horário de trabalho (ex: "08h - 18h") |
| `regiao` | TEXT | Sim | **DEVE SER** uma das 31 regiões válidas |
| `almoco` | TIME | Sim | Horário do almoço (ex: "12:00:00") |
| `ativo` | BOOLEAN | Sim | true = ativo, false = inativo |

#### **⚠️ ATENÇÃO: Campo `regiao`**

O campo `regiao` DEVE ser exatamente igual a uma das opções abaixo (case-sensitive):

```
✅ Regiões Válidas (copie exatamente assim):

"Aracaju"
"São Luiz"
"Ipatinga / Teófilo Otoni"
"Ribeirão Preto"
"Goiânia"
"Juazeiro do Norte"
"Cuiabá"
"Fortaleza"
"Recife"
"Salvador"
"Manaus"
"Belém"
"Porto Alegre"
"Curitiba"
"Florianópolis"
"Belo Horizonte"
"São Paulo"
"Rio de Janeiro"
"Brasília"
"Natal"
"Maceió"
"João Pessoa"
"Teresina"
"Macapá"
"Boa Vista"
"Porto Velho"
"Rio Branco"
"Palmas"
"Campo Grande"
"Macaé"
"Vitória"
```

#### **Exemplo de Dados:**
```sql
INSERT INTO pev_colaboradores (id, nome, horario, regiao, almoco, ativo) VALUES
('pev_colab_001', 'Gabriel Santos', '08h - 18h', 'Aracaju', '12:00:00', true),
('pev_colab_002', 'Michel', '08h - 18h', 'Aracaju', '13:12:00', true),
('pev_colab_003', 'Luan', '08h - 18h', 'Aracaju', '11:00:00', true);
```

---

### 3. Tabela: `pev_importacoes`

#### **Estrutura:**
```sql
CREATE TABLE public.pev_importacoes (
    id TEXT PRIMARY KEY,
    empresa TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    importacao TEXT NOT NULL,
    data_virada DATE,
    obs TEXT,
    discord_user TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Campos Importantes:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | TEXT | Sim | ID único (ex: "pev_xyz123") |
| `empresa` | TEXT | Sim | Nome da empresa |
| `cnpj` | TEXT | Sim | CNPJ formatado (XX.XXX.XXX/XXXX-XX) |
| `importacao` | TEXT | Sim | `"sim"` ou `"nao"` |
| `data_virada` | DATE | Não | Data da virada do sistema |
| `obs` | TEXT | Não | Observações |
| `discord_user` | TEXT | Não | Usuário que registrou via Discord |

---

## 🔧 Como Verificar se os Dados Estão Corretos

### **1. Verificar Férias:**

Execute no SQL Editor do Supabase:

```sql
-- Ver todas as férias futuras
SELECT 
  colaborador_nome,
  data_folga,
  data_fim,
  status,
  motivo
FROM folgas
WHERE status IN ('ferias', 'Férias')
  AND (data_fim >= CURRENT_DATE OR data_folga >= CURRENT_DATE)
ORDER BY data_folga;
```

**Resultado esperado:**
- Deve retornar todas as férias programadas
- Campo `status` deve ser `"ferias"` ou `"Férias"`
- Datas devem estar no futuro ou presente

---

### **2. Verificar Regiões PEV:**

```sql
-- Ver colaboradores PEV ativos por região
SELECT 
  regiao,
  COUNT(*) as total,
  STRING_AGG(nome, ', ') as colaboradores
FROM pev_colaboradores
WHERE ativo = true
GROUP BY regiao
ORDER BY total DESC;
```

**Resultado esperado:**
- Todas as regiões devem ser reconhecidas
- Nenhuma região deve estar em branco ou com valor estranho

---

### **3. Verificar Mapeamento Região → Estado:**

```sql
-- Ver quais estados terão colaboradores no mapa
SELECT 
  regiao,
  COUNT(*) as total,
  CASE 
    WHEN regiao = 'Aracaju' THEN 'SE'
    WHEN regiao = 'São Luiz' THEN 'MA'
    WHEN regiao = 'Ipatinga / Teófilo Otoni' THEN 'MG'
    WHEN regiao = 'Ribeirão Preto' THEN 'SP'
    WHEN regiao = 'Goiânia' THEN 'GO'
    WHEN regiao = 'Juazeiro do Norte' THEN 'CE'
    WHEN regiao = 'Cuiabá' THEN 'MT'
    ELSE 'OUTRO'
  END as estado
FROM pev_colaboradores
WHERE ativo = true
GROUP BY regiao
ORDER BY total DESC;
```

**Resultado esperado:**
- Coluna `estado` NÃO deve ter valor `'OUTRO'`
- Se tiver, a região não está sendo reconhecida

---

## 🛠️ Como Corrigir Dados Existentes

### **Corrigir campo `status` em férias:**

```sql
-- Corrigir status de férias (se estiver errado)
UPDATE folgas
SET status = 'ferias'
WHERE LOWER(status) LIKE '%ferias%'
  OR LOWER(status) LIKE '%férias%';
```

---

### **Corrigir regiões inconsistentes:**

```sql
-- Ver regiões que não batem com as válidas
SELECT DISTINCT regiao
FROM pev_colaboradores
WHERE regiao NOT IN (
  'Aracaju', 'São Luiz', 'Ipatinga / Teófilo Otoni', 
  'Ribeirão Preto', 'Goiânia', 'Juazeiro do Norte', 
  'Cuiabá', 'Fortaleza', 'Recife', 'Salvador',
  'Manaus', 'Belém', 'Porto Alegre', 'Curitiba',
  'Florianópolis', 'Belo Horizonte', 'São Paulo',
  'Rio de Janeiro', 'Brasília', 'Natal', 'Maceió',
  'João Pessoa', 'Teresina', 'Macapá', 'Boa Vista',
  'Porto Velho', 'Rio Branco', 'Palmas', 'Campo Grande',
  'Macaé', 'Vitória'
);

-- Corrigir casos comuns:
UPDATE pev_colaboradores SET regiao = 'São Luiz' WHERE regiao = 'São Luís';
UPDATE pev_colaboradores SET regiao = 'Aracaju' WHERE regiao = 'Aracajú';
UPDATE pev_colaboradores SET regiao = 'Cuiabá' WHERE regiao = 'Cuiaba';
```

---

## 📊 RLS (Row Level Security)

### **Configuração Recomendada:**

```sql
-- Desabilitar RLS para testes (NÃO RECOMENDADO EM PRODUÇÃO)
ALTER TABLE folgas DISABLE ROW LEVEL SECURITY;
ALTER TABLE pev_colaboradores DISABLE ROW LEVEL SECURITY;
ALTER TABLE pev_importacoes DISABLE ROW LEVEL SECURITY;

-- OU

-- Habilitar RLS com política pública (CUIDADO: dados acessíveis a todos)
ALTER TABLE folgas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública" ON folgas FOR SELECT USING (true);

ALTER TABLE pev_colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública" ON pev_colaboradores FOR SELECT USING (true);
```

---

## 🚨 Troubleshooting Comum

### **Problema: "Folgas totais: 0" no console**

**Causas possíveis:**
1. Tabela `folgas` não existe
2. Tabela está vazia
3. RLS bloqueando acesso
4. Credenciais do Supabase incorretas no frontend

**Solução:**
```sql
-- Verificar se tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'folgas';

-- Verificar se tem dados
SELECT COUNT(*) FROM folgas;

-- Verificar RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'folgas';
```

---

### **Problema: Mapa não atualiza após editar região**

**Causas possíveis:**
1. Região digitada/selecionada não está na lista válida
2. Função `MapaBrasil_refresh()` não está definida
3. `mapa-brasil.js` não foi carregado

**Solução:**
1. Sempre use o SELECT dropdown (não digite manualmente)
2. Verifique no console:
   ```javascript
   typeof window.MapaBrasil_refresh // deve ser 'function'
   ```
3. Recarregue a página

---

### **Problema: Dados diferentes em abas abertas**

**Causa:** localStorage é isolado por aba.

**Solução:**
- Sempre recarregue todas as abas após alterações no Supabase
- Use eventos de `storage` para sincronizar (já implementado no dashboard)

---

## ✅ Checklist de Validação Final

Antes de considerar a configuração completa, verifique:

### **Supabase:**
- [ ] Tabela `folgas` existe e tem dados
- [ ] Campo `status` = `"ferias"` para férias
- [ ] Datas das férias estão no formato correto (YYYY-MM-DD)
- [ ] Tabela `pev_colaboradores` existe e tem dados
- [ ] Campo `regiao` só tem valores da lista válida
- [ ] RLS configurado corretamente ou desabilitado

### **Frontend:**
- [ ] Console mostra logs de carregamento
- [ ] `localStorage.getItem('pitstop_folgas')` tem dados
- [ ] `localStorage.getItem('pev_colaboradores')` tem dados
- [ ] Dashboard mostra "Próximas Férias"
- [ ] Mapa mostra estados com colaboradores
- [ ] Modal PEV tem dropdown de região

---

**Última atualização:** Maio de 2026  
**Versão:** 1.0
