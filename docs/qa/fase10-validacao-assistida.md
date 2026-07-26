# Fase 10 — Validação Funcional Assistida (ao vivo)

Data: 2026-07-26
Escopo: validação ponta a ponta dos fluxos de **Equipe/Setor** após fases 1–9.

## Como usar este roteiro
- Você executa no app logado (produção).
- Para cada item, marque: **PASS** / **FAIL**.
- Em FAIL, anote evidência e impacto.

---

## Matriz de validação

| Módulo | Caso de teste | Resultado | Evidência | Observação |
|---|---|---|---|---|
| Painel de Controle > Equipes | Lista de equipes ativas carrega | PENDENTE |  |  |
| Painel de Controle > Equipes | Criar equipe de teste (opcional) | PENDENTE |  |  |
| Gestão de Frotas > Ficha | Campo Equipe/Setor é select | PENDENTE |  |  |
| Gestão de Frotas > Ficha | Salvar troca de equipe e persistir | PENDENTE |  |  |
| WF Programador > Funcionários | Transferência: origem preenchida + destino ativo | PENDENTE |  |  |
| WF Programador > Equipamentos | Transferência: origem preenchida + destino ativo | PENDENTE |  |  |
| Programação de Obras | Select equipe/setor e salvar programação | PENDENTE |  |  |
| Relatório de Programações | Filtro Equipe/Setor lista e filtra corretamente | PENDENTE |  |  |
| Relatório RDO Técnico Dashboard | Filtro Equipe/Setor aplica sem erro | PENDENTE |  |  |
| Dashboard Frotas | Modo “Por Equipe/Setor” com chips/contagens | PENDENTE |  |  |
| Dashboard RDO Frotas | Modo “Por Equipe/Setor” com chips/contagens | PENDENTE |  |  |
| RDO Técnico (Criar/Editar) | Label “Equipe / Setor” + salvamento | PENDENTE |  |  |
| RDO Técnico (Detalhe) | Exibe “Equipe / Setor” corretamente | PENDENTE |  |  |

---

## Critérios de aceite final
- 0 regressões críticas de salvamento.
- Fluxos críticos com PASS:
  - Gestão de Frotas (ficha)
  - WF Programador (funcionário/equipamento)
  - Programação de Obras
  - Relatórios principais
- Texto/rótulo consistente: **Equipe / Setor** onde aplicável.

---

## Pendências encontradas
- (preencher)

## Ações corretivas propostas
- (preencher)

## Status final Fase 10
- **EM EXECUÇÃO ASSISTIDA**
