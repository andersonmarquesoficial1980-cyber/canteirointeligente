import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaTerceira {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface FuncionarioTerceiro {
  id: string;
  empresa_id: string;
  nome: string;
  ativo: boolean;
}

const EMPRESAS_DEFAULT = ["Geoservice", "RGSE", "Barão", "Copavel", "JBA", "Premark"];

export function useEmpresasTerceiras() {
  const [empresas, setEmpresas] = useState<EmpresaTerceira[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioTerceiro[]>([]);
  const [loading, setLoading] = useState(true);

  const getCompanyId = async (): Promise<string | null> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.user.id)
      .single();
    return profile?.company_id ?? null;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: emps }, { data: funcs }] = await Promise.all([
      (supabase as any).from("empresas_parceiras").select("id, nome, ativo").eq("ativo", true).order("nome"),
      // Busca funcionários terceirizados diretamente de employees (fonte única)
      (supabase as any)
        .from("employees")
        .select("id, empresa_id, name, status")
        .eq("origem", "TERCEIRO")
        .eq("status", "ativo")
        .order("name"),
    ]);

    const empList: EmpresaTerceira[] = emps || [];

    // Seed automático na primeira vez
    if (empList.length === 0) {
      const companyId = await getCompanyId();
      if (companyId) {
        const seedRows = EMPRESAS_DEFAULT.map((nome) => ({ nome, company_id: companyId, tipo: "MAO_DE_OBRA" }));
        const { data: inserted } = await (supabase as any)
          .from("empresas_parceiras")
          .insert(seedRows)
          .select("id, nome, ativo");
        setEmpresas(inserted || []);
        setFuncionarios([]);
        setLoading(false);
        return;
      }
    }

    // Normaliza employees para interface FuncionarioTerceiro
    const funcList: FuncionarioTerceiro[] = (funcs || []).map((f: any) => ({
      id: f.id,
      empresa_id: f.empresa_id,
      nome: f.name,
      ativo: f.status === "ativo",
    }));

    setEmpresas(empList);
    setFuncionarios(funcList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addEmpresa = async (nome: string): Promise<boolean> => {
    const companyId = await getCompanyId();
    if (!companyId) return false;
    const { error } = await (supabase as any)
      .from("empresas_parceiras")
      .insert({ nome: nome.trim(), company_id: companyId, tipo: "MAO_DE_OBRA" });
    if (!error) await fetchAll();
    return !error;
  };

  const removeEmpresa = async (id: string): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from("empresas_parceiras")
      .update({ ativo: false })
      .eq("id", id);
    if (!error) await fetchAll();
    return !error;
  };

  const addFuncionario = async (nome: string, empresa_id: string, role?: string): Promise<boolean> => {
    const companyId = await getCompanyId();
    if (!companyId) return false;
    // Terceirizados vão direto para a tabela employees (fonte única)
    const { error } = await (supabase as any)
      .from("employees")
      .insert({
        name: nome.trim(),
        empresa_id,
        company_id: companyId,
        origem: "TERCEIRO",
        status: "ativo",
        role: role?.trim() || null,
      });
    if (!error) await fetchAll();
    return !error;
  };

  const removeFuncionario = async (id: string): Promise<boolean> => {
    // Inativa o funcionário terceirizado em employees
    const { error } = await (supabase as any)
      .from("employees")
      .update({ status: "inativo" })
      .eq("id", id)
      .eq("origem", "TERCEIRO");
    if (!error) await fetchAll();
    return !error;
  };

  return {
    empresas,
    funcionarios,
    loading,
    addEmpresa,
    removeEmpresa,
    addFuncionario,
    removeFuncionario,
    refetch: fetchAll,
  };
}
