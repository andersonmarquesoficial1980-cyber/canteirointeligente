begin;

create table if not exists public.wf_custo_funcionario_mensal (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  competencia date not null,
  lote_id uuid null references public.wf_import_lotes(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  matricula text null,
  nome_funcionario text null,
  equipe text null,
  salario numeric(14,2) not null default 0,
  provisao_13 numeric(14,4) not null default 0,
  provisao_ferias numeric(14,4) not null default 0,
  um_terco_ferias numeric(14,4) not null default 0,
  base_encargos numeric(14,4) not null default 0,
  inss_patronal numeric(14,4) not null default 0,
  fgts numeric(14,4) not null default 0,
  total_encargos numeric(14,4) not null default 0,
  total_provisao_mensal numeric(14,4) not null default 0,
  assistencia_medica numeric(14,4) not null default 0,
  seguro_vida numeric(14,4) not null default 0,
  vale_refeicao numeric(14,4) not null default 0,
  totalpass numeric(14,4) not null default 0,
  custo_total_mensal numeric(14,4) not null default 0,
  origem text not null default 'planilha_provisionamento',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  unique (company_id, competencia, employee_id)
);

create index if not exists idx_wf_custo_func_mensal_company_competencia
  on public.wf_custo_funcionario_mensal (company_id, competencia);

create index if not exists idx_wf_custo_func_mensal_company_equipe
  on public.wf_custo_funcionario_mensal (company_id, equipe);

create or replace view public.wf_custo_equipe_mensal as
select
  c.company_id,
  c.competencia,
  coalesce(nullif(btrim(c.equipe), ''), 'SEM_EQUIPE') as equipe,
  count(*) as qtd_funcionarios,
  round(sum(c.custo_total_mensal)::numeric, 4) as custo_total_equipe,
  round(avg(c.custo_total_mensal)::numeric, 4) as custo_medio_funcionario,
  round(sum(c.salario)::numeric, 2) as total_salarios,
  round(sum(c.total_provisao_mensal)::numeric, 4) as total_provisoes,
  round(sum(c.assistencia_medica + c.seguro_vida + c.vale_refeicao + c.totalpass)::numeric, 4) as total_beneficios
from public.wf_custo_funcionario_mensal c
group by c.company_id, c.competencia, coalesce(nullif(btrim(c.equipe), ''), 'SEM_EQUIPE');

-- Trigger de updated_at

drop trigger if exists trg_touch_wf_custo_funcionario_mensal on public.wf_custo_funcionario_mensal;
create trigger trg_touch_wf_custo_funcionario_mensal
before update on public.wf_custo_funcionario_mensal
for each row execute function public.touch_wf_timestamp();

-- RLS + policies
alter table public.wf_custo_funcionario_mensal enable row level security;

drop policy if exists "wf_custo_func_mensal_select" on public.wf_custo_funcionario_mensal;
create policy "wf_custo_func_mensal_select"
on public.wf_custo_funcionario_mensal
for select
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_custo_funcionario_mensal.company_id)
  )
);

drop policy if exists "wf_custo_func_mensal_insert" on public.wf_custo_funcionario_mensal;
create policy "wf_custo_func_mensal_insert"
on public.wf_custo_funcionario_mensal
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_custo_funcionario_mensal.company_id)
  )
);

drop policy if exists "wf_custo_func_mensal_update" on public.wf_custo_funcionario_mensal;
create policy "wf_custo_func_mensal_update"
on public.wf_custo_funcionario_mensal
for update
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_custo_funcionario_mensal.company_id)
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_custo_funcionario_mensal.company_id)
  )
);

drop policy if exists "wf_custo_func_mensal_delete" on public.wf_custo_funcionario_mensal;
create policy "wf_custo_func_mensal_delete"
on public.wf_custo_funcionario_mensal
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = wf_custo_funcionario_mensal.company_id)
  )
);

commit;
