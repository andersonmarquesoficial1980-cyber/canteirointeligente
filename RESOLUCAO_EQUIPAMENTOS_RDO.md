# Resolução: Equipamentos do RDO 26/06/2026 OGS 2509

## Problema Identificado
Os 9 equipamentos esperados (BC75, CF04, CH06, CM04, COMP-CBUQ03, FA26, OWP7I87, ROMP-CBUQ03, VA03) não estavam aparecendo no relatório "Localização de Equipamentos (RDO)".

## Análise
1. **Tabelas envolvidas:**
   - `rdo_diarios` - Tabela master dos RDOs (data, obra_nome/OGS, encarregado, turno, etc)
   - `rdo_equipamentos` - Tabela de equipamentos vinculados aos RDOs (tem rdo_id, frota, tipo, nome, empresa_dona)
   - `equipment_diaries` - Tabela alternativa de equipamentos (com equipment_fleet, ogs_number, date, etc)
   - `employees` - Tabela de funcionários para resolver nomes dos apontadores

2. **Causa provável:**
   - Equipamentos podem estar em `equipment_diaries` em vez de `rdo_equipamentos`
   - A query anterior não tinha fallback para buscar em equipment_diaries
   - Ou os equipamentos estavam sendo buscados mas com mapeamento incorreto (OGS vs obra_nome)

## Solução Implementada

### Mudanças no código (RelatorioEquipamentosRdo.tsx):

1. **Estrutura de dados atualizada:**
   - Interface `ResultRow` agora tem campos corretos:
     - `ogs` (em vez de `obra_nome`)
     - `apontador` (nome do responsável)
     - `equipamento` (tipo/categoria/nome combinado)
     - `empresa` (empresa_dona)

2. **Query em dois estágios:**
   - **Estágio 1**: Busca RDOs com filtros de data/obra/encarregado
   - **Estágio 2**: Busca equipamentos de `rdo_equipamentos` com rdo_id
   - **Estágio 3 (Fallback)**: Se nenhum equipamento encontrado, busca em `equipment_diaries` usando data e ogs_number

3. **Mapeamento de dados:**
   - Mapeia corretamente entre RDO e equipamentos
   - Suporta dois tipos de dados:
     - Via `rdo_id` (tabela rdo_equipamentos)
     - Via data + ogs_number (tabela equipment_diaries)
   - Resolve nome do apontador via employees table

4. **Exportação atualizada:**
   - Excel e PDF agora exportam com coluna de "Empresa"
   - Formato mais claro e alinhado com expectativa Anderson

## Query SQL Correta

```sql
-- Retorna os 9 equipamentos do RDO 26/06/2026 OGS 2509
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

## Resultado Esperado

**Print esperado (formato Anderson):**
- Data: 26/06/2026 (repetida 9x)
- OGS: 2509 (repetida 9x)
- Apontador: GIVANILDO BATISTA ESTEVAO (repetida 9x)
- Frota: BC75, CF04, CH06, CM04, COMP-CBUQ03, FA26, OWP7I87, ROMP-CBUQ03, VA03
- Equipamento: (nome/tipo do equipamento)
- Empresa: (empresa dona de cada equipamento)

## Testes Recomendados

1. Buscar OGS 2509 com data 26/06/2026
2. Verificar que 9 linhas são retornadas (uma para cada frota)
3. Validar que nomes dos equipamentos aparecem corretamente
4. Confirmar nomes das empresas donas
5. Verificar exportação em Excel e PDF

## Arquivos Modificados

- `/src/pages/RelatorioEquipamentosRdo.tsx` - Código principal refatorado
- `/src/lib/queries/equipamentos-rdo.sql` - Query de referência
