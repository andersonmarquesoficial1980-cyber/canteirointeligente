-- Alocação temporária de funcionário em outra equipe (WF Programador / Quadro Pessoas).
-- employees.equipe continua sendo a equipe de ORIGEM (cadastro único). O empréstimo vive aqui,
-- com início e fim previsto. O retorno é confirmado manualmente (nada devolve sozinho).
-- Aditiva e idempotente: cria tabela e funções novas; não altera employees nem dados existentes.
-- Escrita só pelas RPCs (SECURITY DEFINER, exigem modulo_programador/is_admin); tabela é só leitura.
BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_alocacoes_temporarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  equipe_origem text NOT NULL,
  equipe_destino text NOT NULL,
  data_inicio date NOT NULL,
  data_fim_prevista date NULL,
  data_retorno date NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'encerrada', 'cancelada')),
  observacao text NULL CHECK (observacao IS NULL OR char_length(observacao) <= 500),
  criado_por uuid NOT NULL,
  encerrado_por uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(equipe_destino) <> '' AND btrim(equipe_origem) <> ''),
  CHECK (upper(btrim(equipe_destino)) <> upper(btrim(equipe_origem))),
  CHECK (data_fim_prevista IS NULL OR data_fim_prevista >= data_inicio),
  CHECK (data_retorno IS NULL OR data_retorno >= data_inicio),
  CHECK ((status = 'ativa' AND data_retorno IS NULL) OR (status <> 'ativa' AND data_retorno IS NOT NULL))
);

-- No máximo uma alocação ativa por funcionário.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alocacao_temp_ativa_por_funcionario
  ON public.employee_alocacoes_temporarias (company_id, employee_id) WHERE status = 'ativa';
CREATE INDEX IF NOT EXISTS idx_alocacao_temp_company_status
  ON public.employee_alocacoes_temporarias (company_id, status, data_inicio);
CREATE INDEX IF NOT EXISTS idx_alocacao_temp_employee
  ON public.employee_alocacoes_temporarias (employee_id, data_inicio);

ALTER TABLE public.employee_alocacoes_temporarias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_alocacoes_temporarias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employee_alocacoes_temporarias TO authenticated;
DROP POLICY IF EXISTS employee_alocacoes_temporarias_select ON public.employee_alocacoes_temporarias;
CREATE POLICY employee_alocacoes_temporarias_select ON public.employee_alocacoes_temporarias
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
                 AND p.company_id = employee_alocacoes_temporarias.company_id AND p.status = 'ativo'));

CREATE OR REPLACE FUNCTION public.touch_employee_alocacoes_temporarias()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_touch_employee_alocacoes_temporarias ON public.employee_alocacoes_temporarias;
CREATE TRIGGER trg_touch_employee_alocacoes_temporarias
  BEFORE UPDATE ON public.employee_alocacoes_temporarias
  FOR EACH ROW EXECUTE FUNCTION public.touch_employee_alocacoes_temporarias();

-- Autorização comum às RPCs de escrita.
CREATE OR REPLACE FUNCTION public.wf_alocacao_temp_autorizar(p_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário e empresa são obrigatórios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_user
                 AND p.company_id = p_company_id AND p.status = 'ativo')
     OR NOT EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = v_user
                 AND up.company_id = p_company_id
                 AND (up.modulo_programador IS TRUE OR up.is_admin IS TRUE)) THEN
    RAISE EXCEPTION 'Sem permissão de Programador nesta empresa';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.wf_alocacao_temp_autorizar(uuid) FROM PUBLIC, anon, authenticated;

