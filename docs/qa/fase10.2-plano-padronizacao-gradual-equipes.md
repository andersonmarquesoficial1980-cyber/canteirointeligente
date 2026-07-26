# Fase 10.2 — Plano de Padronização Gradual (sem quebrar nada)

Data: 2026-07-26  
Status: **Preparado para execução controlada**

## Objetivo
Consolidar nomes de Equipe/Setor de forma progressiva, **sem impacto nos fluxos atuais**, mantendo compatibilidade com histórico.

---

## Snapshot atual (já validado)
- Todos os valores em uso já existem no catálogo `ci_equipes` ativo.
- Fora do catálogo: **0**.

Top valores por uso (fontes operacionais):
- GRU - AIRPORT (137)
- CBUQ02 - JOSENILDO (51)
- CBUQ04 - THIAGO HENRIQUE (47)
- CBUQ03 - GIVANILDO (46)
- CBUQ01 - AELSON (43)
- COPASA (43)
- MANUTENÇÃO / FROTA (20)
- CARRETEIROS (15)
- INFRA - GUIA E SARJETA (15)
- LOG & TRANS (13)
- USINAGEM KMA (13)

---

## Princípios de segurança (lock)
1. **Não apagar** equipes existentes nesta fase.
2. **Não renomear em massa** sem validação por lote pequeno.
3. Sempre executar em ordem:
   - dry-run (contagem)
   - update em lote
   - validação pós-update
4. Se der divergência, rollback imediato no mesmo bloco transacional.

---

## Estratégia 10.2 (3 ondas)

## Onda A — Higiene tipográfica (baixo risco)
Padronizar apenas diferenças de formatação (espaço, barra, caixa), quando semanticamente igual.

### Candidatos iniciais (já identificados)
- `RETRABALHOS / PV` (já padronizado)
- Revisar se surgir algo como:
  - `X/Y` vs `X / Y`
  - espaços duplos
  - caixinha inconsistente

> Critério: **mesmo significado evidente**.

---

## Onda B — Consolidação por decisão de negócio (risco médio)
Aqui só com seu OK por item (pode representar operação diferente):

- `MANUTENÇÃO`  ↔ `MANUTENÇÃO / FROTA`
- `CARRETEIROS` ↔ `CONTROLE CARRETEIROS`
- `GRU - AIRPORT` ↔ `GRU - AIRPORT - THIAGO SILVA`
- `COMBOIO` ↔ `CENTRAL DE ABASTECIMENTO` (se fizer sentido operacional)

> Critério: consolidar apenas se **equivalência operacional real**.

---

## Onda C — Governança contínua (sem update massivo)
1. Definir uma lista de “nomes canônicos preferenciais”.
2. Tratar nomes alternativos como “alias autorizado”.
3. Novos cadastros só em formato canônico.
4. Revisão mensal automática com relatório de desvios.

---

## SQL base para execução segura (modelo)

### 1) Dry-run (antes)
```sql
select 'employees.equipe' origem, count(*) qtd from employees where equipe = :origem
union all
select 'equipamentos.setor', count(*) from equipamentos where setor = :origem
union all
select 'ci_programacoes.equipe', count(*) from ci_programacoes where equipe = :origem
union all
select 'rdo_engenheiro.equipe', count(*) from rdo_engenheiro where equipe = :origem;
```

### 2) Update transacional
```sql
begin;
update employees      set equipe = :destino where equipe = :origem;
update equipamentos   set setor  = :destino where setor  = :origem;
update ci_programacoes set equipe = :destino where equipe = :origem;
update rdo_engenheiro  set equipe = :destino where equipe = :origem;
commit;
```

### 3) Validação (depois)
```sql
select :origem as valor, (
  (select count(*) from employees where equipe = :origem) +
  (select count(*) from equipamentos where setor = :origem) +
  (select count(*) from ci_programacoes where equipe = :origem) +
  (select count(*) from rdo_engenheiro where equipe = :origem)
) as restante_origem;
```

---

## Plano de execução recomendado
1. Rodar Onda A completa (rápida e segura).
2. Validar no app (filtros/chips/seleções em Programador + Dashboards).
3. Executar Onda B em lotes de **1 mapeamento por vez**.
4. Fechar com relatório final de divergências = 0 (ou justificadas).

---

## Decisão pendente do gestor (Anderson)
Para iniciar Onda B, confirmar mapa desejado:
- [ ] MANUTENÇÃO -> MANUTENÇÃO / FROTA
- [ ] CONTROLE CARRETEIROS -> CARRETEIROS
- [ ] GRU - AIRPORT - THIAGO SILVA -> GRU - AIRPORT
- [ ] CENTRAL DE ABASTECIMENTO -> COMBOIO
- [ ] outro: ____________________

---

## Resultado esperado da Fase 10.2
- Catálogo mantém compatibilidade total.
- Normalização progressiva sem quebra.
- Histórico preservado.
- Governança pronta para escalar.
