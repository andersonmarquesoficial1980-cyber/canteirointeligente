
-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE for all relevant tables

-- ============ materiais ============
DROP POLICY IF EXISTS "Auth select materiais" ON public.materiais;
DROP POLICY IF EXISTS "Auth insert materiais" ON public.materiais;
DROP POLICY IF EXISTS "Auth update materiais" ON public.materiais;
DROP POLICY IF EXISTS "Auth delete materiais" ON public.materiais;

CREATE POLICY "Auth select materiais" ON public.materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert materiais" ON public.materiais FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update materiais" ON public.materiais FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete materiais" ON public.materiais FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ tipos_servico ============
DROP POLICY IF EXISTS "Auth select tipos_servico" ON public.tipos_servico;
DROP POLICY IF EXISTS "Auth insert tipos_servico" ON public.tipos_servico;
DROP POLICY IF EXISTS "Auth update tipos_servico" ON public.tipos_servico;
DROP POLICY IF EXISTS "Auth delete tipos_servico" ON public.tipos_servico;

CREATE POLICY "Auth select tipos_servico" ON public.tipos_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert tipos_servico" ON public.tipos_servico FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update tipos_servico" ON public.tipos_servico FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete tipos_servico" ON public.tipos_servico FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ empreiteiros ============
DROP POLICY IF EXISTS "Auth select empreiteiros" ON public.empreiteiros;
DROP POLICY IF EXISTS "Auth insert empreiteiros" ON public.empreiteiros;
DROP POLICY IF EXISTS "Auth update empreiteiros" ON public.empreiteiros;
DROP POLICY IF EXISTS "Auth delete empreiteiros" ON public.empreiteiros;

CREATE POLICY "Auth select empreiteiros" ON public.empreiteiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert empreiteiros" ON public.empreiteiros FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update empreiteiros" ON public.empreiteiros FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete empreiteiros" ON public.empreiteiros FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ fornecedores ============
DROP POLICY IF EXISTS "Auth select fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Auth insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Auth update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Auth delete fornecedores" ON public.fornecedores;

CREATE POLICY "Auth select fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ usinas ============
DROP POLICY IF EXISTS "Auth select usinas" ON public.usinas;
DROP POLICY IF EXISTS "Auth insert usinas" ON public.usinas;
DROP POLICY IF EXISTS "Auth update usinas" ON public.usinas;
DROP POLICY IF EXISTS "Auth delete usinas" ON public.usinas;

CREATE POLICY "Auth select usinas" ON public.usinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert usinas" ON public.usinas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update usinas" ON public.usinas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete usinas" ON public.usinas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ maquinas_frota ============
DROP POLICY IF EXISTS "Authenticated users can select maquinas_frota" ON public.maquinas_frota;
DROP POLICY IF EXISTS "Authenticated users can insert maquinas_frota" ON public.maquinas_frota;
DROP POLICY IF EXISTS "Admin update maquinas" ON public.maquinas_frota;
DROP POLICY IF EXISTS "Admin delete maquinas" ON public.maquinas_frota;

CREATE POLICY "Auth select maquinas_frota" ON public.maquinas_frota FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert maquinas_frota" ON public.maquinas_frota FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth update maquinas_frota" ON public.maquinas_frota FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Auth delete maquinas_frota" ON public.maquinas_frota FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ funcionarios ============
DROP POLICY IF EXISTS "Auth select funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Admin insert funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Admin update funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Admin delete funcionarios" ON public.funcionarios;

CREATE POLICY "Auth select funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admin update funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admin delete funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ ogs_reference ============
DROP POLICY IF EXISTS "Authenticated users can select ogs_reference" ON public.ogs_reference;
DROP POLICY IF EXISTS "Admin insert ogs" ON public.ogs_reference;
DROP POLICY IF EXISTS "Admin update ogs" ON public.ogs_reference;
DROP POLICY IF EXISTS "Admin delete ogs" ON public.ogs_reference;

CREATE POLICY "Auth select ogs_reference" ON public.ogs_reference FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert ogs_reference" ON public.ogs_reference FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admin update ogs_reference" ON public.ogs_reference FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admin delete ogs_reference" ON public.ogs_reference FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ profiles ============
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::text)) WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- ============ user_roles ============
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::text)) WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- ============ diaries ============
DROP POLICY IF EXISTS "Users can insert own diaries" ON public.diaries;
DROP POLICY IF EXISTS "Users can read own diaries" ON public.diaries;

CREATE POLICY "Users can read own diaries" ON public.diaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diaries" ON public.diaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ rdo_diarios ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Authenticated users can select rdo_diarios" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Users can create RDOs with own user_id" ON public.rdo_diarios;
DROP POLICY IF EXISTS "Users can update own rdo_diarios" ON public.rdo_diarios;

