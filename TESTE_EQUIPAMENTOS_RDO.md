# COMO TESTAR A CORREÇÃO - ANDERSON

## Objetivo

Validar que o Relatório de Equipamentos RDO agora retorna **9 linhas** (1 por equipamento) em vez de 4 linhas (1 por RDO).

---

## Teste Passo a Passo

### 1. Acessar o Relatório
- Ir para **Menu Principal** → **Relatórios** → **Localização de Equipamentos (RDO)**

### 2. Configurar o Filtro
Deixe exatamente assim:

| Campo | Valor |
|-------|-------|
| **Tipo de Filtro** | `Por Encarregado` |
| **Encarregado *** | `GIVANILDO` (ou qual for seu nome no sistema) |
| **Data Início** | `01/06/2026` |
| **Data Fim** | `02/07/2026` |

### 3. Clicar em "Buscar"

### 4. Verificar CONSOLE do Navegador (F12)
Abrir **DevTools** → Aba **Console** e procurar por mensagens assim:

```
[DEBUG] RDO Query returned 4 records
[DEBUG] rdo_equipamentos Query returned 9 records
[DEBUG] allEquips.length = 9, rdos.length = 4
[DEBUG] Criando 9 linhas (1 por equipamento)
[DEBUG EQUIP] frota=FA26, empresa_dona=FREMIX, empresa_final=FREMIX
[DEBUG EQUIP] frota=BC75, empresa_dona=MOBILE, empresa_final=MOBILE
...
[DEBUG] Final result count: 9
```

✅ **Se vir "Criando 9 linhas" = CORRETO**  
❌ **Se vir "FALLBACK: Criando 4 linhas" = PROBLEMA**

### 5. Verificar a Tabela
A tabela deve mostrar **9 linhas**, todas com:
- Data: 26/06/2026 (repetida 9x)
- Apontador: GIVANILDO (repetido 9x)
- OGS: 2509 (repetido 9x)
- Frota: DIFERENTE em cada linha (FA26, BC75, VA03, CH06, CE04, OWP7I87, CM04, COMP-CBUQ03, ROMP-CBUQ03)
- Empresa: Preenchida (FREMIX, MOBILE, FB LOCAÇÕES, etc)

### 6. Testar Exportação
- Clicar em **Download Excel**
- Verificar que o arquivo CSV tem 9 linhas de dados (+ cabeçalho)

---

## Resultado Esperado

### Antes (ERRADO) ❌
```
Data         | Apontador | Encarregado | OGS | ... | Frota | Empresa
26/06/2026   | GIVANILDO | ...         | 2509| ... | -     | -
26/06/2026   | GIVANILDO | ...         | 2509| ... | -     | -
26/06/2026   | GIVANILDO | ...         | 2509| ... | -     | -
26/06/2026   | GIVANILDO | ...         | 2509| ... | -     | -
```
**Total: 4 linhas** (1 linha por RDO, sem equipamentos)

### Depois (CORRETO) ✅
```
Data         | Apontador | Encarregado | OGS | ... | Frota       | Empresa
26/06/2026   | GIVANILDO | ...         | 2509| ... | FA26        | FREMIX
26/06/2026   | GIVANILDO | ...         | 2509| ... | BC75        | MOBILE
26/06/2026   | GIVANILDO | ...         | 2509| ... | VA03        | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | CH06        | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | CE04        | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | OWP7I87     | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | CM04        | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | COMP-CBUQ03 | [empresa]
26/06/2026   | GIVANILDO | ...         | 2509| ... | ROMP-CBUQ03 | [empresa]
```
**Total: 9 linhas** (1 linha por equipamento)

---

## Se Ainda Mostrar 4 Linhas

### Diagnóstico Rápido

1. **Abrir Console (F12)**
   - Procurar por: `[DEBUG] FALLBACK: Criando 4 linhas`
   - Se encontrar = Equipamentos não estão na tabela `rdo_equipamentos`

2. **Verificar Dados no Banco**
   - Ir para **Supabase Dashboard** → **Table Editor**
   - Acessar tabela `rdo_equipamentos`
   - Filtrar por RDOs de 26/06/2026 OGS 2509
   - ✓ Se houver 9 registros = Problema é na query React
   - ✗ Se estiver vazio = Dados não foram salvos corretamente

3. **Reportar para Desenvolvimento**
   - Compartilhar screenshot do console
   - Informar quantos equipamentos estão em `rdo_equipamentos`
   - Mencionar qual foi a última atualização

---

## Arquivos Alterados

- `src/pages/RelatorioEquipamentosRdo.tsx` (línhas 231-368)
  - ✅ Adicionado campos `sub_tipo`, `nome`, `patrimonio` ao SELECT
  - ✅ Corrigido lógica de filtro (não aplica filtro de frota quando é encarregado)
  - ✅ Adicionado logging para diagnóstico

---

## Contato

Se houver problemas:
1. Compartilhe o screenshot do console (F12)
2. Diga qual filtro usou e qual data
3. Confirme quantos equipamentos há no banco para aquele dia

