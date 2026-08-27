# Fase 2 — Validação em Produção (GPS Saída + Justificativa)

## Objetivo
Validar que o WF Carreteiros:
1. continua lançando saída sem travar operação;
2. exige justificativa quando não houver GPS de saída;
3. registra justificativa no relatório e no Excel.

---

## Pré-condições
- Migração aplicada no Supabase (colunas + constraint).
- Front deployado.
- Navegador com cache limpo (`Cmd+Shift+R`).

---

## Cenário A — Saída com GPS disponível
1. Acessar `WF Carreteiros > Saída`.
2. Permitir localização no navegador.
3. Lançar uma saída completa.

**Esperado**
- Lançamento salvo sem pedir justificativa.
- No relatório: coluna `GPS Saída` com link `Mapa`.
- Coluna `Justificativa GPS Saída`: `GPS registrado`.

---

## Cenário B — Saída sem GPS (simulação real de campo)
1. Bloquear localização do navegador **ou** operar em condição sem fix rápido.
2. Lançar saída.

**Esperado (passo 1)**
- Sistema pede `Justificativa obrigatória`.
- Sem motivo selecionado, não conclui envio e mostra mensagem de orientação.

3. Selecionar um motivo padronizado (ex.: `Sem sinal na rodovia`) e reenviar.

**Esperado (passo 2)**
- Saída é salva normalmente (sem bloqueio operacional).
- `departure_geo` permanece nulo.
- `departure_gps_issue_reason` salvo com motivo selecionado.

4. Repetir com motivo `Outro motivo` sem observação.

**Esperado (passo 3)**
- Sistema exige observação.

5. Preencher observação e concluir.

**Esperado (passo 4)**
- `departure_gps_issue_notes` salvo com texto.

---

## Cenário C — Relatório + Excel
1. Abrir `Relatório Carreteiros` no período dos testes.
2. Confirmar nova coluna `Justificativa GPS Saída` na tabela.
3. Exportar Excel.
4. Conferir aba `Detalhe Viagens`.

**Esperado**
- Coluna `Justificativa GPS Saída` presente.
- Viagens sem GPS exibem motivo/observação.
- Viagens com GPS exibem `GPS registrado`.

---

## Queries de auditoria (SQL)
```sql
-- últimas viagens com status do GPS saída + justificativa
select
  id,
  date,
  truck_plate,
  departure_time,
  departure_geo,
  departure_gps_issue_reason,
  departure_gps_issue_notes
from public.trucker_trips
order by created_at desc
limit 30;
```

```sql
-- distribuição por motivo (últimos 30 dias)
select
  coalesce(departure_gps_issue_reason, 'SEM_JUSTIFICATIVA') as motivo,
  count(*) as total
from public.trucker_trips
where date >= current_date - interval '30 days'
group by 1
order by total desc;
```

---

## Critério de aceite
- [ ] Sem GPS, sistema exige justificativa e salva lançamento.
- [ ] Com GPS, não exige justificativa.
- [ ] Relatório tela + Excel exibem justificativa corretamente.
- [ ] Auditoria SQL confirma gravação consistente.
