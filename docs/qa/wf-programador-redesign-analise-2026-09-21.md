# WF Programador — Análise Profunda + Redesign (Pessoas + Equipamentos por Equipe)

Data: 2026-09-21  
Autor: Hermes (com base em análise de código + UX atual)

---

## 1) Resumo executivo (o que o gestor quer)

Transformar o **WF Programador** de um módulo de lançamento pontual em um **centro unificado de gestão operacional** para:

- localizar/alocar **Pessoas**
- localizar/alocar **Equipamentos**
- operar **por Equipe**
- com mudanças rápidas de **equipe** e **status**
- com sincronização real para os módulos:
  - **WF Gestão de Pessoas** (employees)
  - **WF Gestão de Frotas** (equipamentos)

### Regra de ouro
> Tudo que o Programador alterar deve refletir nos demais módulos sem retrabalho/manual.

---

## 2) Evidências no código atual (AS-IS)

### 2.1 Tela principal
Arquivo: `src/pages/ProgramadorHome.tsx`

- Abas: `equipes`, `funcionarios`, `equipamentos`
- Busca dados:
  - `ci_equipes` (catálogo de equipes)
  - `employees` (pessoas)
  - `equipamentos` (frotas)
  - `ogs_reference` (obras)

### 2.2 O que o módulo grava hoje

1. Programação de equipe:
- grava em `ci_programacoes`

2. Movimentação de funcionário:
- grava em `ci_mov_funcionarios`

3. Movimentação de equipamento:
- grava em `ci_mov_equipamentos`

### 2.3 Gap estrutural observado

No `ProgramadorHome.tsx`, as ações de funcionário/equipamento estão **registrando movimento**, mas **não há update explícito** em:

- `employees.equipe` / `employees.status`
- `equipamentos.setor` / `equipamentos.status`

Ou seja: aparentemente é um modelo de **log/evento**, não de **aplicação transacional imediata no cadastro mestre**.

> Isso explica a percepção de “quebrado”: o usuário espera comando operacional com reflexo direto, mas a UI parece registrar movimento sem garantir sincronização de estado mestre.

---

## 3) Diagnóstico da dor operacional

## 3.1 Fragmentação por módulo
- RH ajusta pessoa no Gestão de Pessoas
- Frotas ajusta equipamento no Gestão de Frotas
- Programador tenta orquestrar sem ser fonte de verdade

Resultado: retrabalho + divergência de estado.

## 3.2 Falta de visão por equipe
No fluxo ideal do Programador, ao escolher equipe deveria abrir:
- lista de pessoas da equipe
- lista de equipamentos da equipe
- ações inline de troca (equipe/status)

Isso hoje não ocorre de forma visual e imediata no mesmo contexto.

## 3.3 Sem “preview de impacto”
Antes de salvar, o usuário não vê claramente:
- quantos serão afetados
- quem ficará em conflito
- quem está sem integração por obra

## 3.4 Semântica mista
Campo “Status da equipe = TRABALHOU” dentro de “Programação” mistura planejamento e execução.

---

## 4) TO-BE desejado (modelo alvo)

## 4.1 Novo fluxo principal (1 tela operacional)

### Etapa A — Seleção de contexto
- Data
- Período
- Obra/OGS
- Equipe

### Etapa B — Painel unificado da equipe selecionada
Duas listas no mesmo painel:

1. **Pessoas da equipe**
   - Nome, matrícula, status atual
   - equipe atual
   - ação rápida: mudar status, mover equipe

2. **Equipamentos da equipe**
   - Frota, tipo, status atual
   - setor/equipe atual
   - ação rápida: mudar status, mover equipe

### Etapa C — Aplicação em lote + exceções
- “Aplicar para todos”
- Ajustes individuais por linha
- “Salvar alterações” com resumo:
  - atualizados com sucesso
  - conflitos/pendências

---

## 4.2 Regras de negócio obrigatórias

1. **Fonte de verdade operacional**:
- Alteração no Programador precisa refletir nos mestres (`employees` e `equipamentos`).

2. **Auditoria preservada**:
- manter trilha de movimentação (`ci_mov_*`) com:
  - antes/depois
  - usuário
  - data/hora
  - motivo/obs

3. **Precedência explícita**:
- ajuste individual sobrepõe regra em massa da equipe (definir e documentar)

4. **Validação antes de confirmar**:
- conflito de alocação no mesmo período
- pessoa inativa/afastada
- equipamento indisponível/manutenção
- integração por obra quando exigida

5. **company_id em todas as operações**:
- leitura e escrita sempre isoladas por empresa

---

## 5) Arquitetura recomendada de persistência

## 5.1 Padrão de comando + aplicação + log

Ao salvar no Programador:

1. Montar lote de mudanças (diff)
2. Validar regras
3. Aplicar no cadastro mestre:
   - `employees` (equipe/status)
   - `equipamentos` (setor/status)
4. Registrar movimento histórico em `ci_mov_*`
5. Retornar resumo transacional

## 5.2 Anti-padrão a evitar
- só gravar movimento (log) e não atualizar estado mestre
- atualizar mestre sem trilha de auditoria

---

## 6) Redesign de UX (intuitivo e visual)

## 6.1 Estrutura de tela sugerida

- Header atual mantido
- Filtro/contexto no topo
- Card “Programação de Obras” vira painel ativo
- Bloco principal com duas tabelas/cards:
  - Pessoas da Equipe
  - Equipamentos da Equipe

Cada linha com:
- status atual (badge)
- nova equipe (select)
- novo status (select)
- botão aplicar (linha) / aplicar seleção

Rodapé fixo com CTAs:
- Validar alterações
- Salvar alterações

## 6.2 Feedback obrigatório
- contador de impacto: “12 pessoas + 8 equipamentos serão atualizados”
- painel de pendências
- toast + resumo final

---

## 7) Plano de implantação por fases (seguro)

## Fase 1 — Visibilidade e edição inline (sem quebrar)
- Exibir membros por equipe (pessoas/equipamentos)
- Permitir edição inline visual (estado local)
- Sem aplicar no banco ainda

## Fase 2 — Aplicação real com auditoria
- Salvar em lote com update em `employees/equipamentos`
- Registrar em `ci_mov_*`
- Resumo transacional

## Fase 3 — Motor de validação
- conflitos, indisponibilidade, integração por obra
- bloqueios e avisos antes do commit

## Fase 4 — Consolidação e relatórios
- histórico de movimentações por período
- exportações e indicadores de consistência

---

## 8) Critérios de aceite (objetivos)

1. Selecionar uma equipe mostra imediatamente pessoas + equipamentos vinculados
2. Alterar equipe/status em qualquer item reflete nos módulos mestres após salvar
3. Histórico de movimento registra antes/depois corretamente
4. Sem divergência entre Programador, Gestão de Pessoas e Gestão de Frotas após refresh
5. Operação em lote com rollback em caso de erro parcial

---

## 9) Riscos e mitigação

- **Risco**: updates massivos sem filtro de empresa
  - Mitigação: exigir `company_id` em todas as queries

- **Risco**: inconsistência parcial (metade salva)
  - Mitigação: transação RPC/funcão SQL com retorno estruturado

- **Risco**: semântica de status confusa
  - Mitigação: separar claramente status de programação vs status operacional

---

## 10) Próximo passo técnico recomendado

Implementar primeiro a **Fase 1 + Fase 2** em um único ciclo controlado:

- UI unificada por equipe (pessoas/equipamentos)
- salvar com reflexo real nos mestres + trilha de auditoria

Isso já entrega o ganho principal pedido pelo gestor (orquestração central no Programador) sem esperar fases avançadas.