-- Criar empréstimo temporário. A origem é a equipe atual do cadastro (não é enviada pelo cliente).
CREATE OR REPLACE FUNCTION public.alocacao_temp_criar(
  p_company_id uuid, p_employee_id uuid, p_equipe_destino text,
  p_data_inicio date, p_data_fim_prevista date, p_observacao text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_emp public.employees%ROWTYPE; v_id uuid; v_dest text := btrim(coalesce(p_equipe_destino, ''));
BEGIN
  PERFORM public.wf_alocacao_temp_autorizar(p_company_id);
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id AND company_id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionário não encontrado nesta empresa'; END IF;
  IF v_emp.status IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'Só funcionário ativo pode ser alocado temporariamente';
  END IF;
  IF btrim(coalesce(v_emp.equipe, '')) = '' THEN
    RAISE EXCEPTION 'Funcionário sem equipe de origem: use Alocar em equipe';
  END IF;
  IF v_dest = '' OR upper(v_dest) = upper(btrim(v_emp.equipe)) THEN
    RAISE EXCEPTION 'Equipe de destino deve ser diferente da origem';
  END IF;
  INSERT INTO public.employee_alocacoes_temporarias
    (company_id, employee_id, equipe_origem, equipe_destino, data_inicio, data_fim_prevista, observacao, criado_por)
  VALUES (p_company_id, p_employee_id, btrim(v_emp.equipe), v_dest,
          coalesce(p_data_inicio, current_date), p_data_fim_prevista, nullif(btrim(p_observacao), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.employee_historico (employee_id, company_id, tipo, descricao, data, criado_por)
  VALUES (p_employee_id, p_company_id, 'alocacao_temporaria',
          'Alocação temporária: ' || btrim(v_emp.equipe) || ' → ' || v_dest, coalesce(p_data_inicio, current_date), auth.uid());
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.alocacao_temp_criar(uuid,uuid,text,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alocacao_temp_criar(uuid,uuid,text,date,date,text) TO authenticated;

-- Confirmar retorno (ou cancelar lançamento indevido). Não mexe em employees.equipe.
CREATE OR REPLACE FUNCTION public.alocacao_temp_encerrar(
  p_company_id uuid, p_alocacao_id uuid, p_data_retorno date DEFAULT NULL, p_cancelar boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.employee_alocacoes_temporarias%ROWTYPE; v_ret date;
BEGIN
  PERFORM public.wf_alocacao_temp_autorizar(p_company_id);
  SELECT * INTO v_row FROM public.employee_alocacoes_temporarias
   WHERE id = p_alocacao_id AND company_id = p_company_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alocação ativa não encontrada'; END IF;
  v_ret := greatest(coalesce(p_data_retorno, current_date), v_row.data_inicio);
  IF p_cancelar THEN
    UPDATE public.employee_alocacoes_temporarias SET status = 'cancelada', data_retorno = v_ret,
      encerrado_por = auth.uid() WHERE id = v_row.id;
  ELSE
    UPDATE public.employee_alocacoes_temporarias SET status = 'encerrada', data_retorno = v_ret,
      encerrado_por = auth.uid() WHERE id = v_row.id;
    INSERT INTO public.employee_historico (employee_id, company_id, tipo, descricao, data, criado_por)
    VALUES (v_row.employee_id, p_company_id, 'alocacao_temporaria',
            'Retorno à equipe de origem: ' || v_row.equipe_destino || ' → ' || v_row.equipe_origem, v_ret, auth.uid());
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.alocacao_temp_encerrar(uuid,uuid,date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alocacao_temp_encerrar(uuid,uuid,date,boolean) TO authenticated;

-- Equipe efetiva por funcionário em um dia (base do card e, depois, do rateio).
-- Alocação ativa sem retorno confirmado continua valendo mesmo após data_fim_prevista (aguardando confirmação).
CREATE OR REPLACE FUNCTION public.equipe_efetiva_dia(p_company_id uuid, p_data date DEFAULT current_date)
RETURNS TABLE(employee_id uuid, equipe_origem text, equipe_efetiva text, alocacao_id uuid,
              data_fim_prevista date, aguardando_confirmacao boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT e.id, e.equipe, coalesce(a.equipe_destino, e.equipe), a.id, a.data_fim_prevista,
         (a.id IS NOT NULL AND a.status = 'ativa' AND a.data_fim_prevista IS NOT NULL
          AND a.data_fim_prevista < current_date)
    FROM public.employees e
    LEFT JOIN public.employee_alocacoes_temporarias a
      ON a.employee_id = e.id AND a.company_id = e.company_id AND a.status <> 'cancelada'
     AND a.data_inicio <= p_data
     AND (a.data_retorno IS NULL OR a.data_retorno > p_data)
   WHERE e.company_id = p_company_id;
$$;
REVOKE ALL ON FUNCTION public.equipe_efetiva_dia(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipe_efetiva_dia(uuid, date) TO authenticated;

COMMIT;
