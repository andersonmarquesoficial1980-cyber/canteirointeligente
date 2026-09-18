# Workflux — Integração Ponto Mais (VR) para Banco de Horas (WF Gestão de Pessoas)

Atualizado em: 2026-09-18

## 1) Confirmação da API (fonte oficial)
- A VR/Pontomais informa **API RESTful** + **Webhooks**.
- Acesso com **Token público** da conta.
- Contratação/habilitação via Marketplace/RH Digital.

Fontes:
- https://materiais.vr.com.br/central-de-ajuda/extensao-api/
- https://documenter.getpostman.com/view/4785048/RWMCvVxN

## 2) Escopo funcional para WF Banco de Horas
Objetivo: sincronizar dados do Ponto Mais para a visão `Banco de Horas` do Workflux sem quebrar cálculo e sem risco de produção.

Tabelas WF já existentes:
- `public.ponto_he_resumo_mensal` (resumo mensal por colaborador)
- `public.ponto_he_competencias` (status aberto/fechado da competência)
- `public.ponto_registros` (batidas)
- `public.funcionarios` / `public.employees` (cadastro)

Observações técnicas confirmadas no código:
- Tela `BancoHoras.tsx` usa prioritariamente `ponto_he_resumo_mensal` e fallback em `ponto_registros`.
- Fechamento de competência já existe (`fn_ponto_he_fechar_competencia` / `fn_ponto_he_reabrir_competencia`).

## 3) Contrato de integração (API -> WF)
> Os nomes exatos dos endpoints/campos devem ser validados na collection oficial da sua conta.

Mapeamento recomendado:

1. Colaborador
- API: identificador externo, nome, matrícula, função, equipe
- WF: `funcionarios`/`employees`
- Chave recomendada de vínculo: matrícula + company_id (fallback por nome normalizado)

2. Batidas (ponto)
- API: data/hora/tipo/turno e metadados
- WF: `ponto_registros`
- Regra: persistência idempotente por chave externa (`external_id`) em `payload/meta` (se não houver coluna dedicada)

3. Resumo mensal de HE
- API: crédito, débito, HE 70, HE 100, total, período
- WF: `ponto_he_resumo_mensal`
- Regra: `upsert` por `(company_id, competencia, colaborador_nome)` com trilha no `payload`

4. Competência
- API: status de fechamento (quando existir)
- WF: `ponto_he_competencias`
- Regra: manter compatibilidade com RPCs de fechamento/reabertura já usadas pela UI

## 4) Estratégia de rollout segura

### Fase 0 — Habilitação
- Habilitar/contratar API Ponto Mais no tenant.
- Gerar token técnico dedicado para integração WF.

### Fase 1 — Importação somente leitura (sem DML no banco principal)
- Consumir endpoints e gravar JSON bruto em artefato temporário para auditoria.
- Validar paginação, timezone, intervalos e consistência.

### Fase 2 — Reconciliação
- Comparar API x `ponto_he_resumo_mensal` por competência/equipe/colaborador.
- Medir divergência em:
  - N colaboradores
  - Soma HE 70
  - Soma HE 100
  - Soma HE total

### Fase 3 — Escrita controlada (não destrutiva)
- `upsert` por lotes pequenos com snapshot de antes/depois no `payload`.
- Nunca apagar histórico; somente atualização rastreável.

### Fase 4 — Operação
- Rotina diária incremental (D-1) + rotina mensal de fechamento.
- Alerta para divergências acima de limiar.

## 5) SQL Read-Only (produção) — pacote de validação

> Substitua:
- `<COMPANY_ID>` (uuid)
- `<COMPETENCIA>` (ex. `'2026-09-01'`)

### 5.1 Status da competência
```sql
select
  company_id,
  competencia,
  status,
  observacao,
  fechado_em,
  reaberto_em,
  updated_at
from public.ponto_he_competencias
where company_id = '<COMPANY_ID>'::uuid
  and competencia = '<COMPETENCIA>'::date;
```

### 5.2 Resumo mensal consolidado
```sql
select
  count(*) as colaboradores,
  coalesce(sum(he_70_horas),0) as soma_he70,
  coalesce(sum(he_100_horas),0) as soma_he100,
  coalesce(sum(total_horas_extras_horas),0) as soma_he_total,
  coalesce(sum(credito_horas),0) as soma_credito,
  coalesce(sum(debito_horas),0) as soma_debito
from public.ponto_he_resumo_mensal
where company_id = '<COMPANY_ID>'::uuid
  and competencia = '<COMPETENCIA>'::date;
```

