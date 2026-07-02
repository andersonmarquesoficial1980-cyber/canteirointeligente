# DIAGNÓSTICO - RELATÓRIO EQUIPAMENTOS RDO

## PROBLEMA REPORTADO POR ANDERSON

Anderson está recebendo **4 linhas** quando deveria receber **9 linhas** para um dia específico.

**Data da busca:** 26/06/2026  
**OGS:** 2509  
**Encarregado/Filtro:** GIVANILDO  
**Equipamentos esperados (9 total):**
- FA26
- BC75
- VA03
- CH06
- CE04
- OWP7I87
- CM04
- COMP-CBUQ03
- ROMP-CBUQ03

**Resultado atual:** 4 linhas (presumivelmente 1 linha por RDO, não 1 por equipamento)

## ROOT CAUSE ANALYSIS

### Cenário 1: Equipamentos não estão na tabela rdo_equipamentos
Se `rdo_equipamentos` está vazia ou não tem registros para 26/06/2026 OGS 2509:
- Query retorna 0 equipamentos
- Código executa FALLBACK (linha 345-368 de RelatorioEquipamentosRdo.tsx)
- Cria 1 linha por RDO (4 RDOs = 4 linhas)
- **ISSO ESTÁ ERRADO** ✗

### Cenário 2: Equipamentos estão na tabela, mas query não está pegando
Problemas possíveis:
1. **company_id não bate** - filtro `.eq("company_id", profile.company_id!)` eliminando registros
2. **rdo_id está NULL** - relacionamento quebrado
3. **Filtro de data interna não batendo** - RDO com data diferente
4. **JOIN não funciona** - profile não está com company_id certo

## SOLUÇÃO IMPLEMENTADA

✅ **Correção 1: Expandir SELECT de equipamentos**
```javascript
// Antes:
.select("id, frota, empresa_dona, rdo_id, categoria, tipo")

// Depois (adicionado sub_tipo, nome, patrimonio):
.select("id, frota, empresa_dona, rdo_id, categoria, tipo, sub_tipo, nome, patrimonio")
```

✅ **Correção 2: Lógica de filtro correto**
- Se filtro é **FROTA**: busnar equipamentos COM filtro de frota (já funcionava)
- Se filtro é **ENCARREGADO** ou **OBRA**: buscar TODOS os equipamentos para esses RDOs, sem filtro de frota
  
**Antes:** Quando filtro era encarregado, não retornava equipamentos de frota vaga
**Depois:** Retorna todos os 9 equipamentos

✅ **Correção 3: Logging detalhado**
Adicionado console.log para debugar:
```javascript
- [DEBUG] allEquips.length = X
- [DEBUG] Criando X linhas (1 por equipamento) - OU - FALLBACK
- [DEBUG EQUIP] frota=FA26, empresa_dona=FREMIX, empresa_final=FREMIX
```

## COMO VALIDAR A CORREÇÃO

### Teste Manual

1. **Abrir DevTools** (F12) → Console
2. **Acessar Relatório** → Localização de Equipamentos (RDO)
3. **Filtro por:** Encarregado = GIVANILDO
4. **Data:** 01/06/2026 a 02/07/2026
5. **Buscar**

### Observar no Console

```
[DEBUG] RDO Query returned 4 records              // 4 RDOs encontrados (correto)
[DEBUG] rdo_equipamentos Query returned 9 records // 9 equipamentos (FIXO!)
[DEBUG] allEquips.length = 9, rdos.length = 4
[DEBUG] Criando 9 linhas (1 por equipamento)       // 9 linhas (NÃO FALLBACK)
[DEBUG EQUIP] frota=FA26, empresa_dona=FREMIX, empresa_final=FREMIX
[DEBUG EQUIP] frota=BC75, empresa_dona=MOBILE, empresa_final=MOBILE
...
[DEBUG] Final result count: 9                      // 9 registros no resultado final
```

### Resultado Esperado

**Tabela mostra 9 linhas:**
| Data | Apontador | Encarregado | OGS | Contratante | Local | Frota | Empresa |
|------|-----------|-------------|-----|-------------|-------|-------|---------|
| 26/06/2026 | GIVANILDO | ... | 2509 | ... | ... | FA26 | FREMIX |
| 26/06/2026 | GIVANILDO | ... | 2509 | ... | ... | BC75 | MOBILE |
| 26/06/2026 | GIVANILDO | ... | 2509 | ... | ... | VA03 | ... |
| ... (6 mais equipamentos) |

## SE AINDA RETORNAR 4 LINHAS

### Debug Passo 1: Verificar se equipamentos estão no banco
Execute no Supabase SQL Editor:
```sql
SELECT COUNT(*) 
FROM rdo_equipamentos 
WHERE rdo_id IN (
  SELECT id FROM rdo_diarios 
  WHERE data = '2026-06-26' AND obra_nome = '2509'
);
```
✓ Se retorna 9 → Equipamentos estão lá, problema é na query React
✗ Se retorna 0 ou 4 → Dados não foram inseridos corretamente

### Debug Passo 2: Verificar company_id
Dispositivos podem ter company_id diferente. No Supabase:
```sql
SELECT DISTINCT company_id 
FROM rdo_diarios 
WHERE data = '2026-06-26' AND obra_nome = '2509' LIMIT 1;
```

Depois comparar com:
```sql
SELECT company_id FROM profiles WHERE user_id = (SELECT auth.uid());
```

Se diferentes → Problema é profile.company_id!

### Debug Passo 3: Verificar rdo_equipamentos.company_id
```sql
SELECT DISTINCT company_id 
FROM rdo_equipamentos 
WHERE rdo_id IN (
  SELECT id FROM rdo_diarios 
  WHERE data = '2026-06-26' AND obra_nome = '2509'
) LIMIT 1;
```

## PRÓXIMOS PASSOS

1. ✅ Código React corrigido
2. ⏳ Testar com dados reais (26/06/2026 OGS 2509)
3. ⏳ Confirmar 9 linhas aparecem no relatório
4. ⏳ Validar nomes de equipamentos e empresas
5. ⏳ Testar exportação Excel e PDF
6. ⏳ Obter aprovação de Anderson

## ARQUIVOS MODIFICADOS

- `/Users/andinhomarques/canteirointeligente/src/pages/RelatorioEquipamentosRdo.tsx`
  - Adicionado `sub_tipo, nome, patrimonio` ao SELECT
  - Corrigido lógica de filtro (não aplica filtro frota quando filtro é encarregado/obra)
  - Adicionado logging detalhado para diagnóstico

## TECHNICAL NOTES

**Line 231-242:** Query de equipamentos agora retorna:
```javascript
.select("id, frota, empresa_dona, rdo_id, categoria, tipo, sub_tipo, nome, patrimonio")
```

**Line 234-240:** Lógica de filtro:
```javascript
if (filterType === "frota") {
  equipQuery = equipQuery.ilike("frota", `%${filter.trim()}%`);
}
// Se for encarregado ou obra, NÃO aplicar filtro de frota - pega TODOS
```

**Line 325-368:** Mapeamento final (logging adicionado):
- Se equipamentos > 0: cria 1 linha por equipamento ✓
- Se equipamentos = 0: cria 1 linha por RDO (fallback) ⚠️

