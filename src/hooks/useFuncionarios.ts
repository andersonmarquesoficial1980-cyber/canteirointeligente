import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
}

// Unify all "MOTORISTA ..." roles into a single "MOTORISTA" entry
function unifyMotorista(funcao: string): string {
  if (funcao.toUpperCase().includes("MOTORISTA")) return "MOTORISTA";
  return funcao;
}

export function useFuncionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("funcionarios" as any)
      .select("*")
      .order("nome", { ascending: true });
    if (!error && data) {
      // Normalize: unify all motorista variants into "MOTORISTA"
      const normalized = (data as any as Funcionario[]).map(f => ({
        ...f,
        funcao: unifyMotorista(f.funcao),
      }));
      setFuncionarios(normalized);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const funcoes = [...new Set(funcionarios.map(f => f.funcao))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { funcionarios, funcoes, loading, reload: load };
}
