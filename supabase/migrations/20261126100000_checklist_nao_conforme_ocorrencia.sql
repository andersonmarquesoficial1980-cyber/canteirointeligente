-- WF Checklist (fase 3): item NÃO CONFORME abre ocorrência para a Manutenção automaticamente.
-- Uma ocorrência por checklist (idempotente). Não bloqueia a operação. Aditivo.

alter table public.equipamentos_ocorrencias
  add column if not exists preop_checklist_id uuid null references public.equipment_preop_checklists(id) on delete set null;
create unique index if not exists equipamentos_ocorrencias_preop_checklist_key
  on public.equipamentos_ocorrencias(preop_checklist_id) where preop_checklist_id is not null;

create or replace function public.preop_nao_conforme_abre_ocorrencia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.equipamentos_ocorrencias
    (equipamento_id, company_id, frota, titulo, descricao, tipo, prioridade, status, origem,
     solicitante_nome, solicitante_perfil, foto_url, created_by, preop_checklist_id)
  select eq.id, c.company_id, c.equipment_fleet,
         'Checklist: ' || x.n || ' item(ns) não conforme — ' || c.equipment_fleet,
         'Checklist pré-operação de ' || to_char(c.date,'DD/MM/YYYY') || ' (' || c.period || ')' || E'\n' || x.itens,
         'OCORRÊNCIA',
         case when x.itens ~* '(freio|extintor|pneu|lagarta|vazamento|dire[cç][aã]o)' then 'ALTA' else 'NORMAL' end,
         'ABERTA', 'checklist',
         coalesce(c.operator_name, ''), 'Operador (checklist)', x.foto, c.created_by, c.id
  from (
    select n.preop_checklist_id id, count(*) n,
           string_agg('• ' || coalesce(s.item_name, n.item_id) || coalesce(' — ' || nullif(n.observation,''), ''), E'\n' order by s.item_name) itens,
           min(n.photo_url) filter (where n.photo_url is not null) foto
    from new_rows n
    left join public.checklist_items_standard s on s.id::text = n.item_id
    where n.status = 'nao_ok'
    group by n.preop_checklist_id
  ) x
  join public.equipment_preop_checklists c on c.id = x.id
  join public.equipamentos eq on eq.company_id = c.company_id and upper(trim(eq.frota)) = upper(trim(c.equipment_fleet))
  on conflict (preop_checklist_id) where preop_checklist_id is not null
  do update set titulo = excluded.titulo, descricao = excluded.descricao, prioridade = excluded.prioridade,
                foto_url = excluded.foto_url, updated_at = now()
     where public.equipamentos_ocorrencias.status = 'ABERTA';
  return null;
end $$;

drop trigger if exists trg_preop_nao_conforme_ocorrencia on public.equipment_preop_checklist_entries;
create trigger trg_preop_nao_conforme_ocorrencia
  after insert on public.equipment_preop_checklist_entries
  referencing new table as new_rows
  for each statement execute function public.preop_nao_conforme_abre_ocorrencia();
