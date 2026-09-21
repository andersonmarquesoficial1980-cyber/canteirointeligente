# WF Programador — Auditoria de Sincronização (2026-09-21)

## Objetivo
Validar se alterações no WF Programador refletem corretamente nos módulos mestres:
- WF Gestão de Pessoas (`employees`)
- WF Gestão de Frotas (`equipamentos`)

## Escopo e método
- Auditoria **read-only** via `npx supabase db query --linked`
- Validação de:
  1. Domínio de status em tabelas mestres
  2. Consistência de demissão (`status` x `data_demissao`)
  3. Consistência equipe/setor com `ci_equipes`
  4. Existência de tabelas de auditoria de movimentação usadas pelo front

## Achados

### 1) Status em `employees`
Distribuição atual:
- `ativo`: 493
- `demitido`: 126
- `afastado`: 8
- `ferias`: 4
- `inativo`: 2

Não canônicos no padrão vigente do Programador (ativo/afastado/ferias/demitido): **2**
- `inativo` (2 registros)

### 2) Status em `equipamentos`
Distribuição atual:
- `ativo`: 140
- `devolvido`: 10
- `em_manutencao`: 4
- `MANUTENÇÃO`: 3
- `inativo`: 1
- `disposicao`: 1

Não canônicos no padrão vigente do Programador: **3**
- `MANUTENÇÃO` (3 registros; legado textual)

### 3) Regras de desligamento (`employees`)
- `demitido` sem `data_demissao`: **0**
- não `demitido` com `data_demissao` preenchida: **0**

### 4) Consistência equipe/setor com `ci_equipes`
- `employees.equipe` sem correspondência em `ci_equipes`: **0**
- `equipamentos.setor` sem correspondência em `ci_equipes`: **0**

### 5) Achado crítico estrutural
No banco ligado ao ambiente analisado **não existem** as tabelas:
- `ci_mov_funcionarios`
- `ci_mov_equipamentos`

Tabelas `ci_*` existentes:
- `ci_centros_custo`, `ci_documentos`, `ci_equipes`, `ci_integracoes`, `ci_programacoes`

Impacto:
- Fluxos que inserem primeiro em `ci_mov_*` e só depois sincronizam cadastro mestre podem aparentar "desconexão".

## Correções aplicadas no front nesta rodada
Arquivo principal: `src/pages/ProgramadorHome.tsx`

1. **Sincronização do mestre priorizada**
   - Movimentações de funcionário/equipamento agora atualizam `employees` / `equipamentos` primeiro.
2. **Auditoria desacoplada**
   - Inserção em `ci_mov_*` virou etapa de auditoria não bloqueante; em erro, sincronização do cadastro permanece.
3. **Feedback explícito de degradação**
   - Toast de "cadastro sincronizado (auditoria pendente)" quando `ci_mov_*` falha.

## Risco residual
- Persistem valores legados de status no banco (2 em `employees`, 3 em `equipamentos`).
- Não bloqueiam operação após a normalização em runtime, mas devem ser saneados para eliminar ruído analítico.

## Próximo passo recomendado (com autorização explícita)
Executar saneamento SQL **não destrutivo** em produção para normalizar:
- `employees.status='inativo' -> 'afastado'` (ou regra RH definida)
- `equipamentos.status='MANUTENÇÃO' -> 'em_manutencao'`

> Observação: alteração de dados em produção requer confirmação explícita prévia.
