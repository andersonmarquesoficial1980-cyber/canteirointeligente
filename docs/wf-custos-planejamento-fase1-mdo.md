# WF Custos e Planejamento — Desenho Técnico Fechado (Fase 1: Relatório MDO)

Data: 2026-09-03
Escopo aprovado: iniciar em **WF Relatórios** com relatório de MDO por período, sem abrir módulo novo ainda.

---

## 1) Objetivo de negócio
Entregar para Engenharia de Custos e Planejamento um relatório auditável que responda:
- "Onde cada funcionário esteve dentro do período selecionado?"
- "Quem está no cadastro da Gestão de Pessoas e não apareceu em RDO no período?"
- "Quais vínculos são confiáveis (employee_id) e quais foram por texto (nome)?"

---

## 2) Evidências atuais (baseline real)
Fonte: consultas SQL em produção (company_id Fremix), período 2026-07-01 a 2026-07-31.

- `rdo_diarios`: 159 (119 enviados, 39 validados, 1 rejeitado)
- `rdo_efetivo`: 1.466 linhas
- `rdo_efetivo.nome` com `|||`: 399 linhas
- `rdo_efetivo.employee_id` preenchido: 492 linhas (33,56%)
- `rdo_diarios` sem efetivo: 19
- `employees` ativos: 486
- ativos com presença em RDO no período: 126
- ativos sem presença no período: 360
- empregados ativos com salário preenchido: 222/486

Conclusão técnica: usar somente `employee_id` perde cobertura; usar somente nome perde rastreabilidade. É obrigatório modelo híbrido com indicador de confiabilidade.

---

## 3) Decisão de produto (sem conflito)
### 3.1. Agora (Fase 1)
Implementar em **WF Relatórios** um novo tipo:
- `mdo_periodo` — "MDO por Período (RDO x Gestão de Pessoas)"

### 3.2. Depois (Fase 2)
Abrir módulo **WF Custos e Planejamento** para:
- custo por funcionário,
- custo por equipe,
- custo equipe + equipamento,
- planejado x realizado e cenários.

Regra de fronteira:
- **WF Relatórios** = leitura operacional/auditável
- **WF Custos e Planejamento** = inteligência de custos e planejamento

---

## 4) Arquitetura funcional da Fase 1

### 4.1 Filtros da tela
- Período (data inicial/final)
- Equipe (employees.equipe)
- Funcionário (employees.id + busca por nome)
- Obra/OGS (`rdo_diarios.obra_nome`)
- Encarregado (`rdo_diarios.encarregado`)
- Apontador (`rdo_diarios.user_id` / profiles.nome_completo)
- Status do vínculo (`id_direto`, `nome_exato`, `sem_match`)
- Exibir sem presença no período (toggle)

### 4.2 Blocos de saída
1. **KPIs**
   - funcionários ativos no cadastro
   - funcionários com presença no período
   - funcionários sem presença no período
   - lançamentos com vínculo por ID
   - lançamentos por nome
2. **Tabela detalhada (auditável)**
   - Data, Funcionário, Equipe, Função
   - OGS/Obra, Encarregado, Turno, Tipo RDO
   - Apontador (nome/e-mail)
   - `rdo_id`, `status_validacao`
   - `origem_vinculo` + `confianca_vinculo`
3. **Aba divergências**
   - nomes em RDO sem match em employees
   - ativos sem presença no período

### 4.3 Exportações
- Excel (`.xlsx`) com abas:
  - `RESUMO`
  - `DETALHE_MDO`
  - `SEM_PRESENCA`
  - `DIVERGENCIAS_NOME`
- CSV pt-BR opcional (`;` + UTF-8 BOM)
- PDF executivo (resumo + top divergências)

---

## 5) Modelo de dados e regra de vínculo

## 5.1 Fonte primária
- `rdo_diarios` (header do RDO)
- `rdo_efetivo` (MDO lançado)
- `employees` (cadastro oficial + equipe)
- `profiles` (apontador)

### 5.2 Expansão de nomes concatenados
`rdo_efetivo.nome` pode vir como `"A|||B|||C"`.
Regra: explodir em linhas individuais para análise por pessoa.

