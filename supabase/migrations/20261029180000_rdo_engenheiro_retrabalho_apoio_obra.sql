-- RDO Técnico: retrabalho (com ofício), caminhão basculante (exceto massa) e apoio/qualidade na obra.
-- Aditiva e não destrutiva: todas as colunas são novas e anuláveis.
ALTER TABLE public.rdo_engenheiro
  ADD COLUMN IF NOT EXISTS retrabalho boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrabalho_oficio text,
  ADD COLUMN IF NOT EXISTS qtd_caminhoes_basculante integer CHECK (qtd_caminhoes_basculante IS NULL OR qtd_caminhoes_basculante >= 0),
  ADD COLUMN IF NOT EXISTS autorizacao_no_horario boolean,
  ADD COLUMN IF NOT EXISTS autorizacao_atraso_detalhe text,
  ADD COLUMN IF NOT EXISTS sinalizacao_presente boolean,
  ADD COLUMN IF NOT EXISTS sinalizacao_nota smallint CHECK (sinalizacao_nota IS NULL OR sinalizacao_nota BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS controle_tecnologico_presente boolean,
  ADD COLUMN IF NOT EXISTS sinalizacao_vertical_nota smallint CHECK (sinalizacao_vertical_nota IS NULL OR sinalizacao_vertical_nota BETWEEN 1 AND 5);

COMMENT ON COLUMN public.rdo_engenheiro.retrabalho IS 'Serviço executado é retrabalho';
COMMENT ON COLUMN public.rdo_engenheiro.retrabalho_oficio IS 'Número do ofício que originou o retrabalho';
COMMENT ON COLUMN public.rdo_engenheiro.qtd_caminhoes_basculante IS 'Quantidade de caminhões basculantes (exceto massa asfáltica)';
COMMENT ON COLUMN public.rdo_engenheiro.autorizacao_no_horario IS 'Autorização para iniciar os trabalhos ocorreu no horário previsto';
COMMENT ON COLUMN public.rdo_engenheiro.sinalizacao_nota IS 'Nota 1-5 da equipe de sinalização (só quando presente)';
COMMENT ON COLUMN public.rdo_engenheiro.sinalizacao_vertical_nota IS 'Nota 1-5 da sinalização vertical (balizadores e placas)';
