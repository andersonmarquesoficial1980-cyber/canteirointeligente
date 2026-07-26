# Fase 9 — Checklist Funcional Pós-Deploy (Equipe/Setor)

Data: 2026-07-26
Objetivo: validar ponta a ponta que os campos/filtros de **Equipe/Setor** usam o cadastro central (`ci_equipes`) com fallback seguro para legado.

## Pré-condições
- Fazer hard refresh: **Cmd+Shift+R**
- Logar com usuário administrador da Fremix
- Confirmar que existe pelo menos 1 equipe ativa em Painel de Controle > Equipes

---

## 1) Painel de Controle > Equipes (fonte central)
1. Abrir **Painel de Controle > Equipes**
2. Confirmar lista de equipes ativas
3. (Opcional) criar equipe de teste `ZZ_TESTE_EQUIPE`

**Esperado**
- Lista carregada
- Sem erro no salvamento

---

## 2) Gestão de Frotas > Ficha de Equipamento
1. Abrir um equipamento em **Gestão de Frotas**
2. No campo **Equipe / Setor**, validar dropdown
3. Selecionar uma equipe ativa e salvar
4. Reabrir ficha e confirmar persistência

**Esperado**
- Campo é **select** (não texto livre)
- Lista vem do cadastro central
- Salva e persiste

---

## 3) WF Programador > Movimentações
### 3.1 Funcionários (Transferência)
1. Abrir **WF Programador > Funcionários > Transferir**
2. Escolher funcionário
3. Validar **De** (origem) preenchido automaticamente quando houver
4. Validar **Para** com equipes ativas
5. Registrar movimentação

### 3.2 Equipamentos (Transferência)
1. Abrir **WF Programador > Equipamentos > Transferir**
2. Escolher frota
3. Validar **De** (origem) preenchido via setor da frota quando houver
4. Validar **Para** com equipes ativas
5. Registrar movimentação

**Esperado**
- Origem com fallback legado quando necessário
- Destino com equipes ativas
- Registro salvo sem erro

---

## 4) Programação de Obras (Programador)
1. Abrir **Programação de Obras**
2. No campo equipe, validar placeholder “equipe/setor”
3. Criar programação e salvar

**Esperado**
- Select de equipe/setor funcionando
- Programação criada sem erro

---

## 5) Relatório de Programações
1. Abrir **Relatório de Programações**
2. Filtro **Equipe / Setor**: abrir lista
3. Confirmar que aparecem equipes do cadastro central
4. Testar filtro por 1 equipe

**Esperado**
- Lista unificada (cadastro central + histórico/fallback)
- Filtro retorna registros corretos

---

## 6) Relatório RDO Técnico Dashboard
1. Abrir dashboard
2. Validar rótulo de filtro **Equipe / Setor**
3. Filtrar por equipe e conferir tabela

**Esperado**
- Filtro funciona
- Coluna exibe “Equipe / Setor”

---

## 7) Dashboards de Frotas
### 7.1 Dashboard de Frotas
1. Abrir **Gestão de Frotas > Dashboard**
2. Trocar para modo **Por Equipe/Setor**
3. Validar chips e contagens
4. Buscar por equipe/setor

### 7.2 Dashboard RDO de Frotas
1. Abrir **Gestão de Frotas > Dashboard RDO**
2. Trocar para **Por Equipe/Setor**
3. Validar chips e filtros
4. Buscar por equipe/setor

**Esperado**
- Agrupamento por equipe/setor consistente
- Sem duplicidade por variação de acento/caixa
- Busca encontra equipe/setor normalmente

---

## 8) RDO Técnico (Criar/Editar/Detalhe)
1. Abrir criação e edição de RDO técnico
2. Validar rótulo **Equipe / Setor**
3. No detalhe, validar linha **Equipe / Setor**

**Esperado**
- Rótulos padronizados
- Sem regressão de salvamento

---

## Critérios de aceite da Fase 9
- Nenhum campo operacional de equipe/setor crítico como texto livre
- Filtros principais funcionando com catálogo central e fallback legado
- Sem erro de salvamento nos fluxos testados
- Sem quebra visual após hard refresh

---

## Evidências sugeridas
- 1 print por módulo (antes/depois do filtro)
- 1 print de salvamento com toast de sucesso
- 1 print de Painel de Controle > Equipes (fonte central)
