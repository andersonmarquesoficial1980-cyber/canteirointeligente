-- Guardrails anti-duplicidade para RDO (cabeçalho + linhas filhas)
-- Objetivo: impedir duplicados/triplicados no mesmo RDO e duplicidade de cabeçalho.

-- 1) Normalizador textual padrão (imutável para uso em índices)
create or replace function public.wf_norm_text(v text)
returns text
language sql
immutable
as $$
  select upper(btrim(coalesce(v, '')))
$$;

-- 2) Garantir company_id no cabeçalho quando vier nulo
create or replace function public.fn_rdo_diarios_fill_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if new.company_id is null and new.user_id is not null then
    select p.company_id
      into v_company
    from public.profiles p
    where p.user_id = new.user_id
      and p.company_id is not null
    limit 1;

    if v_company is not null then
      new.company_id := v_company;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rdo_diarios_fill_company_id on public.rdo_diarios;
create trigger trg_rdo_diarios_fill_company_id
before insert or update of user_id, company_id
on public.rdo_diarios
for each row
execute function public.fn_rdo_diarios_fill_company_id();

-- 3) Sincronizar company_id nas NFs pelo company_id do RDO pai
create or replace function public.fn_rdo_child_sync_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if new.rdo_id is not null then
    select d.company_id into v_company
    from public.rdo_diarios d
    where d.id = new.rdo_id;

    if v_company is not null then
      new.company_id := v_company;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rdo_nf_massa_sync_company_id on public.rdo_nf_massa;
create trigger trg_rdo_nf_massa_sync_company_id
before insert or update of rdo_id, company_id
on public.rdo_nf_massa
for each row
execute function public.fn_rdo_child_sync_company_id();

drop trigger if exists trg_rdo_nf_concreto_sync_company_id on public.rdo_nf_concreto;
create trigger trg_rdo_nf_concreto_sync_company_id
before insert or update of rdo_id, company_id
on public.rdo_nf_concreto
for each row
execute function public.fn_rdo_child_sync_company_id();

-- 4) Índices únicos de proteção
-- Cabeçalho RDO (um por combinação lógica de dia/obra/tipo/turno/apontador/usuário/empresa)
create unique index if not exists ux_rdo_diarios_guard_dedup
on public.rdo_diarios (
  coalesce(company_id::text, '__NULL__'),
  data,
  public.wf_norm_text(obra_nome),
  public.wf_norm_text(tipo_rdo),
  public.wf_norm_text(preenchido_por),
  public.wf_norm_text(turno),
  coalesce(user_id::text, '__NULL__')
);

-- NF Massa (não repetir linha idêntica dentro do mesmo RDO)
create unique index if not exists ux_rdo_nf_massa_guard_dedup
on public.rdo_nf_massa (
  rdo_id,
  public.wf_norm_text(nf),
  public.wf_norm_text(placa),
  public.wf_norm_text(usina),
  coalesce(tonelagem, -1),
  public.wf_norm_text(tipo_material),
  coalesce(company_id::text, '__NULL__')
);

-- NF Concreto
create unique index if not exists ux_rdo_nf_concreto_guard_dedup
on public.rdo_nf_concreto (
  rdo_id,
  public.wf_norm_text(nf),
  coalesce(quantidade_m3, -1),
  public.wf_norm_text(tipo_concreto),
  public.wf_norm_text(fornecedor),
  public.wf_norm_text(foto_url),
  public.wf_norm_text(equipamento),
  coalesce(company_id::text, '__NULL__')
);

-- Equipamentos
create unique index if not exists ux_rdo_equipamentos_guard_dedup
on public.rdo_equipamentos (
  rdo_id,
  public.wf_norm_text(frota),
  public.wf_norm_text(categoria),
  public.wf_norm_text(sub_tipo),
  public.wf_norm_text(tipo),
  public.wf_norm_text(nome),
  public.wf_norm_text(patrimonio),
  public.wf_norm_text(empresa_dona),
  coalesce(company_id::text, '__NULL__')
);

-- Efetivo
create unique index if not exists ux_rdo_efetivo_guard_dedup
on public.rdo_efetivo (
  rdo_id,
  public.wf_norm_text(funcao),
  coalesce(quantidade, -1),
  coalesce(entrada::text, ''),
  coalesce(saida::text, ''),
  public.wf_norm_text(nome),
  public.wf_norm_text(matricula),
  coalesce(employee_id::text, ''),
  coalesce(company_id::text, '__NULL__')
);

-- Produção
create unique index if not exists ux_rdo_producao_guard_dedup
on public.rdo_producao (
  rdo_id,
  public.wf_norm_text(rodovia),
  coalesce(km_inicial, -1),
  coalesce(km_final, -1),
  public.wf_norm_text(sentido),
  public.wf_norm_text(faixa),
  public.wf_norm_text(tipo_servico),
  coalesce(comprimento_m, -1),
  coalesce(largura_m, -1),
  coalesce(espessura_cm, -1),
  coalesce(area_m2, -1),
  coalesce(tonelagem, -1),
  public.wf_norm_text(estaca_inicial),
  public.wf_norm_text(estaca_final),
  public.wf_norm_text(sentido_faixa),
  public.wf_norm_text(observacoes),
  coalesce(densidade, -1),
  coalesce(volume_m3, -1),
  coalesce(is_retrabalho, false),
  coalesce(company_id::text, '__NULL__')
);
