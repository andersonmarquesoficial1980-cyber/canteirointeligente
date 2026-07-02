# 🧪 GUIA DE TESTES PRÁTICOS - Relatório Localização de Equipamentos (RDO)

## 1️⃣ Preparação do Ambiente

```bash
cd /Users/andinhomarques/canteirointeligente

# Verificar que está no branch correto
git log --oneline -1
# Esperado: feat: add obra+encarregado filters + PDF/Excel exports to equipment report

# Confirmar build
npm run build
# Esperado: ✓ built in X segundos (sem errors)
```

## 2️⃣ Iniciar Dev Server

```bash
npm run dev
# Esperado:
#   ➜  Local:   http://localhost:5173/
#   ➜  Press h + enter to show help
```

## 3️⃣ Navegar até a Página

1. Abrir browser: `http://localhost:5173`
2. Login com credenciais de teste
3. Navegar: Relatórios → Localização de Equipamentos (RDO)
4. Verificar: Página carrega sem erros no console

## 4️⃣ Testes Manuais - Happy Path

### TESTE 1: Filtro "Por Frota" (Original Mantido)

```
Passo 1: Page carrega
✓ Verificar: Radio buttons [Por Frota] [Por Obra] [Por Encarregado] presentes
✓ Verificar: [Por Frota] está selecionado por padrão

Passo 2: Input frota
✓ Digite: "FA"
✓ Pressione: Enter OU clique "Buscar"
✓ Verificar: Tabela mostra equipamentos com frota contendo "FA"
✓ Verificar: Conversão de status: "Buscando..." → "Buscar"

Passo 3: Validação RLS
✓ Verificar: Apenas dados da sua empresa aparecem
✓ Verificar (backend): SELECT company_id FROM rdo_equipamentos WHERE company_id = <seu_id>

Passo 4: Export PDF
✓ Clique: "Exportar PDF"
✓ Download inicia: relatorio-equipamentos-YYYY-MM-DD.pdf
✓ Abrir PDF e verificar:
  - Título: "Localização de Equipamentos (RDO)"
  - Metadados: "Filtro: FROTA = FA"
  - Tabela com 5 colunas: Data | OGS | Frota | Equipamento | Turno
  - Página numeração: "Página 1 de X"
  - Datas formatadas: DD/MM/YYYY

Passo 5: Export Excel
✓ Clique: "Exportar Excel"
✓ Download inicia: relatorio-equipamentos-YYYY-MM-DD.xlsx
✓ Abrir arquivo e verificar:
  - Linha 1: "LOCALIZAÇÃO DE EQUIPAMENTOS (RDO)" (bold)
  - Linhas 3-7: Metadados (Filtro, Data Início, Data Fim, Total, Gerado em)
  - Linha 9: Headers (Data | OGS | Frota | Equipamento | Turno)
  - Linhas 10+: Dados com datas formatadas DD/MM/YYYY

Passo 6: Export Tela
✓ Clique: "Tela"
✓ Verificar: Tabela continua visível na página (nenhuma ação visual)
✓ Abrir console (F12): Log "Exibindo na tela: X registros"
```

### TESTE 2: Filtro "Por Obra" (NOVO)

```
Passo 1: Selecionar filtro
✓ Clique: [Por Obra]
✓ Verificar: Input de frota desaparece
✓ Verificar: Aparece dropdown "Selecione uma obra..."
✓ Verificar: Dropdown começa a carregar ("Carregando...")

Passo 2: Dropdown carrega
✓ Aguarde: 2-3 segundos
✓ Verificar: Lista de obras aparece
✓ Verificar: São UNIQUEs (sem duplicatas)
✓ Verificar: Ordenadas alfabeticamente

Passo 3: Selecionar obra
✓ Clique: Uma obra da lista
✓ Verificar: Botão "Buscar" agora habilitado
✓ Clique: "Buscar"
✓ Verificar: Tabela mostra apenas equipamentos dessa obra
✓ Verificar: Coluna "OGS" mostra nome da obra selecionada em todos

Passo 4: Validação de dados
✓ Verificar: Data range filter funciona (Date Início + Data Fim)
✓ Preencha: Data Início = 01/01/2024
✓ Clique: "Buscar"
✓ Verificar: Apenas registros >= 01/01/2024 aparecem

Passo 5: Export (repetir como Teste 1)
✓ Exportar PDF: Filtro mostra "OBRA = [nome da obra]"
✓ Exportar Excel: Metadados corretos
```

### TESTE 3: Filtro "Por Encarregado" (NOVO)

```
Passo 1: Selecionar filtro
✓ Clique: [Por Encarregado]
✓ Verificar: Aparece dropdown "Selecione um encarregado..."
✓ Verificar: Dropdown carrega ("Carregando...")

Passo 2: Dropdown carrega
✓ Aguarde: 2-3 segundos
✓ Verificar: Lista de encarregados
✓ Verificar: São ÚNIQUES
✓ Verificar: Ordenados alfabeticamente

Passo 3: Selecionar encarregado
✓ Clique: Um encarregado
✓ Verificar: Botão "Buscar" habilitado
✓ Clique: "Buscar"
✓ Verificar: Equipamentos apenas desse encarregado

Passo 4: Combinar com data range
✓ Preencha: Data Fim = 30/06/2024
✓ Clique: "Buscar"
✓ Verificar: Filtro aplicado corretamente

Passo 5: Exports
✓ PDF: "Filtro: ENCARREGADO = [nome]"
✓ Excel: Metadados corretos
```