### 5.3 Ordem de matching
1. `rdo_efetivo.employee_id` preenchido → **id_direto (alta confiança)**
2. sem `employee_id`: `upper(trim(nome_lancado)) = upper(trim(employees.name))` no mesmo `company_id` → **nome_exato (média confiança)**
3. sem match → **sem_match (baixa confiança)**

> Não usar fuzzy agressivo nesta fase para não gerar falso positivo de custo.

---

## 6) Entrega técnica (arquivos a criar/alterar)

### 6.1 Novo relatório no módulo existente
- **Novo arquivo**: `src/pages/RelatorioMdoPeriodo.tsx`

### 6.2 Integração obrigatória em 3 pontos (checklist Workflux)
1. `src/pages/RelatoriosHome.tsx`
   - incluir card em `TIPOS_RELATORIO` com id `mdo_periodo`
   - navegação para `/relatorios/mdo-periodo`
2. `src/App.tsx`
   - import `RelatorioMdoPeriodo`
   - rota protegida `moduleId="relatorios"`
3. `src/components/admin/PermissoesManager.tsx`
   - incluir `mdo_periodo` em `TIPOS_RELATORIO_PERM`

### 6.3 Sem migration obrigatória para Fase 1
Implementação possível só com queries de leitura.

---

## 7) Contrato de dados do frontend (DTO sugerido)

```ts
type MdoDetalheRow = {
  data: string;
  rdo_id: string;
  status_validacao: string | null;
  tipo_rdo: string | null;
  obra_nome: string;
  encarregado: string | null;
  turno: string | null;
  apontador_user_id: string | null;
  apontador_nome: string | null;
  apontador_email: string | null;

  nome_lancado: string;
  funcao_lancada: string | null;
  matricula_lancada: string | null;

  employee_id_resolvido: string | null;
  employee_nome_resolvido: string | null;
  equipe_resolvida: string | null;
  status_employee: string | null;

  origem_vinculo: "id_direto" | "nome_exato" | "sem_match";
  confianca_vinculo: "alta" | "media" | "baixa";
};
```

---

## 8) Critérios de aceite (Fase 1)
1. Filtro por período funcionando e auditável.
2. Cada linha exportada referencia `rdo_id`.
3. "Sem presença" calcula sobre `employees.status='ativo'` da empresa.
4. Relatório mostra separadamente `id_direto` vs `nome_exato` vs `sem_match`.
5. Botões de export habilitam apenas com resultado (`rows.length > 0`).
6. Permissão granular do novo tipo em `relatorios_permitidos`.
7. Build ok + deploy + validação em produção.

---

## 9) Roadmap para módulo WF Custos e Planejamento (Fase 2)

## 9.1 Pré-requisitos de governança
- completar `employee_id` nos lançamentos de MDO (elevar de 33,56% para meta >90%)
- preencher salário/custo-hora de colaboradores (hoje há lacuna)
- definir regra de custo por status (ativo/férias/afastado)

### 9.2 Quando abrir o módulo novo
Abrir módulo novo quando Fase 1 estiver estabilizada + regras de custo aprovadas.

Itens técnicos adicionais da Fase 2:
- incluir `custos-planejamento` em `company_modules`
- adicionar permissões no `user_permissions` (ex.: `modulo_custos_planejamento`)
- atualizar `usePermissions`, `useCompanyModules`, `navigation.ts`, `Home.tsx`, `App.tsx`, `PermissoesManager.tsx`

---

## 10) Riscos e mitigação
- **Risco:** divergência nome em RDO x employees
  - **Mitigação:** coluna `origem_vinculo` + aba de divergências
- **Risco:** leitura de "sem presença" como erro de operação
  - **Mitigação:** explicitar que é presença em RDO, não folha/ponto
- **Risco:** duplicar escopo entre módulos
  - **Mitigação:** fronteira de domínio formal (Relatórios vs Custos)

---

## 11) Próximo passo autorizado
Implementação da Fase 1 em código (Relatório MDO no WF Relatórios), com rollout por fase e validação em produção.
