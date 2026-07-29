# Workflux Reports API v1

API read-only para integração de relatórios com sistemas externos (Protheus, Power BI, ETL).

## Base URL (Supabase Edge Function)

```text
https://ucgcqexunnsrffzrfhqu.supabase.co/functions/v1/reports-api-v1/{report_key}
```

Também aceita:

```text
.../reports-api-v1?report={report_key}
```

## Autenticação

Header obrigatório:

```http
x-api-key: <SUA_API_KEY>
```

A chave é validada por hash na tabela `wf_api_clients`.

## Query params padrão

Obrigatórios:
- `company_id` (UUID)
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)

Opcionais:
- `page` (default 1)
- `page_size` (default 200, max 500)

Regras:
- Janela máxima por requisição: **90 dias**
- `page_size` máximo: **500**

## Endpoints v1

## 0) RDO-FREMIX (ADM Engenharia)
`report_key`: `rdo-fremix`

API consolidada para o ADM da Engenharia com 5 blocos:
- medições de terceiros (`terceiros_medicoes`)
- notas fiscais de massa (`rdo_nf_massa`)
- notas fiscais de concreto (`rdo_nf_concreto`)
- produções dos RDOs (`rdo_producao`)
- equipamentos do módulo geral (`equipment_diaries`)

Retorno: objeto `secoes` com totais e linhas por bloco.

Filtros opcionais:
- `tipo_rdo` (ex.: `CAUQ`, `INFRAESTRUTURA`, `PAVIMENTACAO`, `INFRA`) — quando omitido, retorna **todos** os tipos de RDO no período.

Separação de produção no próprio retorno:
- `secoes.producao_pavimentacao_rdos` (linhas de RDO CAUQ/Pavimentação)
- `secoes.producao_infra_rdos` (linhas de RDO Infraestrutura)
- `secoes.producao_rdos` permanece como visão consolidada (compatibilidade retroativa)

Parâmetros suportados no endpoint `rdo-fremix`:
- `company_id` (obrigatório)
- `start_date` (obrigatório)
- `end_date` (obrigatório)
- `page` (opcional; default 1)
- `page_size` (opcional; default 200; máximo 500)
- `tipo_rdo` (opcional)

Campos da seção `notas_fiscais_massa.rows` (padrão integração WF_NotasFiscais):
- `data_rdo` → Data
- `apontador` → Apontador
- `encarregado` → Encarregado
- `obra_nome` → OGS
- `contratante` → Contratante
- `local` → Local
- `nf` → NF (com sigla/prefixo da usina, ex.: `ELL-042563`)
- `nf_numero` → número bruto da NF sem prefixo (campo técnico)
- `placa` → Placa
- `usina` → Usina
- `tipo_material` → Tipo Material
- `tonelagem` → Tonelagem(t)

Campos técnicos adicionais:
- `id` (identificador único da nota)
- `created_at`
- `updated_at` (temporariamente espelhando `created_at` até existir coluna própria de atualização em `rdo_nf_massa`)
- `tipo_rdo`

Identificação incremental recomendada:
- Chave primária de registro: `id`
- Marcador temporal: `updated_at` (no estado atual é equivalente a `created_at`)

Campos da seção `notas_fiscais_concreto.rows` (homologação Engenharia):
- `numero_nf` / `nf`
- `concreteira` / `fornecedor`
- `fck` (numérico em MPa quando identificado; ex.: `30`)
- `fck_descricao` (texto original; ex.: `FCK 30 MPa`)
- `placa_betoneira` (somente quando valor tem formato de placa)
- `codigo_equipamento_origem` (valor bruto recebido no campo `equipamento`)
- `volume_m3`
- `obra_ogs`
- `local_aplicacao`

Campos da seção `producao_rdos.rows` adicionados para produção:
- `ogs` (alias de `obra_nome`)
- `sentido`, `faixa`
- `estaca_inicial`, `estaca_final`
- `km_inicial`, `km_final`
- `trecho`
- `encarregado`, `contratante`, `local`, `created_at`, `updated_at`
- `retrabalho` (controle técnico; usado em Infra)

Separação por tipo de RDO no payload:
- `producao_pavimentacao_rdos.rows`: campos comuns + `faixa` (não inclui `retrabalho`)
- `producao_infra_rdos.rows`: campos comuns + `retrabalho` (alias compatível: `retrababalho`) e sem `faixa`
- `producao_inconsistencias_classificacao.rows`: linhas classificadas como CAUQ com `tipo_servico` de Infra (auditoria de qualidade)

Campos da seção `equipamentos_modulo_geral.rows` (módulo geral de equipamentos):
- `data`, `ogs`, `contratante`, `local`
- `equipamento_tipo`, `equipamento_frota`, `operador`, `turno`, `status_obra`
- `horimetro_inicial`, `horimetro_final`, `horimetro_trabalhado`
- `odometro_inicial`, `odometro_final`, `km_rodado`

## 1) RDO Summary
`report_key`: `rdo/summary`

Filtros opcionais: `obra`, `turno`, `status`

Retorna agregação por data/obra/tipo/turno com:
- `total_rdos`
- `enviados`
- `pendentes`

## 2) RDO Details
`report_key`: `rdo/details`

Filtros opcionais: `obra`, `encarregado`, `engenheiro_responsavel`, `status`

Retorna RDO detalhado paginado.

## 3) Equipamentos Utilização
`report_key`: `equipamentos/utilizacao`

Filtros opcionais: `categoria`, `tipo`, `frota`, `obra`

Retorna uso agregado por frota/categoria/tipo/subtipo/empresa dona.

## 4) Abastecimento Consumo
`report_key`: `abastecimento/consumo`

Filtros opcionais: `frota`, `comboio_fleet`

Retorna:
- linhas de abastecimento
- `total_litros`
- saldos atuais de comboio (`comboio_saldo`)

## 5) Produção Infra
`report_key`: `producao/infra`

Filtro fixo: `tipo_rdo = INFRAESTRUTURA`

Filtro opcional: `obra`, `tipo_servico`

## 6) Produção Pavimentação
`report_key`: `producao/pavimentacao`

Filtro fixo: `tipo_rdo = CAUQ`

Filtro opcional: `obra`, `tipo_servico`

## 7) Transportes Performance
`report_key`: `transportes/performance`

Filtro fixo: `equipment_type = Carreta`

Filtro opcional: `frota`

Retorna diário com km inicial/final, km percorrido e quantidade de viagens.

## Envelope de resposta

```json
{
  "meta": {
    "report": "rdo/summary",
    "company_id": "...",
    "generated_at": "2026-07-21T18:40:00.000Z",
    "duration_ms": 132
  },
  "data": {
    "total": 123,
    "rows": []
  }
}
```

## Segurança e auditoria

- Tabela de clientes: `wf_api_clients`
- Tabela de logs: `wf_api_access_logs`
- Rate limit por cliente (`rate_limit_per_minute`)
- Escopos por chave (`allowed_reports[]`)

## Exemplo de consumo (Power BI / ETL)

```bash
curl -s \
  -H "x-api-key: <SUA_API_KEY>" \
  "https://ucgcqexunnsrffzrfhqu.supabase.co/functions/v1/reports-api-v1/rdo/summary?company_id=UUID_EMPRESA&start_date=2026-07-01&end_date=2026-07-21"
```

## Próximos passos de implantação

1. Aplicar migration `20260721153000_reports_api_v1_foundation.sql`
2. Deploy da function `reports-api-v1`
3. Cadastrar primeira chave em `wf_api_clients`
4. Testar 1 endpoint piloto (RDO summary)
5. Homologar com Power BI
6. Liberar para Protheus
