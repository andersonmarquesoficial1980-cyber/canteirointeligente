# Workflux — Status Navegação “Voltar” (Operação)

**Data:** 26/08/2026  
**Escopo:** módulos principais de operação (Equipamentos, RDO/Obras, Relatórios e RH)

---

## 1) Concluído ✅

- Padrão de retorno contextual foi consolidado no app.
- Fluxos críticos de lista → detalhe/edição → voltar foram estabilizados.
- Em **Meus Lançamentos**, além da navegação, foi feita redução de latência dos filtros e proteção contra respostas antigas sobrescrevendo estado novo.

### Evidências de entrega (main)
- `65abd5a` — preserva `returnTo` na edição de diário + evita recarga pesada por aba
- `dcff642` — debounce de recarga dos filtros
- `c285fe1` — desacopla rascunhos da recarga por filtro
- `add6aeb` — cache de contexto de acesso
- `a1a4324` — cache de lookup vinculado RDO↔equipamento
- `4602745` — telemetria por etapa (`wfPerf=1`)
- `5c6d66b` — cache curto de metadados de equipamentos
- `68ab4a9` — proteção anti-race (troca rápida de filtros)
- `bc8e6ba` — tratamento de erro + invalidação de requests pendentes
- `2ae777c` — limpeza final de legado textual `navigate(-1)`

---

## 2) Em observação 🟡

- **Base/Navegação (Login)**: existe menção textual “Voltar”, sem indício de regressão funcional de retorno contextual.
- Mantido em monitoramento apenas para garantir consistência visual/UX com os demais módulos.

---

## 3) Próxima fase recomendada ▶️

1. **Homologação operacional guiada (iPhone/Chrome iOS)**
   - Meus Lançamentos com troca rápida de filtros
   - Editar diário e salvar retornando ao mesmo contexto
   - RDO (visualizar/editar) preservando retorno

2. **Coleta de telemetria em produção (`?wfPerf=1`)**
   - 3 a 5 execuções por cenário
   - consolidar tempo total e etapas mais pesadas

3. **Ajuste fino orientado por dados**
   - atuar só nos pontos com maior tempo real (evitar refactor sem ganho comprovado)

---

## 4) Validação executada nesta rodada 📌

- Build de produção: **OK**
- Auditoria de padrões de back em `src/pages`:
  - `useOrigemBack`: **0**
  - `navigate(-1)`: **0**
  - `navigate(rotaVoltar...)`: **0**

---

## Resumo executivo

A frente de correção do “Voltar” e da lentidão de filtros está **concluída para operação**, com estabilização real no fluxo crítico e entregas já publicadas em `main`. A próxima fase é de homologação curta com telemetria para fechamento final de performance com evidência de campo.
