-- Evita duplicidade de multa por empresa + Auto + Placa + Data
-- (quando auto_infracao estiver preenchido)
create unique index if not exists ux_gestao_frotas_multas_company_data_placa_auto
  on public.gestao_frotas_multas (company_id, data_infracao, placa, auto_infracao)
  where auto_infracao is not null and btrim(auto_infracao) <> '';
