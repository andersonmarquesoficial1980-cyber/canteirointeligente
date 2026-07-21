-- Workflux Reports API v1 - foundation
-- Objetivo: camada de integração read-only para BI/ERP (Power BI, Protheus etc.)

create extension if not exists pgcrypto;

create table if not exists public.wf_api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key_hash text not null unique,
  company_id uuid not null,
  allowed_reports text[] not null default '{}',
  is_active boolean not null default true,
  rate_limit_per_minute integer not null default 60,
  last_used_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wf_api_clients_company_active
  on public.wf_api_clients (company_id, is_active);

create table if not exists public.wf_api_access_logs (
  id bigint generated always as identity primary key,
  client_id uuid references public.wf_api_clients(id) on delete set null,
  company_id uuid,
  report_key text not null,
  status_code integer not null,
  duration_ms integer,
  row_count integer,
  request_path text,
  query jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wf_api_access_logs_created_at
  on public.wf_api_access_logs (created_at desc);

create index if not exists idx_wf_api_access_logs_client
  on public.wf_api_access_logs (client_id, created_at desc);

create index if not exists idx_wf_api_access_logs_report
  on public.wf_api_access_logs (report_key, created_at desc);

comment on table public.wf_api_clients is
  'Credenciais de integração para a Reports API v1 (chaves hash + escopos por relatório)';

comment on table public.wf_api_access_logs is
  'Auditoria de consumo da Reports API v1 (latência, status, volume e filtros usados)';
