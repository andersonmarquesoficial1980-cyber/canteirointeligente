import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
}

function unifyMotorista(funcao: string): string {
  if (funcao.toUpperCase().includes("MOTORISTA")) return "MOTORISTA";
  return funcao;
}

export function useFuncionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    // Usar tabela 'funcionarios' (Painel de Controle) como fonte única
    // Funções simples, sem graus (JR/PL/SR)
    const { data, error } = await supabase
      .from("funcionarios" as any)
      .select("id, matricula, nome, funcao")
      .order("nome", { ascending: true });
    if (!error && data) {
      const normalized = (data as any[]).map(f => ({
        id: f.id,
        matricula: f.matricula ?? "",
        nome: f.nome,
        funcao: unifyMotorista(f.funcao ?? ""),
      }));
      setFuncionarios(normalized);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const funcoes = [...new Set(funcionarios.map(f => f.funcao))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return { funcionarios, funcoes, loading, reload: load };
}