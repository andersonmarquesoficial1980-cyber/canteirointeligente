-- Gestão de Pessoas: data de demissão no cadastro do funcionário
alter table public.employees
  add column if not exists data_demissao date;