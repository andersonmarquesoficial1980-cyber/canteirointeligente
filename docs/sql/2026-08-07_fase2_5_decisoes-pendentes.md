# Fase 2.5 — Decisões manuais pendentes (employee_id)

Base: produção (`company_id = a1b2c3d4-e5f6-7890-abcd-ef1234567890`) após Fase 2.4.

## Resumo
- Casos **sem candidato** em `employees`: precisam de cadastro/correção de funcionário ou regra específica.
- Casos **ambíguos**: existem 2+ candidatos ativos e exigem decisão de negócio.

---

## 1) employees.responsavel_employee_id (44)

### Sem candidato
- `ALYSSON PETRÔNIO` — 22
- `DIEGO VALE` (inclui variante `Diego Vale`) — 21
- `CAMILA MACEDO` — 1

---

## 2) rdo_diarios.responsavel_employee_id (7) e encarregado_employee_id (1)

### Ambíguo
- `FRANCISCO ALVES` — 8 linhas no total
  - `64dfae75-eead-42ba-9201-4ba0d52bbd02` | FRANCISCO ALVES DA SILVA
  - `f5e581e6-c24a-4c6d-9c15-59b8bb0653f9` | FRANCISCO ALVES JUNIOR

---

## 3) sst_inspections.administrativo_employee_id (16)

### Ambíguo
- `PLINIO` (variante `Plínio`) — 15
  - `0654e13d-a977-49c8-9eaf-4e0e512f4899` | PLINIO DIASSIS DO NASCIMENTO
  - `c662e0b0-adfb-4282-9f0e-f0290e44e24d` | PLINIO MOREIRA

### Sem candidato
- `EDUARDO PEREIRA DA S JUNIOR` — 1

---

## 4) sst_inspections.encarregado_employee_id (24)

### Ambíguo
- `JOSENILDO` (variante `Josenildo`) — 12
  - `8965faaa-9862-4a86-bd00-7d061b028aa7` | JOSENILDO MOREIRA CRUZ
  - `b6241b67-6b42-4cc3-93a7-9804c3a10318` | JOSENILDO DA SILVA RAMOS

### Sem candidato (nome composto)
- `Josenildo/Givanildo` — 9
- `Givanildo /Josenildo` + `Givanildo/ Josenildo` + `Givanildo/Josenildo` — 3

---

## 5) sst_inspections.engenheiro_employee_id (72)

### Ambíguo
- `Gabriel` — 19
  - `2b87c7ef-1933-4885-9aa8-6cb1260ba53b` | GABRIEL DE OLIVEIRA PASSOS
  - `65761fac-fac4-4664-b6a4-c3ed18d8ff3b` | GABRIEL EVARISTO
- `Bruno` — 14
  - `bffd82cf-edfe-49e3-b4dd-5dd8ca4c120c` | BRUNO ALVES DE LIMA
  - `5d16152b-c1fa-46e7-8266-1c9f1bf30717` | BRUNO MANOEL F DOS SANTOS
  - `6ab92903-8fe5-4ab9-98d8-e55c8ea5ba96` | BRUNO SANTOS E SILVA
- `Alan` (inclui `ALAN`) — 2
  - `cf2f1452-8f65-4868-9514-e15aa2ef10fb` | ALAN CARLOS DA COSTA
  - `8895d02d-a770-482d-bfd7-6966093b0677` | ALAN DIAS DA SILVA
  - `affa55a6-dcef-4d7b-9c2d-e3d1f0923dcf` | ALAN KARDEC CARVALHO MOREIRA
- `PLINIO` — 2
  - `0654e13d-a977-49c8-9eaf-4e0e512f4899` | PLINIO DIASSIS DO NASCIMENTO
  - `c662e0b0-adfb-4282-9f0e-f0290e44e24d` | PLINIO MOREIRA

### Sem candidato
- `Alan Freitas` — 15
- `ALAN DE FREITAS SANTOS` + `Alan De Freitas Santos` — 10
- `Élsio junior` — 3
- `GEISSON ALAN` + `Geisson` — 3
- `Além Freitas` — 1
- `Brunno Gonçalves` — 1
- `Elcio Jr.` — 1
- `Gabriel Dos Santos Avaristo` — 1

---

## 6) sst_inspections.tecnico_responsavel_employee_id (3)

### Ambíguo
- `Alan` — 3
  - `cf2f1452-8f65-4868-9514-e15aa2ef10fb` | ALAN CARLOS DA COSTA
  - `8895d02d-a770-482d-bfd7-6966093b0677` | ALAN DIAS DA SILVA
  - `affa55a6-dcef-4d7b-9c2d-e3d1f0923dcf` | ALAN KARDEC CARVALHO MOREIRA

---

## 7) Outros
- `ci_equipes.responsavel_employee_id`: `DIEGO VALE` — 1 (sem candidato)

