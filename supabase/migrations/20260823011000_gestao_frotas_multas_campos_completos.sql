-- Campos adicionais para armazenar dados completos de multas operacionais
alter table public.gestao_frotas_multas
  add column if not exists pontos integer,
  add column if not exists tipo_registro text,
  add column if not exists codigo_orgao text,
  add column if not exists codigo_infracao text,
  add column if not exists orgao_autuador text,
  add column if not exists gravidade text,
  add column if not exists data_vencimento date,
  add column if not exists municipio text,
  add column if not exists uf text,
  add column if not exists veiculo_modelo text,
  add column if not exists cobranca_condutor text,
  add column if not exists cnh_condutor text;