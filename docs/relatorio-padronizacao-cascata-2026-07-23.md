# Relatório técnico — Padronização de filtros (Tipo → Subtipo → Frota)

Data: 2026-07-23  
Commit: `caf7b3f`  
Branch: `main`

## Objetivo
Unificar os filtros de equipamentos no Workflux para usar a base canônica do Painel de Controle (`useEquipamentoTipos`), com cascata segura Tipo → Subtipo → Frota, preservando histórico legado.

## Arquivos alterados (11)

1. `src/pages/ExportarProtheus.tsx`
   - Migração de hardcodes para `useEquipamentoTipos`.
   - Cascata Tipo/Subtipo/Frota com validação obrigatória.
   - Ajustes de labels/export (nome de aba/arquivo) usando nomenclatura oficial.

2. `src/pages/RelatoriosHome.tsx`
   - Integração com categorias canônicas.
   - Normalização e validação de seleção de tipo.
   - Reforço de consistência da etapa de escolha de frota.

3. `src/pages/EquipmentDiaryForm.tsx`
   - Subtipos dinâmicos a partir da base canônica + fallback seguro.
   - Regras de reset em cascata entre tipo/subtipo/frota.

4. `src/pages/AbastecimentoHome.tsx`
   - Substituição do catálogo legado por `useEquipamentoTipos`.
   - Inclusão explícita de subtipo nos fluxos (múltiplo e simplificado).
   - Persistência priorizando subtipo em `equipment_type` quando disponível.

5. `src/pages/TransporteEquipamentos.tsx`
   - Cascata completa Tipo → Subtipo → Equipamento (frota).
   - Validação de submit exigindo seleção consistente.

6. `src/pages/MeusLancamentos.tsx`
   - Filtros com subtipo e frota derivados de base canônica.
   - Persistência de filtros atualizada (inclui subtipo).
   - Compatibilidade com histórico via normalização de tipo/frota.

7. `src/pages/AdminLancamentos.tsx`
   - Filtros administrativos alinhados ao padrão canônico.
   - Query e filtragem com tipo/subtipo/frota e fallback para legado.

8. `src/pages/RelatorioAbastecimento.tsx`
   - Cascata Tipo → Subtipo → Frota aplicada ao relatório.
   - Ajuste de label contextual e bloqueios seguros quando não há frota.

9. `src/pages/RelatorioEquipamentosRdo.tsx`
   - Migração para `useEquipamentoTipos`.
   - Cascata completa no modo “Por Frota”.
   - Mensagens de no-data orientadas por subtipo/frota.

10. `src/pages/BuscaEquipamentos.tsx`
    - Inclusão de subtipo no fluxo de busca.
    - Frota dependente de subtipo.
    - Query ajustada para subtipo e categoria canônica.

11. `src/pages/RelatorioEquipamento.tsx`
    - Ajustes de padronização/compatibilidade com a nova base de filtros no ciclo atual.

## Segurança aplicada
- Sem migração destrutiva.
- Sem update/delete em massa de histórico.
- Fallback seguro para dados legados.
- Implementação incremental por tela com validação contínua.

## Validação técnica
- Build de produção executado após os lotes finais:
  - `npm run build`
  - Status: **OK** (`✓ built`)

## Git
- Commit local criado:
  - `caf7b3f feat(relatorios): padroniza cascata tipo-subtipo-frota`
- Push remoto concluído:
  - `main -> origin/main`

## Checklist de homologação (recomendado)
1. Abrir app em produção/homolog.
2. Forçar recarga (`Cmd + Shift + R`).
3. Validar nas telas alteradas:
   - seleção Tipo > Subtipo > Frota
   - reset em cascata correto
   - resultados com e sem frota
4. Validar exportações críticas:
   - Exportar Protheus
   - Relatório de Abastecimento
5. Confirmar que registros históricos antigos continuam visíveis.
6. Se houver divergência, usar checkpoints/diff do dia para rollback pontual.
