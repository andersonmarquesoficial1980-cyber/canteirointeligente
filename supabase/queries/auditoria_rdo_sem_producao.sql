-- Auditoria: RDO enviado com efetivo ou NF, mas sem produção
-- Janela padrão: últimas 36 horas

with base as (
  select
    rd.id,
    rd.created_at,
    rd.data,
    rd.obra_nome,
    rd.tipo_rdo,
    rd.status_validacao,
    rd.user_id,
    coalesce((select count(*) from public.rdo_efetivo re where re.rdo_id = rd.id), 0) as efetivo_rows,
    coalesce((select count(*) from public.rdo_nf_massa rn where rn.rdo_id = rd.id), 0) as nf_rows,
    coalesce((select count(*) from public.rdo_producao rp where rp.rdo_id = rd.id), 0) as prod_rows
  from public.rdo_diarios rd
  where rd.created_at >= now() - interval '36 hours'
    and rd.status_validacao = 'enviado'
)
select
  b.id,
  b.created_at,
  b.data,
  b.obra_nome,
  b.tipo_rdo,
  p.nome_completo as apontador,
  b.efetivo_rows,
  b.nf_rows,
  b.prod_rows
from base b
left join public.profiles p on p.user_id = b.user_id
where (b.efetivo_rows > 0 or b.nf_rows > 0)
  and b.prod_rows = 0
order by b.created_at desc;