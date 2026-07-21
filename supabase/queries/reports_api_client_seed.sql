-- Seed de cliente para Workflux Reports API v1
-- Substitua os placeholders e execute via:
-- npx supabase db query --linked --file supabase/queries/reports_api_client_seed.sql

-- 1) Defina uma chave forte (mínimo recomendado: 32 chars)
-- Exemplo (NÃO usar em produção): CHANGE_ME_SUPER_KEY_2026

insert into public.wf_api_clients (
  name,
  api_key_hash,
  company_id,
  allowed_reports,
  is_active,
  rate_limit_per_minute,
  notes
)
select
  'PowerBI-Fremix',
  encode(digest('CHANGE_ME_SUPER_KEY_2026', 'sha256'), 'hex'),
  c.id,
  array[
    'rdo/summary',
    'rdo/details',
    'equipamentos/utilizacao',
    'abastecimento/consumo',
    'producao/infra',
    'producao/pavimentacao',
    'transportes/performance'
  ]::text[],
  true,
  120,
  'Cliente inicial para BI'
from public.companies c
where c.name ilike '%Fremix%'
limit 1
on conflict (api_key_hash) do update
set
  name = excluded.name,
  company_id = excluded.company_id,
  allowed_reports = excluded.allowed_reports,
  is_active = excluded.is_active,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  notes = excluded.notes,
  updated_at = now();
