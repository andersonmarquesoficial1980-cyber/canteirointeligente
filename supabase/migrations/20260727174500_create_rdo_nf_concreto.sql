-- Tabela de Notas Fiscais de Concreto (RDO Infra)
-- Mantém o mesmo padrão de segurança usado em rdo_nf_massa

CREATE TABLE IF NOT EXISTS public.rdo_nf_concreto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid REFERENCES public.rdo_diarios(id) ON DELETE CASCADE,
  nf text,
  quantidade_m3 numeric,
  tipo_concreto text,
  fornecedor text,
  foto_url text,
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id)
);

ALTER TABLE public.rdo_nf_concreto ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rdo_nf_concreto_rdo_id ON public.rdo_nf_concreto (rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_nf_concreto_company_id ON public.rdo_nf_concreto (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rdo_nf_concreto'
      AND policyname = 'rdo_nf_concreto_company'
  ) THEN
    CREATE POLICY rdo_nf_concreto_company
      ON public.rdo_nf_concreto
      FOR ALL
      TO authenticated
      USING (
        (company_id = (
          SELECT profiles.company_id
          FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          LIMIT 1
        ))
        OR is_super_admin()
      )
      WITH CHECK (
        company_id = (
          SELECT profiles.company_id
          FROM public.profiles
          WHERE profiles.user_id = auth.uid()
          LIMIT 1
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rdo_nf_concreto'
      AND policyname = 'insert_rdo_nf_concreto'
  ) THEN
    CREATE POLICY insert_rdo_nf_concreto
      ON public.rdo_nf_concreto
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rdo_nf_concreto'
      AND policyname = 'select_rdo_nf_concreto'
  ) THEN
    CREATE POLICY select_rdo_nf_concreto
      ON public.rdo_nf_concreto
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.rdo_diarios
          WHERE rdo_diarios.id = rdo_nf_concreto.rdo_id
            AND (
              rdo_diarios.user_id = auth.uid()
              OR has_role(auth.uid(), 'admin'::text)
            )
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rdo_nf_concreto'
      AND policyname = 'update_rdo_nf_concreto'
  ) THEN
    CREATE POLICY update_rdo_nf_concreto
      ON public.rdo_nf_concreto
      FOR UPDATE
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.rdo_diarios
          WHERE rdo_diarios.id = rdo_nf_concreto.rdo_id
            AND (
              rdo_diarios.user_id = auth.uid()
              OR has_role(auth.uid(), 'admin'::text)
            )
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rdo_nf_concreto'
      AND policyname = 'delete_rdo_nf_concreto'
  ) THEN
    CREATE POLICY delete_rdo_nf_concreto
      ON public.rdo_nf_concreto
      FOR DELETE
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.rdo_diarios
          WHERE rdo_diarios.id = rdo_nf_concreto.rdo_id
            AND (
              rdo_diarios.user_id = auth.uid()
              OR has_role(auth.uid(), 'admin'::text)
            )
        )
      );
  END IF;
END
$$;