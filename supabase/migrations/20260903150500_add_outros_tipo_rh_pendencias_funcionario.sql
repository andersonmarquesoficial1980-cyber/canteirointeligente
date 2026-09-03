-- WF Gestão de Pessoas — incluir tipo "outros" nas pendências do funcionário
begin;

alter table public.rh_pendencias_funcionario
  drop constraint if exists rh_pendencias_funcionario_tipo_check;

alter table public.rh_pendencias_funcionario
  add constraint rh_pendencias_funcionario_tipo_check
  check (tipo in ('classificacao', 'aumento_salarial', 'demissao', 'substituicao', 'outros'));

commit;
