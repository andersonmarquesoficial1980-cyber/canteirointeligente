-- Monitor de tentativas bloqueadas de duplicidade em RDO (read-only)
-- Uso:
--   npx supabase db query --linked --file supabase/queries/rdo_duplicate_block_events_monitor.sql

-- 1) Resumo últimas 24h por etapa/escopo
select
  stage,
  scope,
  count(*) as tentativas_bloqueadas,
  max(created_at) as ultima_tentativa
from public.rdo_duplicate_block_events
where created_at >= now() - interval '24 hours'
group by stage, scope
order by tentativas_bloqueadas desc, ultima_tentativa desc;

-- 2) Top usuários (últimas 24h)
select
  e.user_id,
  p.nome_completo,
  p.email,
  count(*) as tentativas_bloqueadas,
  max(e.created_at) as ultima_tentativa
from public.rdo_duplicate_block_events e
left join public.profiles p on p.user_id = e.user_id
where e.created_at >= now() - interval '24 hours'
group by e.user_id, p.nome_completo, p.email
order by tentativas_bloqueadas desc, ultima_tentativa desc
limit 20;

-- 3) Detalhes recentes (últimas 50)
select
  e.created_at,
  e.stage,
  e.scope,
  e.error_code,
  e.rdo_id,
  p.nome_completo,
  p.email,
  e.payload
from public.rdo_duplicate_block_events e
left join public.profiles p on p.user_id = e.user_id
order by e.created_at desc
limit 50;
