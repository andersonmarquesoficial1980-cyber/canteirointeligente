# Workflux — QA de Produção (Fase 2 Voltar)

Objetivo: validar que o botão **Voltar** preserva contexto (origem/filtros/período/aba/lista), especialmente em iPhone/Chrome iOS.

## Pré-check (2 min)
1. Abrir `app.workflux.com.br` no iPhone (Chrome iOS).
2. Fazer **Cmd+Shift+R** no desktop (apoio) e recarregar no iPhone.
3. Confirmar ambiente de produção atualizado (deploy com commit `d07f45d`).

## Critérios de aceite globais
- Voltar **não** joga para Home/Hub sem intenção.
- Voltar retorna para a tela de origem com contexto preservado.
- Em origem `gestao-frotas`, retorno deve priorizar `/gestao-frotas` quando aplicável.
- Sem erro visual, sem travamento e sem tela em branco.

## Roteiro de validação (prioridade alta)

### 1) Gestão de Pessoas → Férias
1. Entrar em Gestão de Pessoas.
2. Abrir Programação de Férias.
3. Acionar Voltar.

**Esperado**: retorna para Gestão de Pessoas com contexto da navegação anterior.

### 2) Gestão de Pessoas → Equipe / Gerenciamento de Ponto / VT
1. Entrar em Gestão de Pessoas.
2. Abrir Equipe (depois repetir para Ponto e VT).
3. Acionar Voltar.

**Esperado**: retorno correto para Gestão de Pessoas; sem reset indevido de contexto.

### 3) SST → Home / Inspeções / Integração / Form
1. Entrar em SST.
2. Abrir SST Home, Inspeções, Integração e Form (um por vez).
3. Acionar Voltar em cada tela.

**Esperado**: volta para rota anterior correta (ou fallback de SST), sem desviar para Home global.

### 4) SST Integração → Funcionários Docs / Obras Integração
1. Entrar em SST Integração.
2. Abrir Funcionários Docs e Obras Integração.
3. Em lista e em detalhe (quando houver), acionar Voltar.

**Esperado**: volta para SST Integração preservando estado de navegação.

### 5) Manutenção → Fila / OS / Documentos
1. Entrar em Manutenção.
2. Abrir Fila, OS e Documentos.
3. Acionar Voltar.

**Esperado**: retorno para Manutenção; sem perda de fluxo.

### 6) Carreteiros → Home / QR Print / Freight Calculator
1. Entrar em Carreteiros.
2. Abrir as três telas e acionar Voltar.

**Esperado**: retorno consistente para Carreteiros (ou origem válida).

### 7) Relatórios → Relatórios Home / Relatório Programações / Relatório Carreteiros
1. Entrar em Relatórios.
2. Abrir cada relatório e acionar Voltar.

**Esperado**: retorno para Relatórios sem quebrar filtros principais.

### 8) Demandas → Demandas Home / Minhas Demandas / Detalhes
1. Entrar em Demandas.
2. Navegar até detalhes de uma demanda.
3. Voltar sequencialmente.

**Esperado**: volta para lista correta e contexto visível.

## Matriz de evidências (preencher)
| Fluxo | Resultado | Evidência (print/vídeo curto) | Observação |
|---|---|---|---|
| GP → Férias | OK/NOK |  |  |
| GP → Equipe/Ponto/VT | OK/NOK |  |  |
| SST (Home/Inspeções/Integração/Form) | OK/NOK |  |  |
| SST Integração (Docs/Obras) | OK/NOK |  |  |
| Manutenção (Fila/OS/Docs) | OK/NOK |  |  |
| Carreteiros (Home/QR/Frete) | OK/NOK |  |  |
| Relatórios (Home/Prog/Carreteiros) | OK/NOK |  |  |
| Demandas (Home/Minhas/Detalhes) | OK/NOK |  |  |

## Definição de pronto
- 8 fluxos acima em **OK**.
- Sem regressão de retorno para Home indevido.
- Evidências anexadas para pelo menos 1 execução por fluxo.

## Plano de contingência (se NOK)
1. Registrar fluxo + rota de origem + rota que abriu incorretamente.
2. Capturar print/vídeo de 10–20s.
3. Abrir correção pontual no mesmo padrão: `useSmartBack(fallback)` + `returnTo` quando aplicável.
4. Rebuild + reteste apenas do fluxo afetado e dos adjacentes do módulo.
