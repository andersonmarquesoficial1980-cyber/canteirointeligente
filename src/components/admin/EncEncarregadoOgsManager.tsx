import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Encarregado {
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
  encarregado_id: string;
  ogs_id: string;
  ativo: boolean;
  encarregado_nome?: string;
  ogs_number?: string;
  client_name?: string;
}

export function EncEncarregadoOgsManager() {
  const { toast } = useToast();
  const [encarregados, setEncarregados] = useState<Encarregado[]>([]);
  const [ogsList, setOgsList] = useState<Ogs[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoEnc, setNovoEnc] = useState("");
  const [novaOgs, setNovaOgs] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const companyId = profile?.company_id;

    const [encsRes, ogsRes, vincRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("user_id, nome_completo, email")
        .eq("company_id", companyId)
        .in("perfil", ["Encarregado", "encarregado"])
        .eq("status", "ativo")
        .order("nome_completo"),
      (supabase as any)
        .from("ogs_reference")
        .select("id, ogs_number, client_name")
        .eq("company_id", companyId)
        .order("ogs_number"),
      (supabase as any)
        .from("encarregado_ogs")
        .select("id, encarregado_id, ogs_id, ativo")
        .eq("ativo", true),
    ]);

    setEncarregados(encsRes.data || []);
    setOgsList(ogsRes.data || []);

    const encs = encsRes.data || [];
    const ogs = ogsRes.data || [];
    const v = (vincRes.data || []).map((vv: Vinculo) => ({
      ...vv,
      encarregado_nome: encs.find((e: Encarregado) => e.user_id === vv.encarregado_id)?.nome_completo || vv.encarregado_id,
      ogs_number: ogs.find((o: Ogs) => o.id === vv.ogs_id)?.ogs_number || "—",
      client_name: ogs.find((o: Ogs) => o.id === vv.ogs_id)?.client_name || "—",
    }));
    setVinculos(v);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!novoEnc || !novaOgs) {
      toast({ title: "Selecione encarregado e OGS", variant: "destructive" });
      return;
    }
    if (vinculos.some(v => v.encarregado_id === novoEnc && v.ogs_id === novaOgs)) {
      toast({ title: "Vínculo já existe", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).from("encarregado_ogs").insert({
      encarregado_id: novoEnc,
      ogs_id: novaOgs,
      ativo: true,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo criado!" });
    setNovoEnc("");
    setNovaOgs("");
    load();
  };

  const handleRemove = async (id: string) => {
    const { error } = await (supabase as any)
      .from("encarregado_ogs")
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
          <h2 className="text-base font-bold">Encarregados por OGS</h2>
          <p className="text-xs text-muted-foreground">Vincule encarregados às obras que são responsáveis</p>
        </div>
      </div>

      {encarregados.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          Nenhum usuário com perfil "Encarregado" encontrado. Cadastre os encarregados primeiro em Funcionários e defina o perfil como "Encarregado".
        </div>
      )}

      {/* Formulário de novo vínculo */}
      <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Novo vínculo</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Encarregado</label>
            <select value={novoEnc} onChange={e => setNovoEnc(e.target.value)} className={`${selectCls} w-full`}>
              <option value="">Selecione...</option>
              {encarregados.map(e => (
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
              .sort((a, b) => (a.encarregado_nome || "").localeCompare(b.encarregado_nome || ""))
              .map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                  <div>
                    <p className="text-sm font-semibold">{v.encarregado_nome}</p>
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
