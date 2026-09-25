# Workflux — Migração de conferência de ponto para PDF PontoMais (por equipe)

Data: 2026-09-25  
Contexto: Banco de Horas (WF Gestão de Pessoas)

## Objetivo
Trocar a fonte primária de conferência do Banco de Horas:
- **Sai:** API PontoMais como fonte oficial de fechamento
- **Entra:** **PDF exportado do site PontoMais por equipe/competência**

Meta operacional: **cobertura de 100% dos funcionários ativos** antes de fechar competência.

---

## Decisão de arquitetura

1. **Fonte oficial mensal:** PDF(s) PontoMais
2. API vira **auxiliar** (telemetria/diagnóstico), não critério de fechamento.
3. Pipeline em 3 estágios:
   - `upload` (arquivo + metadados)
   - `prévia` (parsing + reconciliação com employees)
   - `apply` (upsert não-destrutivo em resumo + batidas)
4. Fechamento da competência passa a exigir regra de cobertura mínima.

---

## Escopo técnico (implementado neste pacote)

### Banco (migração SQL)
Arquivo: `supabase/migrations/20260925150000_pontomais_pdf_import_pipeline.sql`

Inclui:
- Tabelas de trilha de importação:
  - `ponto_he_import_jobs`
  - `ponto_he_import_arquivos`
  - `ponto_he_import_colaboradores`
  - `ponto_he_import_batidas`
- Constraints/índices para idempotência
- RLS por `company_id` (select + write para perfis permitidos)
- Funções:
  - `fn_ponto_he_pdf_precheck(p_job_id)`
  - `fn_ponto_he_pdf_apply(p_job_id, p_observacao)`
- Endurecimento do fechamento:
  - `fn_ponto_he_fechar_competencia` agora valida cobertura

Arquivo adicional: `supabase/migrations/20260925162000_ponto_he_stage_payload_rpc.sql`
- Função para stage via payload estruturado (parser externo ou integração):
  - `fn_ponto_he_pdf_stage_payload(p_job_id, p_payload jsonb)`

### SQL read-only para operação
Arquivo: `supabase/queries/ponto_he_pdf_cobertura_preview.sql`

Consulta:
- cobertura de ativos x resumo da competência
- pendências por colaborador
- jobs/importações recentes e status

---

## Fluxo operacional alvo (time RH/Engenharia)

1. Selecionar competência (ex.: 2026-09)
2. Criar job de importação por equipe
3. Subir PDF(s) exportados do PontoMais
4. Parser grava staging (`ponto_he_import_*`)
5. Rodar `fn_ponto_he_pdf_precheck`
6. Corrigir pendências de vínculo (nome/matrícula) até cobertura OK
7. Rodar `fn_ponto_he_pdf_apply`
8. Conferir tela individual (`Histórico diário`)
9. Fechar competência (agora com validação de cobertura)

---

## Critérios de aceite

1. **Sem exceção de colaboradores ativos**
   - `ativos_sem_resumo = 0`
2. **Sem pendência de vínculo**
   - `colaboradores_nao_vinculados = 0` no precheck
3. **Sem processamento parcial**
   - job em status `aplicado`
4. **Fechamento bloqueia corretamente**
   - `fn_ponto_he_fechar_competencia` deve negar quando cobertura < 100%

---

## Observações de segurança e produção

- DML é **não-destrutivo** (upsert + insert idempotente)
- Não remove histórico anterior
- Todas operações escopadas por `company_id`
- Fechamento segue autorização existente (admin/RH/superadmin)

---

## Próxima fase (UI)

Sugestão de evolução da tela `BancoHoras.tsx`:
- substituir ação principal por `Importar PDF PontoMais`
- mostrar painel de prévia:
  - colaboradores no PDF
  - vinculados
  - não vinculados
  - dias/batidas inválidas
- exibir badge de cobertura antes de `Fechar Competência`

(Backend já preparado no banco por esta entrega.)
