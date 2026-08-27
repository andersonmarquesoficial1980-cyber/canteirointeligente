# Fase 2.7 — Continuidade segura + teste prático

Data: 2026-08-07

## Alteração aplicada
- Tratamento de `sst_inspections.encarregado_obra` com nomes compostos por `/`:
  - regra: usar a **primeira parte** antes de `/` quando já existe alias explícito.
- Script salvo: `docs/sql/2026-08-07_aliases-fase2_7-apply.sql`

## Resultado da alteração
- `sst_inspections.encarregado_employee_id`: 12 -> 0 pendências

## Teste prático executado após alteração

### 1) Build frontend
- Comando: `npm run build`
- Resultado: ✅ sucesso (exit 0)

### 2) Testes automatizados
- Comando: `npm test`
- Resultado: ✅ sucesso (1 teste / exit 0)

### 3) Integridade por company_id (SQL)
- Checagem de vínculos `*_employee_id` vs `employees.company_id`
- Resultado: ✅ 0 inconsistências

## Pendências finais atuais
- `ci_equipes.responsavel_employee_id`: 1
- `employees.responsavel_employee_id`: 44
- `rdo_diarios.encarregado_employee_id`: 1
- `rdo_diarios.responsavel_employee_id`: 7
- `sst_inspections.administrativo_employee_id`: 1
- `sst_inspections.encarregado_employee_id`: 0
- `sst_inspections.engenheiro_employee_id`: 72
- `sst_inspections.tecnico_responsavel_employee_id`: 0

## Conclusão
- Fluxo seguiu sem quebra técnica (build/teste/integridade OK).
- Pendências remanescentes são de negócio/cadastro (ambiguidade ou ausência de funcionário correspondente).
