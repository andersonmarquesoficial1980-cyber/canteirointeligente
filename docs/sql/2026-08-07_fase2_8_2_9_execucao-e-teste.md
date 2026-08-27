# Fase 2.8/2.9 — execução segura + teste prático

Data: 2026-08-10

## O que foi aplicado (somente casos determinísticos)

### 1) RDO encarregado (match exato por nome)
- `VITOR MAÇAL COLASSIO` -> `1b77c3e6-88dd-4cb4-be38-2f3d0a994426`
- `AELSON ROMEU COUTINHO` -> `2b47ca3b-b43e-4a26-9428-69b1f6470d16`
- `JOSENILDO DA SILVA RAMOS` -> `b6241b67-6b42-4cc3-93a7-9804c3a10318`

### 2) SST encarregado composto com '/'
- regra aplicada: primeira parte antes de `/` com alias explícito.
- zerado `sst_inspections.encarregado_employee_id`.

### 3) SST técnico
- `Alan Dias` (alias explícito) preenchido.

### 4) SST engenheiro
- `Gabriel Evaristo` foi atualizado pontualmente por `id` (match determinístico no registro).

## Resultado consolidado de pendências atuais
- `ci_equipes.responsavel_employee_id`: 1
- `employees.responsavel_employee_id`: 44
- `rdo_diarios.encarregado_employee_id`: 1
- `rdo_diarios.responsavel_employee_id`: 7
- `sst_inspections.administrativo_employee_id`: 1
- `sst_inspections.encarregado_employee_id`: 0
- `sst_inspections.engenheiro_employee_id`: 72
- `sst_inspections.tecnico_responsavel_employee_id`: 0

## Integridade
Validação de cross-company (`linha.company_id` vs `employees.company_id`):
- ✅ 0 inconsistências em todos os campos `*_employee_id` migrados.

## Teste prático executado após a rodada
- `npm run build` -> ✅ exit 0
- `npm test` -> ✅ 1 passed / exit 0

## Observação
Restante pendente é ambíguo ou sem funcionário correspondente cadastrado em `employees` (ex.: `FRANCISCO ALVES`, `DIEGO VALE`, `ALYSSON PETRÔNIO`, `EDUARDO PEREIRA DA S JUNIOR`, e massa de `engenheiro_obra` abreviado em SST).
