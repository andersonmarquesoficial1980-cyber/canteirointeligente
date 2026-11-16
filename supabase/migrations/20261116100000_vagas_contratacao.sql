-- Vagas de contratação por equipe (WF Gestão de Pessoas + WF Programador). Aditiva.
-- Uma linha por posição. Escrita só via RPC (SECURITY DEFINER); tabela é somente leitura para o app.
begin;

alter table public.user_permissions add column if not exists vagas_gestor boolean not null default false;

create table if not exists public.vagas_contratacao (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  equipe text not null check (length(btrim(equipe)) > 0),
  funcao_id uuid references public.funcoes(id),
  funcao text not null check (length(btrim(funcao)) > 0),
  observacao text,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  motivo text not null default 'aumento_efetivo' check (motivo in ('reposicao','aumento_efetivo')),
  data_prevista date,
  status text not null default 'aberta' check (status in ('aberta','em_selecao','contratada','cancelada')),
  employee_id uuid references public.employees(id),
  motivo_cancelamento text,
  fechada_em timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint vagas_contratada_exige_funcionario check (status <> 'contratada' or employee_id is not null),
  constraint vagas_cancelada_exige_motivo check (status <> 'cancelada' or length(btrim(coalesce(motivo_cancelamento,''))) > 0)
);
create index if not exists vagas_contratacao_company_status_idx on public.vagas_contratacao (company_id, status);
create index if not exists vagas_contratacao_company_equipe_idx on public.vagas_contratacao (company_id, equipe);

create table if not exists public.vagas_contratacao_historico (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas_contratacao(id),
  company_id uuid not null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  ator uuid,
  criado_em timestamptz not null default now()
);
create index if not exists vagas_hist_vaga_idx on public.vagas_contratacao_historico (vaga_id, criado_em desc);

-- Leitura: mesma empresa + quem enxerga Gestão de Pessoas, Programador, RH ou é gestor de vagas.
create or replace function public.vagas_can_read(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or p.company_id = p_company_id)
  ) and (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'superadmin')
    or exists (
      select 1 from public.user_permissions u
      where u.user_id = auth.uid()
        and (u.modulo_gestao_pessoas or u.modulo_programador or u.modulo_rh or u.vagas_gestor)
    )
  );
$$;

-- Escrita: somente gestor de vagas (permissão própria) ou owner superadmin, na própria empresa.
create or replace function public.vagas_can_manage(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (p.role = 'superadmin' or (
        p.company_id = p_company_id
        and exists (select 1 from public.user_permissions u where u.user_id = auth.uid() and u.vagas_gestor = true)
      ))
  );
$$;

alter table public.vagas_contratacao enable row level security;
alter table public.vagas_contratacao_historico enable row level security;
create policy vagas_contratacao_read on public.vagas_contratacao for select to authenticated using (public.vagas_can_read(company_id));
create policy vagas_contratacao_hist_read on public.vagas_contratacao_historico for select to authenticated using (public.vagas_can_read(company_id));
revoke all on public.vagas_contratacao, public.vagas_contratacao_historico from anon, authenticated;
grant select on public.vagas_contratacao, public.vagas_contratacao_historico to authenticated;

