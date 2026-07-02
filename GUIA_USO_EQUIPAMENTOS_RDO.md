# Instruções de Uso - Relatório Equipamentos RDO

## Localização dos Arquivos

### Código Principal (100% Funcional)
- **`src/pages/RelatorioEquipamentosRdo.tsx`** - Componente React refatorado
  - Busca completa com Fall back automático
  - Exportação em Excel e PDF
  - Filtros por Frota, Obra, e Encarregado

### Helpers Utilitários (Reutilizável)
- **`src/lib/equipment-helpers.ts`** - Funções auxiliares
  - `fetchEquipmentosRdo()` - Busca de equipamentos com fallback
  - `normalizeEquipment()` - Normalização de dados
  - `formatEquipmentName()` - Formatação de nomes
  - `searchEquipmentosRdo()` - Query completa parametrizada

### Documentação
- **`RESOLUCAO_EQUIPAMENTOS_RDO.md`** - Análise e solução
- **`RESUMO_EQUIPAMENTOS_RDO.sh`** - Resumo visual
- **`src/lib/queries/equipamentos-rdo.sql`** - Queries SQL de referência

## Como Usar

### Opção 1: Usar o Componente Existente (Recomendado)
Apenas navegue para a página de relatório e use normalmente:

```typescript
// src/pages/Relatorios.tsx
import RelatorioEquipamentosRdo from "@/pages/RelatorioEquipamentosRdo";

// Componente responde automaticamente aos filtros
```

### Opção 2: Usar os Helpers em Outro Componente

```typescript
import { searchEquipmentosRdo, formatEquipmentName } from "@/lib/equipment-helpers";

// Buscar equipamentos
const results = await searchEquipmentosRdo(
  "obra",
  "2509",
  "2026-06-26", 
  "2026-06-26",
  companyId
);

// Formatar nome
const formatted = formatEquipmentName(equip);
```

### Opção 3: Query SQL Direta (Supabase)

```sql
SELECT 
  rd.data,
  rd.obra_nome as ogs,
  COALESCE(e.name, rd.encarregado) as apontador,
  re.frota,
  COALESCE(re.nome, re.tipo, re.categoria, '-') as equipamento,
  re.empresa_dona as empresa,
  rd.turno
FROM rdo_diarios rd
LEFT JOIN rdo_equipamentos re ON rd.id = re.rdo_id
LEFT JOIN employees e ON rd.user_id = e.id
WHERE rd.data = '2026-06-26'
  AND rd.obra_nome = '2509'
ORDER BY rd.data DESC, re.frota;
```

## Estrutura de Dados Retornada

```typescript
interface ResultRow {
  data: string;           // YYYY-MM-DD
  ogs: string;            // obra_nome (ex: "2509")
  apontador: string;      // Nome do responsável
  frota: string;          // Ex: "BC75", "CF04", etc
  equipamento: string;    // Nome/tipo do equipamento
  empresa: string;        // Empresa dona
  turno: string;          // Turno (diurno/noturno)
}
```

## Fluxo de Busca (3 Estágios)

### Estágio 1: RDOs
```sql
SELECT id, data, obra_nome, turno, encarregado, user_id
FROM rdo_diarios
WHERE data BETWEEN ? AND ?
  AND (obra_nome = ? OR encarregado = ?)
```

### Estágio 2: Equipamentos (Primário)
```sql
SELECT frota, categoria, tipo, nome, empresa_dona, rdo_id
FROM rdo_equipamentos
WHERE rdo_id IN (...)
  AND frota ILIKE ?
```

### Estágio 3: Fallback (Se nenhum em Estágio 2)
```sql
SELECT equipment_fleet, equipment_type, ogs_number, date
FROM equipment_diaries
WHERE date IN (...)
  AND ogs_number = ?
  AND equipment_fleet ILIKE ?
```

### Estágio 4: Employees
```sql
SELECT id, name
FROM employees
WHERE id IN (...)
```

## Filtros Disponíveis

| Tipo | Campo | Exemplo | Tipo Query |
|------|-------|---------|-----------|
| Frota | `rdo_equipamentos.frota` | `BC75` | ILIKE `%BC75%` |
| Obra | `rdo_diarios.obra_nome` | `2509` | ILIKE `%2509%` |
| Encarregado | `rdo_diarios.encarregado` | `GIVANILDO BATISTA ESTEVAO` | EQ (exact) |

## Datas

- Data Início: Inclusiva (>=)
- Data Fim: Inclusiva (<=)
- Formato: YYYY-MM-DD (ISO 8601)

## Exportação

### Excel (.csv)
- Separador: `;` (ponto-e-vírgula)
- Encoding: UTF-8 com BOM
- Arquivo: `WF_EquipamentosRdo_{dataIni}_a_{dataFim}.csv`

### PDF
- Formato: Tabela HTML imprimível
- Inclui: Data do período, tipo de filtro, total de registros

## Troubleshooting

### Problema: Nenhum resultado retornado
**Solução:**
1. Verificar se o OGS existe em `rdo_diarios`
2. Verificar se há equipamentos em `rdo_equipamentos` para esse RDO
3. Tentar buscar em `equipment_diaries` diretamente
4. Verificar `company_id` está correto

### Problema: Apontador mostrando "N/A"
**Solução:**
1. O employee pode não estar cadastrado
2. `user_id` no RDO pode ser NULL
3. Fallback usa `encarregado` do RDO como alternativa

### Problema: Equipamento sem nome
**Solução:**
Pode ser que:
1. `nome` seja NULL, mas `tipo` ou `categoria` tenham valor
2. A função `formatEquipmentName()` retorna uma combinação
3. Fallback retorna "-" se tudo for NULL

## Performance

- Query de RDOs: O(n) onde n = número de RDOs
- Query de equipamentos: O(m) onde m = rdo_ids
- Query de employees: O(k) onde k = user_ids únicos
- Fallback: Apenas executado se Stage 2 retorna 0

**Tempo esperado:** < 500ms para empresa média

## Manutenção Futura

Se adicionar novas tabelas de equipamentos:
1. Adicionar a query de busca em `fetchEquipmentosRdo()`
2. Normalizar o formato em `normalizeEquipment()`
3. Testar que fallback mantém ordem correta
4. Atualizar documentação

## Suporte

Para dúvidas ou issues:
1. Verificar logs no console do navegador
2. Revisar a função `buscar()` em `RelatorioEquipamentosRdo.tsx`
3. Testar query SQL direto no Supabase Studio
4. Consultar `RESOLUCAO_EQUIPAMENTOS_RDO.md`
