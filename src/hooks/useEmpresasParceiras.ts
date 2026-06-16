import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmpresaParceira {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  tipo: string;
  ativo: boolean;
}

export function useEmpresasParceiras() {
  const [empresas, setEmpresas] = useState<EmpresaParceira[]>([]);
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
    const { data } = await (supabase as any)
      .from("empresas_parceiras")
      .select("id, nome, cnpj, contato, tipo, ativo")
      .eq("ativo", true)
      .order("nome");
    setEmpresas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addEmpresa = async (payload: Omit<EmpresaParceira, "id" | "ativo">): Promise<boolean> => {
    const companyId = await getCompanyId();
    if (!companyId) return false;
    const { error } = await (supabase as any)
      .from("empresas_parceiras")
      .insert({ ...payload, company_id: companyId });
    if (!error) await fetchAll();
    return !error;
  };

  const updateEmpresa = async (id: string, payload: Partial<Omit<EmpresaParceira, "id">>): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from("empresas_parceiras")
      .update(payload)
      .eq("id", id);
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

  return { empresas, loading, reload: fetchAll, addEmpresa, updateEmpresa, removeEmpresa };
}
