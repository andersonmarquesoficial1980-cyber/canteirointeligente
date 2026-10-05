import { supabase } from "@/integrations/supabase/client";

export async function validatePointingRdo(id: string, acao: "validado" | "rejeitado", motivo: string): Promise<void> {
  const client = supabase as unknown as {
    rpc: (name: string, args: Record<string, string | null>) => Promise<{
      data: unknown; error: { message: string } | null;
    }>;
  };
  const { data, error } = await client.rpc("wf_validar_rdo_apontador", {
    p_rdo_id: id,
    p_acao: acao,
    p_motivo: acao === "rejeitado" ? motivo.trim() : null,
  });
  if (error) throw new Error(error.message);
  if (data !== id) throw new Error("O RDO não foi atualizado. Atualize a lista e tente novamente.");
}
