import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Funcionario {
  id: string; // employees.id — usar como employee_id nos lançamentos
  matricula: string;
  nome: string;
  funcao: string;       // nome da função (de funcoes.nome se existir, fallback para role)
  empresa: string;      // "FREMIX" ou nome da empresa parceira
  funcao_id?: string;   // FK para funcoes
}

export function useFuncionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    // Fonte única: tabela employees com join para funcoes e empresas_parceiras
    const { data, error } = await (supabase as any)
      .from("employees")
      .select("id, matricula, name, role, status, origem, empresa_nome, funcao_id, funcoes(nome), empresas_parceiras(nome)")
      .eq("status", "ativo")
      .order("name", { ascending: true });
    if (!error && data) {
      const normalized = (data as any[]).map(f => ({
        id: f.id,
        matricula: f.matricula ?? "",
        nome: f.name,
        // Prioridade: nome da função cadastrada > role (texto legado)
        funcao: f.funcoes?.nome ?? f.role ?? "",
        funcao_id: f.funcao_id ?? undefined,
        // Empresa: nome salvo > empresa parceira via join > "FREMIX" se PROPRIO
        empresa: f.empresa_nome ?? f.empresas_parceiras?.nome ?? (f.origem === "PROPRIO" ? "FREMIX" : ""),
      }));
      setFuncionarios(normalized);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const funcoes = [...new Set(funcionarios.map(f => f.funcao))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { funcionarios, funcoes, loading, reload: load };
}