### 5.3 Top divergências (saldo alto/baixo)
```sql
select
  colaborador_nome,
  equipe_nome,
  he_70_horas,
  he_100_horas,
  total_horas_extras_horas,
  credito_horas,
  debito_horas,
  updated_at
from public.ponto_he_resumo_mensal
where company_id = '<COMPANY_ID>'::uuid
  and competencia = '<COMPETENCIA>'::date
order by total_horas_extras_horas desc, colaborador_nome asc
limit 50;
```

### 5.4 Duplicidades por nome no resumo
```sql
select
  colaborador_nome,
  count(*) as qtd
from public.ponto_he_resumo_mensal
where company_id = '<COMPANY_ID>'::uuid
  and competencia = '<COMPETENCIA>'::date
group by colaborador_nome
having count(*) > 1
order by qtd desc, colaborador_nome;
```

### 5.5 Batidas incompletas por dia (possíveis problemas de jornada)
```sql
select
  r.staff_id,
  f.nome,
  r.data,
  count(*) as qtd_batidas,
  min(r.hora) as primeira,
  max(r.hora) as ultima
from public.ponto_registros r
left join public.funcionarios f on f.id = r.staff_id
where r.company_id = '<COMPANY_ID>'::uuid
  and r.data >= date_trunc('month','<COMPETENCIA>'::date)::date
  and r.data < (date_trunc('month','<COMPETENCIA>'::date) + interval '1 month')::date
group by r.staff_id, f.nome, r.data
having count(*) in (1,3)
order by r.data desc, f.nome;
```

## 6) Governança e segurança (produção)
- Sempre executar baseline **read-only** antes de qualquer atualização.
- DML apenas com autorização explícita.
- Operar por recorte (`company_id` + `competencia` + equipe opcional).
- Sem deletes destrutivos para ajustar banco de horas.

## 7) Implementação aplicada no Workflux (2026-09-18)

Arquivos criados/alterados:
- `supabase/migrations/20260918170000_create_pontomais_sync_runs.sql`
- `supabase/functions/rh-pontomais-sync/index.ts`
- `src/pages/BancoHoras.tsx`

O que já funciona:
- Botão **"Sincronizar PontoMais"** na tela de Banco de Horas.
- Chamada de Edge Function com autenticação do usuário logado.
- Log de execução por competência em `pontomais_sync_runs`.
- Exibição de **Última sync API** no card da competência.

> Nesta versão o sync está em **modo seguro (dry-run de leitura)** para validar token/endpoints sem escrita destrutiva.

## 8) Configuração necessária (secrets)

Definir secrets no Supabase (NÃO commitar token em código):

```bash
cd /Users/andinhomarques/Desktop/canteirointeligente-main

# Token que você abriu em Configurações > Integrações > Token da conta
npx supabase secrets set PONTOMAIS_TOKEN='SEU_TOKEN_AQUI' --linked

# URL base e endpoint da API conforme documentação da sua conta PontoMais
npx supabase secrets set PONTOMAIS_BASE_URL='https://SEU_HOST_DA_API/' --linked
npx supabase secrets set PONTOMAIS_ENDPOINT_PATH='/SEU_ENDPOINT_DE_BANCO_HORAS' --linked

# opcionais (se auth não for Bearer)
npx supabase secrets set PONTOMAIS_AUTH_HEADER='Authorization' --linked
npx supabase secrets set PONTOMAIS_AUTH_PREFIX='Bearer ' --linked
```

## 9) Deploy

```bash
cd /Users/andinhomarques/Desktop/canteirointeligente-main
npx supabase db push --linked
npx supabase functions deploy rh-pontomais-sync --linked
```

## 10) Teste no app (UI)
1. Acessar `Gestão de Pessoas` → `Gerenciamento de Ponto` → `Banco de Horas`.
2. Selecionar competência.
3. Clicar em **Sincronizar PontoMais**.
4. Validar toast de sucesso + atualização de **Última sync API**.

## 11) Próximo passo (após validação)
- Evoluir o `rh-pontomais-sync` de dry-run para import real com `upsert` em `ponto_he_resumo_mensal`, mantendo snapshot de auditoria.
- Incluir reconciliação automática API x WF (totais e N colaboradores).