## 5️⃣ Testes de Edge Cases

### EDGE CASE 1: Zero Resultados

```
Filtro: "Por Frota" = "XXXX" (não existe)
✓ Clique: "Buscar"
✓ Verificar: Mensagem "Nenhum registro encontrado para o filtro selecionado."
✓ Verificar: Botões de export DESABILITADOS
```

### EDGE CASE 2: Botão Desabilitado Vazio

```
Página carrega
✓ Verificar: Botão "Buscar" está DESABILITADO (cinzento)
✓ Digite: Frota vazia, obra não selecionada
✓ Verificar: Botão segue DESABILITADO
✓ Preencha: Algo no filtro
✓ Verificar: Botão habilita (azul)
```

### EDGE CASE 3: Mudança Rápida de Filtro

```
Passo 1: Por Frota + buscar
✓ Clique: [Por Frota]
✓ Digite: "FA"
✓ Clique: "Buscar"
✓ Aguarde: Resultados carregam

Passo 2: Trocar para Por Obra
✓ Clique: [Por Obra]
✓ Verificar: Campo frota limpa
✓ Verificar: Dropdown obra carrega
✓ Verificar: Tabela anterior ainda mostra dados antigos (até nova busca)
```

### EDGE CASE 4: Data Range Inválida

```
Passo 1: Definir datas incorretas
✓ Data Início: 30/06/2024
✓ Data Fim: 01/01/2024 (antes da início)
✓ Clique: "Buscar"
✓ Verificar: Tabela mostra vazia ou avisa (comportamento esperado)
```

### EDGE CASE 5: PDF com Muitos Registros

```
Filtro: Que retorna 100+ registros
✓ Clique: "Exportar PDF"
✓ Download inicia
✓ Abrir PDF e verificar:
  - Múltiplas páginas
  - Numeração correta: "Página 1 de 3", "Página 2 de 3", etc.
  - Cabeçalho e rodapé presentes em cada página
```

## 6️⃣ Verificações de Segurança (RLS)

### Teste 1: Company ID Filtering

```bash
# No Supabase Console (SQL Editor):
SELECT COUNT(*) FROM rdo_equipamentos 
WHERE company_id = '<SEU_COMPANY_ID>';

# Depois de usar o app, verificar que:
✓ Queries sempre incluem company_id filter
✓ Nenhum dado de outra empresa aparece
```

### Teste 2: Usuário Diferente

```
Se possível com outro user:
✓ Login como Usuario B
✓ Navegar para Relatório de Equipamentos
✓ Verificar: Vê APENAS dados da sua empresa
✓ Se Usuario A visse dados diferentes, RLS quebrou ❌
```

## 7️⃣ Verificações de Compatibilidade

### Outros Relatórios

```bash
# Navegar em cada relatório e verificar que adiciona nada quebra:
✓ Relatório de Abastecimento
✓ Relatório de Funcionário
✓ Relatório de Manutenção
✓ Relatório RDO
✓ Relatório Equipamento
✓ Relatório de Programações
✓ Relatório de Notas Fiscais
✓ Relatório Checklist
```

### Console de Erros

```
F12 → Console
✓ Nenhum Error messages
✓ Nenhum Type errors
✓ Nenhum Network 404s
```

## 8️⃣ Performance

### Load Time

```
✓ Page load: < 2 segundos
✓ Dropdown load (obra/encarregado): < 1 segundo
✓ Busca (100+ registros): < 2 segundos
✓ PDF export (50+ registros): < 3 segundos
✓ Excel export (50+ registros): < 2 segundos
```

## ✅ Checklist Final

| Item | Status |
|------|--------|
| Page carrega sem erros | ☐ |
| Filtro Frota funciona | ☐ |
| Filtro Obra funciona | ☐ |
| Filtro Encarregado funciona | ☐ |
| PDF export com metadados | ☐ |
| Excel export com formatação | ☐ |
| Tela export (display) | ☐ |
| Botões desabilitados (vazio) | ☐ |
| Mensagem zero resultados | ☐ |
| RLS company_id filtering | ☐ |
| Data range filter | ☐ |
| Export buttons appear only with data | ☐ |
| Nenhum console error | ☐ |
| Nenhum outro relatorio quebrado | ☐ |
| Build sem erros | ☐ |
| TypeScript tipos corretos | ☐ |
| Backward compatible | ☐ |
| Git commit correto | ☐ |

## 🎯 Resultado Esperado

```
✅ TODOS OS TESTES PASSAM
✅ APP PRONTO PARA PRODUÇÃO
✅ COMMIT FEITO E PRONTO PARA PR
```

---

**Data de Teste**: 01/07/2024
**Desenvolvedor**: Hermes Agent
**Status**: PRONTO PARA VALIDAÇÃO
