# Checkpoint completo — Integração Ponto Mais x Workflux (Banco de Horas)

Data: 2026-09-23
Responsável: Anderson + Hermes
Projeto: `canteirointeligente-main`

## Objetivo de negócio validado
Ter no Workflux uma gestão operacional de ponto (dia-a-dia/semanal), com histórico de batidas editável por colaborador, para acompanhamento por engenharia/RH.

## Problema central que motivou a investigação
No Ponto Mais aparecem todos os funcionários batendo ponto, mas no Workflux a integração trouxe historicamente só um subconjunto com movimento (primeiro 9, depois 11), enquanto o restante ficou zerado.

---

## O que foi implementado (resumo técnico consolidado)

### Front-end (`src/pages/BancoHoras.tsx`)
1. Status/UX de sync com toasts mais detalhados (incluindo diagnósticos de batidas).
2. Correção de vínculo `employee_id` por matrícula normalizada (ex.: `001363` -> `1363`) + fallback por nome/alias.
3. Correção para não renderizar “histórico fantasma” quando não há batidas reais.
4. Mensagem explícita quando não existem batidas no período.
5. Ajustes para usar equipe canônica do Workflux (via `employees.equipe`) em vez de equipe vinda do Ponto Mais.

### Edge Function (`supabase/functions/rh-pontomais-sync/index.ts`)
1. Leitura de múltiplas fontes de relatório (`time_balances`, fallback `extra_times`, apoio `time_cards`).
2. Parser robusto para payload aninhado e normalização de docs/matrícula.
3. Importação de batidas para `ponto_registros` com deduplicação.
4. Contadores de telemetria no retorno/run:
   - `rows_lidas`, `rows_agrupadas`
   - `punches_rows_lidas`, `punches_inseridas`
   - `punches_skip_no_employee`, `punches_skip_no_date`, `punches_skip_few_marks`
   - `recalc_added_from_registros`, `active_employees_added`
5. Consolidação por `employee_id` para evitar duplicidade por variação de nome.
6. Paginação adicionada em relatórios (`extra_times` e `time_cards`) para evitar truncamento por página única.
7. `group_by` forçado para `employee` (não equipe).
8. Equipes do Ponto Mais desconsideradas; priorização das equipes existentes no Workflux.

### Base de dados (produção linked)
1. Limpeza/normalização de registros de fallback em competência de setembro.
2. Backfill para exibir todos os ativos no resumo quando necessário para visibilidade total.
3. Dedup por `employee_id` na competência alvo.

---

## Estado atual confirmado (últimas medições)

### Competência 2026-09
- `ponto_he_resumo_mensal`: **489** linhas (ativos visíveis)
- Com movimento real: **9**
- Zerados: **480**
- `ponto_registros`: **178** batidas, de **9** `staff_id`

### Últimos `pontomais_sync_runs`
Padrão recorrente:
- `rows_lidas = 77`
- `rows_agrupadas = 489` (com complementação de ativos)
- `punches_rows_lidas = 122`
- `punches_inseridas = 0`
- `skip_few_marks = 45`
- `active_employees_added = 480`

### Evidência de escopo na origem
`upstream_heading.created_by_name = "AILA BRAGA RODRIGUES"`

Interpretação: há forte indício de que o token/contexto atual da API Ponto Mais está retornando **escopo parcial** (não universo global), mesmo após ajustes no Workflux.

---

## Conclusão técnica de viabilidade

### Com token/escopo atual do Ponto Mais
**Não fecha** o objetivo operacional (cobertura global de batidas).

### Com token global (owner/superadmin real com visão total na API)
**É viável** fechar, pois os gargalos internos do Workflux já foram atacados.

---

## Próximo passo recomendado (GO / NO-GO final)
1. Trocar `PONTOMAIS_TOKEN` por token de conta com visão global real (owner/superadmin no Ponto Mais).
2. Rodar sync da competência.
3. Critério de aceite objetivo:
   - `rows_lidas` subir substancialmente (bem acima de 77)
   - `staff_com_batida` subir substancialmente (bem acima de 9)
   - redução material dos zerados não explicados.
4. Se **mesmo assim** permanecer parcial, registrar **NO-GO da estratégia de API atual** e migrar para alternativa oficial de extração/importação no Ponto Mais.

---

## Commits-chave desta trilha
- `5444395` restauração do histórico + aviso de fallback
- `f2dad84` sync estrutural de batidas + recálculo
- `320c05e` parser payload aninhado
- `9385878` limpeza de fallback zerado com dado real
- `25c77a6` vínculo por matrícula normalizada
- `3e57107` evitar hora fantasma + aviso sem batidas
- `6cac524` histórico diário só com batidas reais
- `b7d3014` contexto `time_cards` + diagnóstico de skips
- `5d8d4d0` extra_times como fonte de batidas quando disponível
- `19cf230` ampliar cobertura + complementar resumo por registros
- `1507166` consolidar duplicidade por `employee_id`
- `6014836` exibir todos ativos + recálculo base completa
- `cfd50ad` paginação de relatórios Ponto Mais
- `aede8fd` desconsiderar equipes Ponto Mais / priorizar Workflux
- `f5a2134` forçar `group_by=employee`

---

## Arquivos mais relevantes
- `supabase/functions/rh-pontomais-sync/index.ts`
- `src/pages/BancoHoras.tsx`
- `supabase/migrations/20260918170000_create_pontomais_sync_runs.sql`
- `docs/wf-gestao-pessoas/pontomais-api-banco-horas-playbook.md`
- `docs/wf-gestao-pessoas/checkpoint-pontomais-banco-horas-2026-09-23.md` (este arquivo)

---

## Observação operacional importante
A presença de “Mostrando N de N” sozinha **não** valida sucesso funcional. A validação correta é por batida real (`ponto_registros`) e cobertura de colaboradores com movimento no período.