import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Demanda {
  id: string;
  titulo: string;
  descricao?: string;
  solicitante_nome: string;
  solicitante_departamento: string;
  funcionario_id?: string;
  funcionario_nome?: string;
  equipamento?: string;
  centro_de_custo: string;
  data_prevista?: string;
  status: "pendente" | "aceita" | "em_execucao" | "concluida" | "cancelada";
  observacoes?: string;
  created_at: string;
}

export type StatusDemanda = Demanda["status"];

export function useDemandas(filtroStatus?: StatusDemanda) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    let query = (supabase as any).from("demandas").select("*").order("created_at", { ascending: false });
    if (filtroStatus) query = query.eq("status", filtroStatus);
    const { data, error } = await query;
    if (!error && data) setDemandas(data as Demanda[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filtroStatus]);

  const criar = async (demanda: Omit<Demanda, "id" | "created_at">) => {
    const { error } = await (supabase as any).from("demandas").insert(demanda);
    if (error) {
      toast({ title: "Erro ao criar demanda", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "✅ Demanda criada!" });
    await load();
    return true;
  };

  const atualizarStatus = async (id: string, status: StatusDemanda, observacoes?: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (observacoes) update.observacoes = observacoes;
    const { error } = await (supabase as any).from("demandas").update(update).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "✅ Status atualizado!" });
    await load();
    return true;
  };

  const atualizar = async (id: string, dados: Partial<Demanda>) => {
    const { error } = await (supabase as any)
      .from("demandas")
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "✅ Demanda atualizada!" });
    await load();
    return true;
  };

  return { demandas, loading, criar, atualizar, atualizarStatus, reload: load };
}
