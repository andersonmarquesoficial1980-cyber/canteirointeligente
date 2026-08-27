# Proposta — Normalização de Odômetro CE01 (Julho/2026)

## Diagnóstico (base atual)
Fonte: `equipment_diaries` (company_id `a1b2c3d4-e5f6-7890-abcd-ef1234567890`), frota `CE01`, tipo `Caminhões`, período `01/07–31/07`.

Anomalia encontrada:
- **21/07** está com `odometer_initial = 193435` e `odometer_final = 193435`
- O dia anterior (20/07) termina em `193816`
- Isso gera **quebra de -381 km** (volta de odômetro), que contamina a diluição dos dias 22–27.

Efeito colateral atual:
- Dias **22 a 27/07** ficaram com 68/69 km por dia (valor artificial para “fechar conta” até 28/07).

## Objetivo da normalização
- Manter continuidade do odômetro (sem regressão)
- Preservar âncoras reais já existentes:
  - 14/07 final = `193816`
  - 28/07 inicial = `193846`
- Recalcular só o bloco impactado (21→27), sem mexer no restante do mês.

## Proposta recomendada (conservadora)
Aplicar apenas neste bloco:

1. **21/07** (registro original):
   - de `193435/193435` para `193816/193816`
   - manter status `Disposição` (sem alterar status/horas)

2. **22–27/07** (backfill):
   - recalcular com diluição entre 21/07 final `193816` e 28/07 inicial `193846`
   - diferença = `30 km` em `6 dias` => **5 km/dia**

### Série proposta
- 21/07: 193816 → 193816
- 22/07: 193816 → 193821
- 23/07: 193821 → 193826
- 24/07: 193826 → 193831
- 25/07: 193831 → 193836
- 26/07: 193836 → 193841
- 27/07: 193841 → 193846
- 28/07: **mantém** 193846 → 193865

## Impacto esperado
- Remove regressão de odômetro (-381)
- Deixa o bloco 22–27 com progressão plausível e contínua
- Não altera quantidade de dias, status, operador, OGS, apontamentos

## Segurança
- Escopo: **7 linhas** (datas 21 a 27)
- Sem INSERT/DELETE
- Somente UPDATE de `odometer_initial`, `odometer_final` e trilha em `observations`

## SQL
Arquivo preparado:
- `docs/sql/proposta-normalizacao-odometro-ce01-julho-2026.sql`

Ele contém:
- prévia (before/after) para validação
- bloco de UPDATE pronto (comentado para executar só após sua autorização explícita)
