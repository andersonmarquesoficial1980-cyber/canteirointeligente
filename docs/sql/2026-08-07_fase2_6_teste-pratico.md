# Teste prático — Migração de referências de pessoa para `*_employee_id`

Data: 2026-08-07
Escopo: Fases 1 a 2.6 (schema + backfills + aliases)

## 1) Build frontend (smoke)
Comando:
- `npm run build`

Resultado:
- ✅ build concluído (exit 0)
- Observação: warnings de chunk/circular chunk já existentes, sem bloquear build.

## 2) Testes automatizados existentes
Comando:
- `npm test`

Resultado:
- ✅ `1 passed` (exit 0)

## 3) Integridade de vínculo por company
Validação SQL em todos os campos `*_employee_id` migrados:
- comparou `company_id` da linha vs `company_id` do `employees.id` referenciado.

Resultado:
- ✅ `0 inconsistencias` em todos os targets.

## 4) Cobertura atual (preenchidos)
- `ci_equipes.responsavel_employee_id`: 11
- `ci_programacoes.responsavel_employee_id`: 6
- `ci_programacoes.engenheiro_responsavel_employee_id`: 1
- `employees.responsavel_employee_id`: 177
- `rdo_diarios.responsavel_employee_id`: 226
- `rdo_diarios.encarregado_employee_id`: 174
- `rdo_diarios.engenheiro_responsavel_employee_id`: 167
- `sst_inspections.administrativo_employee_id`: 92
- `sst_inspections.encarregado_employee_id`: 82
- `sst_inspections.engenheiro_employee_id`: 24
- `sst_inspections.tecnico_responsavel_employee_id`: 97

## 5) Pendências atuais (não determinísticas)
- `ci_equipes.responsavel_employee_id`: 1
- `employees.responsavel_employee_id`: 44
- `rdo_diarios.encarregado_employee_id`: 1
- `rdo_diarios.responsavel_employee_id`: 7
- `sst_inspections.administrativo_employee_id`: 1
- `sst_inspections.encarregado_employee_id`: 12
- `sst_inspections.engenheiro_employee_id`: 72
- `sst_inspections.tecnico_responsavel_employee_id`: 0

## 6) Motivo de pendência
Casos remanescentes são ambíguos ou sem candidato em `employees` (ex.: nomes compostos com `/`, homônimos, ou pessoa não cadastrada).

## 7) Status
- ✅ Migração avançou sem quebra funcional de build/testes
- ✅ Integridade de company preservada
- ⏸️ Restante depende de decisão de negócio/cadastro de pessoas faltantes