-- Histórico automático (antes/depois) em toda mutação.
create or replace function public.vagas_contratacao_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.vagas_contratacao_historico (vaga_id, company_id, acao, depois, ator)
    values (new.id, new.company_id, 'criada', to_jsonb(new), auth.uid());
  else
    insert into public.vagas_contratacao_historico (vaga_id, company_id, acao, antes, depois, ator)
    values (new.id, new.company_id,
      case when new.status is distinct from old.status then 'status:' || new.status else 'editada' end,
      to_jsonb(old), to_jsonb(new), auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists vagas_contratacao_audit_trg on public.vagas_contratacao;
create trigger vagas_contratacao_audit_trg after insert or update on public.vagas_contratacao
  for each row execute function public.vagas_contratacao_audit();
revoke all on function public.vagas_contratacao_audit() from public, anon, authenticated;

-- Cria N vagas (uma linha por posição). p_itens: [{equipe, funcao_id, quantidade, observacao, prioridade, motivo, data_prevista}]
create or replace function public.vagas_criar(p_company_id uuid, p_itens jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare it jsonb; v_qtd int; v_total int := 0; v_func record; i int;
begin
  if not public.vagas_can_manage(p_company_id) then raise exception 'Sem permissão para gerir vagas' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Informe ao menos uma vaga'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((it->>'quantidade')::int, 1);
    if v_qtd < 1 or v_qtd > 50 then raise exception 'Quantidade inválida (1 a 50)'; end if;
    if length(btrim(coalesce(it->>'equipe',''))) = 0 then raise exception 'Equipe obrigatória'; end if;
    select id, nome into v_func from public.funcoes
      where id = (it->>'funcao_id')::uuid and company_id = p_company_id and ativo is not false;
    if v_func.id is null then raise exception 'Função inválida para a empresa'; end if;
    for i in 1..v_qtd loop
      insert into public.vagas_contratacao (company_id, equipe, funcao_id, funcao, observacao, prioridade, motivo, data_prevista, created_by, updated_by)
      values (p_company_id, btrim(it->>'equipe'), v_func.id, v_func.nome, nullif(btrim(it->>'observacao'),''),
        coalesce(nullif(it->>'prioridade',''),'normal'), coalesce(nullif(it->>'motivo',''),'aumento_efetivo'),
        nullif(it->>'data_prevista','')::date, auth.uid(), auth.uid());
      v_total := v_total + 1;
    end loop;
  end loop;
  return v_total;
end $$;

-- Atualiza uma vaga. p_campos aceita: equipe, funcao_id, observacao, prioridade, motivo, data_prevista, status, employee_id, motivo_cancelamento
create or replace function public.vaga_atualizar(p_id uuid, p_campos jsonb)
returns public.vagas_contratacao language plpgsql security definer set search_path = public as $$
declare v public.vagas_contratacao; v_func record; v_emp record; v_status text;
begin
  select * into v from public.vagas_contratacao where id = p_id for update;
  if v.id is null then raise exception 'Vaga não encontrada'; end if;
  if not public.vagas_can_manage(v.company_id) then raise exception 'Sem permissão para gerir vagas' using errcode = '42501'; end if;
  if v.status in ('contratada','cancelada') then raise exception 'Vaga já encerrada (%).', v.status; end if;

  if p_campos ? 'funcao_id' then
    select id, nome into v_func from public.funcoes where id = (p_campos->>'funcao_id')::uuid and company_id = v.company_id and ativo is not false;
    if v_func.id is null then raise exception 'Função inválida para a empresa'; end if;
    v.funcao_id := v_func.id; v.funcao := v_func.nome;
  end if;
  if p_campos ? 'equipe' then
    if length(btrim(coalesce(p_campos->>'equipe',''))) = 0 then raise exception 'Equipe obrigatória'; end if;
    v.equipe := btrim(p_campos->>'equipe');
  end if;
  if p_campos ? 'observacao' then v.observacao := nullif(btrim(p_campos->>'observacao'),''); end if;
  if p_campos ? 'prioridade' then v.prioridade := p_campos->>'prioridade'; end if;
  if p_campos ? 'motivo' then v.motivo := p_campos->>'motivo'; end if;
  if p_campos ? 'data_prevista' then v.data_prevista := nullif(p_campos->>'data_prevista','')::date; end if;

  if p_campos ? 'status' then
    v_status := p_campos->>'status';
    if v_status = 'contratada' then
      select id, status, company_id into v_emp from public.employees where id = (p_campos->>'employee_id')::uuid;
      if v_emp.id is null or v_emp.company_id <> v.company_id then raise exception 'Funcionário inválido para a empresa'; end if;
      if lower(coalesce(v_emp.status,'')) in ('demitido','demissao') then raise exception 'Funcionário demitido não pode preencher vaga'; end if;
      v.employee_id := v_emp.id; v.fechada_em := now();
    elsif v_status = 'cancelada' then
      v.motivo_cancelamento := btrim(coalesce(p_campos->>'motivo_cancelamento',''));
      v.fechada_em := now();
    end if;
    v.status := v_status;
  end if;

  update public.vagas_contratacao set equipe = v.equipe, funcao_id = v.funcao_id, funcao = v.funcao, observacao = v.observacao,
    prioridade = v.prioridade, motivo = v.motivo, data_prevista = v.data_prevista, status = v.status, employee_id = v.employee_id,
    motivo_cancelamento = v.motivo_cancelamento, fechada_em = v.fechada_em, updated_at = now(), updated_by = auth.uid()
  where id = p_id returning * into v;
  return v;
end $$;

revoke all on function public.vagas_can_read(uuid), public.vagas_can_manage(uuid), public.vagas_criar(uuid, jsonb), public.vaga_atualizar(uuid, jsonb) from public, anon;
grant execute on function public.vagas_can_read(uuid), public.vagas_can_manage(uuid), public.vagas_criar(uuid, jsonb), public.vaga_atualizar(uuid, jsonb) to authenticated;

commit;
