# Workflux — Esteira Comercial de Apresentações (Plano Macro)

## 1) Inventário de módulos (fonte: `MODULE_PERM_MAP` em `src/App.tsx`)

1. Obras
2. Equipamentos
3. RH
4. Carreteiros
5. Programador
6. Demandas
7. Manutenção
8. Abastecimento
9. Documentos
10. Relatórios
11. Gestão de Frotas
12. Gestão de Pessoas
13. Medições
14. Suprimentos
15. SST
16. Engenharia
17. Encarregado

## 2) Cobertura atual de tutorial comercial

Já publicados (`docs/apresentacao/wf-<modulo>-tutorial.html`):
- wf-obras-tutorial.html
- wf-equipamentos-tutorial.html
- wf-gestao-frotas-tutorial.html
- wf-manutencao-tutorial.html
- wf-gestao-pessoas-tutorial.html

Pendentes de tutorial comercial:
- RH
- Carreteiros
- Programador
- Demandas
- Abastecimento
- Documentos
- Relatórios
- Medições
- Suprimentos
- SST
- Engenharia
- Encarregado

## 3) Priorização comercial (ordem de produção)

### Onda 1 — Alto impacto imediato (venda e operação)
1. Equipamentos ✅ (executado nesta rodada)
2. Obras (RDO)
3. Gestão de Frotas
4. Manutenção
5. Abastecimento

### Onda 2 — Expansão de valor para backoffice/gestão
6. Gestão de Pessoas
7. SST
8. Relatórios
9. Demandas
10. Documentos

### Onda 3 — Módulos especializados
11. Medições
12. Suprimentos
13. Programador
14. Carreteiros
15. RH
16. Engenharia
17. Encarregado

## 4) Padrão obrigatório por módulo

- Tutorial completo: `docs/apresentacao/wf-<modulo>-tutorial.html`
- Resumo executivo: `docs/apresentacao/wf-<modulo>-resumo-executivo.html`
- E-mail de primeiro acesso (quando fizer sentido): `docs/apresentacao/wf-<modulo>-email-primeiro-acesso.txt`
- Publicação no alias: `https://apresentacao-sooty-one.vercel.app`
- Validação:
  - `curl -I <url>` retornando HTTP 200
  - abertura no browser com título + índice carregados

## 5) Cronograma de produção (cadência)

Meta recomendada: **2 módulos por dia útil**
- Manhã: 1 tutorial completo + resumo executivo + validação/publicação
- Tarde: 1 tutorial completo + resumo executivo + validação/publicação

Estimativa para 17 módulos:
- 1ª semana: 10 módulos
- 2ª semana: 7 módulos + revisão final de consistência visual

## 6) Regras de revisão contínua

- Recebeu print novo: incorporar, renumerar seções e republicar no mesmo alias.
- Evitar repetição de imagem; usar recorte para destacar ponto crítico.
- Sempre incluir “como fica depois de lançado” quando houver no módulo (Meus Lançamentos, Detalhes, Relatórios).

## 7) Execução desta rodada (módulo 1)

- Módulo executado: **WF Equipamentos**
- Arquivos:
  - `docs/apresentacao/wf-equipamentos-tutorial.html` (mantido)
  - `docs/apresentacao/wf-equipamentos-resumo-executivo.html` (novo)
  - `docs/apresentacao/wf-equipamentos-email-primeiro-acesso.txt` (novo)
- Publicado em: `https://apresentacao-sooty-one.vercel.app`
- Validado com HTTP 200 e abertura no browser.
