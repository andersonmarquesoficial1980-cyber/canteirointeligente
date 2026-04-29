import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SetorDestinatario, StatusDemanda, TipoDemanda, UrgenciaDemanda } from "@/lib/demandas";

export interface Demanda {
  id: string;
  titulo: string;
  descricao?: string;
  solicitante_nome: string;
  solicitante_departamento: string;
  funcionario_id?: string;
  funcionario_nome?: string;
  equipamento?: string;
  centro_de_custo?: string;
  data_prevista?: string;
  status: StatusDemanda;
  observacoes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;

  tipo?: TipoDemanda;
  destinatario_setor?: SetorDestinatario;
  urgencia?: UrgenciaDemanda;
  company_id?: string;
  resposta?: string;
  respondido_por?: string;
  respondido_at?: string;
  viewed_by?: string[];

  equipamentos_ids?: string[];
  equipamentos_json?: any[];
  horario_transporte?: string;
  origem?: string;
  origem_maps?: string;
  destino?: string;
  destino_maps?: string;
  foto_url?: string;
  sub_tipo?: string;
  setor_reclamacao?: string;
  itens_material?: any[];
  funcionario_solicitado_id?: string;
  funcionario_solicitado_nome?: string;
  funcao_solicitada?: string;
  setor_origem?: string;
  centro_custo_origem?: string;
}

export type NovaDemandaPayload = Omit<Demanda, "id" | "created_at">;

function normalizeStatus(status?: string): StatusDemanda {
  if (status === "aberta") return "pendente";
  if (status === "aceita") return "em_execucao";
  if (status === "pendente" || status === "em_execucao" || status === "concluida" || status === "cancelada") {
    return status;
  }
  return "pendente";
}

function normalizeDemanda(demanda: Demanda): Demanda {
  return {
    ...demanda,
    status: normalizeStatus(demanda.status),
  };
}

export function useDemandas(filtroStatus?: StatusDemanda) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("demandas")
      .select("*")
      .order("created_at", { ascending: false });

    if (filtroStatus) {
      const statusNormalizado = normalizeStatus(filtroStatus);
      if (statusNormalizado === "em_execucao") {
        query = query.in("status", ["em_execucao", "aceita"]);
      } else if (statusNormalizado === "pendente") {
        query = query.in("status", ["pendente", "aberta"]);
      } else {
        query = query.eq("status", statusNormalizado);
      }
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar demandas", description: error.message, variant: "destructive" });
    } else if (data) {
      setDemandas((data as Demanda[]).map(normalizeDemanda));
    }

    setLoading(false);
  }, [filtroStatus, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const criar = async (demanda: NovaDemandaPayload) => {
    const payload: any = {
      ...demanda,
      status: normalizeStatus(demanda.status),
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase as any).from("demandas").insert(payload);
    if (error) {
      toast({ title: "Erro ao criar demanda", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Demanda criada" });
    await load();
    return true;
  };

  const criarMuitas = async (demandasPayload: NovaDemandaPayload[]) => {
    if (demandasPayload.length === 0) return false;

    const payload = demandasPayload.map((item) => ({
      ...item,
      status: normalizeStatus(item.status),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await (supabase as any).from("demandas").insert(payload);
    if (error) {
      toast({ title: "Erro ao criar demandas", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: `${demandasPayload.length} demanda(s) criada(s)` });
    await load();
    return true;
  };

  const atualizarStatus = async (id: string, status: StatusDemanda, observacoes?: string) => {
    const update: any = {
      status: normalizeStatus(status),
      updated_at: new Date().toISOString(),
    };

    if (observacoes) update.observacoes = observacoes;

    const { error } = await (supabase as any).from("demandas").update(update).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Status atualizado" });
    await load();
    return true;
  };

  const atualizar = async (id: string, dados: Partial<Demanda>) => {
    const payload: any = { ...dados, updated_at: new Date().toISOString() };
    if (payload.status) payload.status = normalizeStatus(payload.status);

    const { error } = await (supabase as any)
      .from("demandas")
      .update(payload)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Demanda atualizada" });
    await load();
    return true;
  };

  const responderDemanda = async (id: string, resposta: string, respondidoPor: string) => {
    const { error } = await (supabase as any)
      .from("demandas")
      .update({
        resposta,
        respondido_por: respondidoPor,
        respondido_at: new Date().toISOString(),
        status: "concluida",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao responder demanda", description: error.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Resposta enviada e demanda concluída" });
    await load();
    return true;
  };

  const marcarVisualizada = async (id: string, userId: string) => {
    const { data, error: selectError } = await (supabase as any)
      .from("demandas")
      .select("viewed_by")
      .eq("id", id)
      .maybeSingle();

    if (selectError) {
      toast({ title: "Erro ao marcar visualização", description: selectError.message, variant: "destructive" });
      return false;
    }

    const atual = Array.isArray(data?.viewed_by) ? data.viewed_by : [];
    if (atual.includes(userId)) return true;

    const { error } = await (supabase as any)
      .from("demandas")
      .update({
        viewed_by: [...atual, userId],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao marcar visualização", description: error.message, variant: "destructive" });
      return false;
    }

    await load();
    return true;
  };

  return {
    demandas,
    loading,
    criar,
    criarMuitas,
    atualizar,
    atualizarStatus,
    responderDemanda,
    marcarVisualizada,
    reload: load,
  };
}

export function useDemandaById(id?: string) {
  const [demanda, setDemanda] = useState<Demanda | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!id) {
      setDemanda(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("demandas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast({ title: "Erro ao carregar demanda", description: error.message, variant: "destructive" });
      setDemanda(null);
    } else {
      setDemanda(data ? normalizeDemanda(data as Demanda) : null);
    }

    setLoading(false);
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return { demanda, loading, reload: load };
}

export type { StatusDemanda };
