import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Engenheiro {
  user_id: string;
  nome_completo: string;
  email: string;
}

interface Ogs {
  id: string;
  ogs_number: string;
  client_name: string;
}

interface Vinculo {
  id: string;
  engenheiro_id: string;
  ogs_id: string;
  ativo: boolean;
  engenheiro_nome?: string;
  ogs_number?: string;
  client_name?: string;
}

export function EngenheirosOgsManager() {
  const { toast } = useToast();
  const [engenheiros, setEngenheiros] = useState<Engenheiro[]>([]);
  const [ogsList, setOgsList] = useState<Ogs[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoEng, setNovoEng] = useState("");
  const [novaOgs, setNovaOgs] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const companyId = profile?.company_id;

    const [engsRes, ogsRes, vincRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("user_id, nome_completo, email")
        .eq("company_id", companyId)
        .in("perfil", ["Engenheiro", "engenheiro"])
        .eq("status", "ativo")
        .order("nome_completo"),
      (supabase as any)
        .from("ogs_reference")
        .select("id, ogs_number, client_name")
        .eq("company_id", companyId)
        .order("ogs_number"),
      (supabase as any)
        .from("engenheiro_ogs")
        .select("id, engenheiro_id, ogs_id, ativo")
        .eq("company_id", companyId)
        .eq("ativo", true),
    ]);

    setEngenheiros(engsRes.data || []);
    setOgsList(ogsRes.data || []);

    // Enriquecer vínculos com nomes
    const engs = engsRes.data || [];
    const ogs = ogsRes.data || [];
    const v = (vincRes.data || []).map((vv: Vinculo) => ({
      ...vv,
      engenheiro_nome: engs.find((e: Engenheiro) => e.user_id === vv.engenheiro_id)?.nome_completo || vv.engenheiro_id,
      ogs_number: ogs.find((o: Ogs) => o.id === vv.ogs_id)?.ogs_number || "—",
      client_name: ogs.find((o: Ogs) => o.id === vv.ogs_id)?.client_name || "—",
    }));
    setVinculos(v);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!novoEng || !novaOgs) {
      toast({ title: "Selecione engenheiro e OGS", variant: "destructive" });
      return;
    }
    // Verificar duplicata
    if (vinculos.some(v => v.engenheiro_id === novoEng && v.ogs_id === novaOgs)) {
      toast({ title: "Vínculo já existe", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const { error } = await (supabase as any).from("engenheiro_ogs").insert({
      engenheiro_id: novoEng,
      ogs_id: novaOgs,
      company_id: profile?.company_id,
      ativo: true,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo criado!" });
    setNovoEng("");
    setNovaOgs("");
    load();
  };

  const handleRemove = async (id: string) => {
    const { error } = await (supabase as any)
      .from("engenheiro_ogs")
      .update({ ativo: false })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo removido" });
    load();
  };

  const selectCls = "h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <HardHat className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-bold">Engenheiros por OGS</h2>
          <p className="text-xs text-muted-foreground">Vincule engenheiros às obras que são responsáveis</p>
        </div>
      </div>

      {engenheiros.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          Nenhum usuário com perfil "Engenheiro" encontrado. Cadastre os engenheiros primeiro em Funcionários e defina o perfil como "Engenheiro".
        </div>
      )}

      {/* Formulário de novo vínculo */}
      <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Novo vínculo</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Engenheiro</label>
            <select value={novoEng} onChange={e => setNovoEng(e.target.value)} className={`${selectCls} w-full`}>
              <option value="">Selecione...</option>
              {engenheiros.map(e => (
                <option key={e.user_id} value={e.user_id}>{e.nome_completo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">OGS / Obra</label>
            <select value={novaOgs} onChange={e => setNovaOgs(e.target.value)} className={`${selectCls} w-full`}>
              <option value="">Selecione...</option>
              {ogsList.map(o => (
                <option key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={salvando}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Vincular
        </button>
      </div>

      {/* Lista de vínculos */}
      <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Vínculos ativos ({vinculos.length})</p>
        {vinculos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum vínculo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {vinculos
              .sort((a, b) => (a.engenheiro_nome || "").localeCompare(b.engenheiro_nome || ""))
              .map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                  <div>
                    <p className="text-sm font-semibold">{v.engenheiro_nome}</p>
                    <p className="text-xs text-muted-foreground">{v.ogs_number} — {v.client_name}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(v.id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
