# Auditoria — Lançamentos Caminhão Espargidor (Jul/2026)

Data: 2026-08-05
Projeto Supabase: `ucgcqexunnsrffzrfhqu`
Company: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## 1) Fonte de verdade (equipment_diaries)

Filtro aplicado:
- `equipment_fleet = 'CE01'`
- `equipment_type = 'Caminhões'`
- `status = 'enviado'`
- `date between '2026-07-01' and '2026-07-31'`

Resultado:
- **7 lançamentos**
- Datas: **01, 02, 04, 10, 14, 21, 28/07**

### Por usuário (CE01 / Jul-2026)
- `MAGNUS HENRIQUE`: **6**
- `Gustavo Souza`: **1**

## 2) Validação da fala do motorista

Comparativo de lançamentos do Magnus (Caminhões):
- CE01: 6 dias
- CE16: 7 dias

Dias em que Magnus lançou CE16 sem CE01:
- 06/07, 07/07, 09/07, 16/07, 17/07, 27/07, 31/07

Dias em que Magnus lançou CE01 sem CE16:
- 02/07, 04/07, 10/07, 14/07, 21/07, 28/07

Conclusão: há indício de **distribuição entre frotas CE01/CE16**, não de 31 lançamentos em CE01 no banco.

## 3) Cobertura mensal (Espargidores)

No período 01/07–31/07 (31 dias):
- CE01: 7 com lançamento / 24 sem
- CE02: 19 com lançamento / 12 sem
- CE03: 22 com lançamento / 9 sem
- CE04: 18 com lançamento / 13 sem
- CE16: 7 com lançamento / 24 sem

## 4) Correção sistêmica aplicada (timezone/local date)

Padronização para evitar drift de data por UTC (`toISOString().split('T')[0]`) em filtros e defaults de relatórios.

Novo util:
- `src/lib/date-local.ts` (`toLocalISODate`, `addDaysLocalISO`)

Arquivos ajustados:
- `src/pages/EquipmentDiaryForm.tsx`
- `src/pages/BuscaEquipamentos.tsx`
- `src/pages/BuscaRdo.tsx`
- `src/pages/RelatoriosHome.tsx`
- `src/pages/RelatorioAbastecimento.tsx`
- `src/pages/RelatorioChecklist.tsx`
- `src/pages/RelatorioTransportes.tsx`
- `src/pages/RelatorioControleLancamentos.tsx`
- `src/pages/RelatorioRdoTecnicoDashboard.tsx`
- `src/pages/RelatorioProgramacoes.tsx`

Build validado:
- `npm run build` ✅

## 5) Tentativa de backfill e reversão imediata (2026-08-05)

⚠️ Foi realizada uma tentativa de ajuste CE16→CE01 em 6 registros, **mas foi revertida integralmente** por decisão operacional correta: CE01 e CE16 são equipamentos distintos e não podem ser consolidados por suposição.

Reversão executada:
- **6 registros voltaram para CE16**
- datas: **06/07, 07/07, 09/07, 17/07, 27/07, 31/07**
- trilha de auditoria mantida em `observations` com marcação `[REVERTIDO 2026-08-05] ...`

Estado após reversão:
- CE01 (Magnus, jul/2026): **6**
- CE16 (Magnus, jul/2026): **7**

## 6) Plano de backfill seguro (somente com autorização explícita)

**Objetivo:** corrigir apenas dias comprovadamente lançados no campo e gravados com frota errada/ausente.

### Evidências mínimas antes de qualquer UPDATE/INSERT
1. Foto/print do celular do motorista por dia (data + frota + status).
2. Conferência com encarregado da obra (OGS e período).
3. Conferência cruzada com `equipment_time_entries` e/ou RDO do dia.

### Fluxo recomendado
1. Gerar tabela de candidatos a ajuste (somente leitura).
2. Validar com operação (Anderson + encarregado).
3. Executar correção em lote pequeno (1 semana) e revalidar relatórios.
4. Executar restante.

### Modelo SQL de prévia (somente leitura)
```sql
-- CE16 do Magnus em julho que podem ser candidatos de revisão para CE01
select id, date, equipment_fleet, equipment_type, work_status, ogs_number, client_name, created_at
from equipment_diaries
where company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  and user_id = '3d0608c6-b6b7-473b-862a-ec8d0a23920f'
  and equipment_fleet = 'CE16'
  and equipment_type = 'Caminhões'
  and status = 'enviado'
  and date between '2026-07-01' and '2026-07-31'
order by date;
```

### Modelo SQL de correção (somente após validação humana)
```sql
-- Exemplo: mudar frota de um conjunto de IDs específicos
update equipment_diaries
set equipment_fleet = 'CE01'
where id in (
  'UUID_1',
  'UUID_2'
)
and company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

> Regra: nunca corrigir por suposição de “31 dias”. Só corrigir com evidência operacional por dia.
