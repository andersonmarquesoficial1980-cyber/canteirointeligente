-- Permitir exclusão de RDO Técnico para o próprio engenheiro ou admin
DROP POLICY IF EXISTS rdo_eng_delete ON public.rdo_engenheiro;

CREATE POLICY rdo_eng_delete
ON public.rdo_engenheiro
FOR DELETE
TO authenticated
USING (
  engenheiro_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
);