CREATE POLICY "Auth select rdo_diarios" ON public.rdo_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_diarios" ON public.rdo_diarios FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL));
CREATE POLICY "Users can update own rdo_diarios" ON public.rdo_diarios FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ rdo_producao ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_producao" ON public.rdo_producao;
DROP POLICY IF EXISTS "Authenticated users can select rdo_producao" ON public.rdo_producao;

CREATE POLICY "Auth select rdo_producao" ON public.rdo_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_producao" ON public.rdo_producao FOR INSERT TO authenticated WITH CHECK (true);

-- ============ rdo_efetivo ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_efetivo" ON public.rdo_efetivo;
DROP POLICY IF EXISTS "Authenticated users can select rdo_efetivo" ON public.rdo_efetivo;

CREATE POLICY "Auth select rdo_efetivo" ON public.rdo_efetivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_efetivo" ON public.rdo_efetivo FOR INSERT TO authenticated WITH CHECK (true);

-- ============ rdo_mancha_areia ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_mancha_areia" ON public.rdo_mancha_areia;
DROP POLICY IF EXISTS "Authenticated users can select rdo_mancha_areia" ON public.rdo_mancha_areia;

CREATE POLICY "Auth select rdo_mancha_areia" ON public.rdo_mancha_areia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_mancha_areia" ON public.rdo_mancha_areia FOR INSERT TO authenticated WITH CHECK (true);

-- ============ rdo_temperatura_espalhamento ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_temperatura" ON public.rdo_temperatura_espalhamento;
DROP POLICY IF EXISTS "Authenticated users can select rdo_temperatura" ON public.rdo_temperatura_espalhamento;

CREATE POLICY "Auth select rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_temperatura" ON public.rdo_temperatura_espalhamento FOR INSERT TO authenticated WITH CHECK (true);

-- ============ rdo_banho_ligacao ============
DROP POLICY IF EXISTS "Authenticated users can insert rdo_banho_ligacao" ON public.rdo_banho_ligacao;
DROP POLICY IF EXISTS "Authenticated users can select rdo_banho_ligacao" ON public.rdo_banho_ligacao;

CREATE POLICY "Auth select rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert rdo_banho_ligacao" ON public.rdo_banho_ligacao FOR INSERT TO authenticated WITH CHECK (true);

-- ============ configuracoes_relatorio ============
DROP POLICY IF EXISTS "Admins can select configuracoes_relatorio" ON public.configuracoes_relatorio;
DROP POLICY IF EXISTS "Admins can insert configuracoes_relatorio" ON public.configuracoes_relatorio;
DROP POLICY IF EXISTS "Admins can update configuracoes_relatorio" ON public.configuracoes_relatorio;

CREATE POLICY "Admins can select configuracoes_relatorio" ON public.configuracoes_relatorio FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can insert configuracoes_relatorio" ON public.configuracoes_relatorio FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can update configuracoes_relatorio" ON public.configuracoes_relatorio FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::text));

-- ============ fueling_entries ============
DROP POLICY IF EXISTS "Authenticated users can insert fueling_entries" ON public.fueling_entries;
DROP POLICY IF EXISTS "Authenticated users can select fueling_entries" ON public.fueling_entries;

CREATE POLICY "Auth select fueling_entries" ON public.fueling_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fueling_entries" ON public.fueling_entries FOR INSERT TO authenticated WITH CHECK (true);

-- ============ time_entries ============
DROP POLICY IF EXISTS "Users can insert own time entries" ON public.time_entries;

CREATE POLICY "Auth insert time_entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = time_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "Auth select time_entries" ON public.time_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = time_entries.diary_id AND diaries.user_id = auth.uid()));

-- ============ bit_entries ============
DROP POLICY IF EXISTS "Users can insert own bit entries" ON public.bit_entries;

CREATE POLICY "Auth insert bit_entries" ON public.bit_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = bit_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "Auth select bit_entries" ON public.bit_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = bit_entries.diary_id AND diaries.user_id = auth.uid()));

-- ============ checklist_entries ============
DROP POLICY IF EXISTS "Users can insert own checklist entries" ON public.checklist_entries;

CREATE POLICY "Auth insert checklist_entries" ON public.checklist_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = checklist_entries.diary_id AND diaries.user_id = auth.uid()));
CREATE POLICY "Auth select checklist_entries" ON public.checklist_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = checklist_entries.diary_id AND diaries.user_id = auth.uid()));

-- ============ production_entries ============
DROP POLICY IF EXISTS "Users can manage own production entries" ON public.production_entries;

CREATE POLICY "Auth manage production_entries" ON public.production_entries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM diaries WHERE diaries.id = production_entries.diary_id AND diaries.user_id = auth.uid()));
