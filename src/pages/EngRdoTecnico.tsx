import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ogs { id: string; ogs_number: string; client_name: string }

const TIPOS_SERVICO = ["Fresagem", "Pavimentação CBUQ", "Pavimentação CONCRETO", "Reperfilamento", "RAP Espumado", "BGS", "Outro"];
const SOLUCOES = ["1", "02-A", "02-B", "02-C", "03-A", "03-B", "3"];

export default function EngRdoTecnico() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [minhasOgs, setMinhasOgs] = useState<Ogs[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [usinas, setUsinas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const hoje = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    ogs_id: "",
    data: hoje,
    houve_producao: true,
    equipe: "",
    localizacao: "",
    tipo_servico: "",
    solucao_empregada: "",
    usina_programada: "",
    cauq_programado: "",
    usina_atendeu: "",
    fresagem_m2: "",
    rap_espumado_m2: "",
    binder_ton: "",
    cbuq_fx3_ton: "",
    gap_ton: "",
    bgs_ton: "",
    geogrelha_m2: "",
    qtd_caminhoes_fresa: "",
    perc_conclusao_via: "",
    houve_ocorrencia: false,
    descricao_ocorrencia: "",
    observacoes: "",
  });

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));
  const toNum = (v: string) => v === "" ? null : Number(v.replace(",", "."));

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // OGSs: busca pelas vinculadas ao engenheiro; se nenhuma, busca todas da empresa
      const { data: vinculos } = await (supabase as any)
        .from("engenheiro_ogs")
        .select("ogs_reference(id, ogs_number, client_name)")
        .eq("engenheiro_id", user.id)
        .eq("ativo", true);

      const ogsVinculadas = (vinculos || []).map((v: any) => v.ogs_reference).filter(Boolean);

      if (ogsVinculadas.length > 0) {
        setMinhasOgs(ogsVinculadas);
      } else {
        // Fallback: buscar todas OGSs da empresa
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        const { data: todasOgs } = await (supabase as any)
          .from("ogs_reference")
          .select("id, ogs_number, client_name")
          .eq("company_id", profile?.company_id)
          .order("ogs_number");
        setMinhasOgs(todasOgs || []);
      }

      // Equipes cadastradas
      const { data: eqs } = await (supabase as any)
        .from("ci_equipes")
        .select("nome")
        .order("nome");
      setEquipes((eqs || []).map((e: any) => e.nome));

      // Usinas cadastradas
      const { data: us } = await (supabase as any)
        .from("usinas")
        .select("nome")
        .order("nome");
      setUsinas((us || []).map((u: any) => u.nome));
    };
    load();
  }, []);

  const handleSalvar = async (status: "rascunho" | "enviado") => {
    if (!form.ogs_id) { toast({ title: "Selecione uma OGS", variant: "destructive" }); return; }
    if (!form.data) { toast({ title: "Informe a data", variant: "destructive" }); return; }
    setSalvando(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", user?.id)
      .single();

    const selectedOgs = minhasOgs.find(o => o.id === form.ogs_id);

    const payload = {
      company_id: profile?.company_id,
      engenheiro_id: user?.id,
      ogs_id: form.ogs_id,
      ogs_number: selectedOgs?.ogs_number,
      data: form.data,
      houve_producao: form.houve_producao,
      equipe: form.equipe || null,
      localizacao: form.localizacao || null,
      tipo_servico: form.tipo_servico || null,
      solucao_empregada: form.solucao_empregada || null,
      usina_programada: form.usina_programada || null,
      cauq_programado: toNum(form.cauq_programado),
      usina_atendeu: form.usina_atendeu === "" ? null : form.usina_atendeu === "sim",
      fresagem_m2: toNum(form.fresagem_m2),
      rap_espumado_m2: toNum(form.rap_espumado_m2),
      binder_ton: toNum(form.binder_ton),
      cbuq_fx3_ton: toNum(form.cbuq_fx3_ton),
      gap_ton: toNum(form.gap_ton),
      bgs_ton: toNum(form.bgs_ton),
      geogrelha_m2: toNum(form.geogrelha_m2),
      qtd_caminhoes_fresa: form.qtd_caminhoes_fresa === "" ? null : parseInt(form.qtd_caminhoes_fresa),
      perc_conclusao_via: toNum(form.perc_conclusao_via),
      houve_ocorrencia: form.houve_ocorrencia,
      descricao_ocorrencia: form.houve_ocorrencia ? form.descricao_ocorrencia || null : null,
      observacoes: form.observacoes || null,
      status,
    };

    const { error } = await (supabase as any).from("rdo_engenheiro").insert(payload);
    setSalvando(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    setSalvo(true);
    toast({ title: status === "enviado" ? "RDO enviado!" : "Rascunho salvo" });
    setTimeout(() => navigate("/engenharia"), 1200);
  };

  const inputCls = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";
  const sectionCls = "rounded-2xl bg-white border border-border p-4 space-y-4";

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">RDO Técnico</h1>
            <p className="text-xs text-muted-foreground">Lançamento de Engenharia</p>
          </div>
        </div>

        {/* Seção 1 — Identificação */}
        <div className={sectionCls}>
          <h2 className="text-sm font-bold text-foreground">Identificação</h2>

          <div>
            <label className={labelCls}>OGS / Obra *</label>
            <select value={form.ogs_id} onChange={e => set("ogs_id", e.target.value)} className={inputCls}>
              <option value="">Selecione a obra...</option>
              {minhasOgs.map(o => (
                <option key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Data *</label>
            <input type="date" value={form.data} onChange={e => set("data", e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Houve produção?</label>
            <div className="flex gap-3">
              {["Sim", "Não"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("houve_producao", opt === "Sim")}
                  className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.houve_producao === (opt === "Sim")
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>
        </div>

        {form.houve_producao && (
          <>
            {/* Seção 2 — Produção */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Produção</h2>

              <div>
                <label className={labelCls}>Equipe</label>
                <select value={form.equipe} onChange={e => set("equipe", e.target.value)} className={inputCls}>
                  <option value="">Selecione a equipe...</option>
                  {equipes.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Localização / Rua</label>
                <input value={form.localizacao} onChange={e => set("localizacao", e.target.value)} placeholder="Ex: Av. Paulista, 1000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tipo de Serviço</label>
                <select value={form.tipo_servico} onChange={e => set("tipo_servico", e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {TIPOS_SERVICO.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Solução Empregada</label>
                <select value={form.solucao_empregada} onChange={e => set("solucao_empregada", e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {SOLUCOES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Usina Programada</label>
                <select value={form.usina_programada} onChange={e => set("usina_programada", e.target.value)} className={inputCls}>
                  <option value="">Selecione a usina...</option>
                  {usinas.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>CAUQ Programado (ton)</label>
                <input type="number" value={form.cauq_programado} onChange={e => set("cauq_programado", e.target.value)} placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Usina atendeu?</label>
                <div className="flex gap-3">
                  {["sim", "nao", ""].map((opt, i) => (
                    <button key={i} type="button"
                      onClick={() => set("usina_atendeu", opt)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        form.usina_atendeu === opt ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"
                      }`}
                    >{opt === "sim" ? "Sim" : opt === "nao" ? "Não" : "N/A"}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Seção 3 — Quantitativos */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Quantitativos de Produção</h2>
              {[
                { label: "Fresagem (m²)", field: "fresagem_m2" },
                { label: "RAP Espumado (m²)", field: "rap_espumado_m2" },
                { label: "Binder (ton)", field: "binder_ton" },
                { label: "CBUQ FX3 (ton)", field: "cbuq_fx3_ton" },
                { label: "GAP (ton)", field: "gap_ton" },
                { label: "BGS (ton)", field: "bgs_ton" },
                { label: "Geogrelha (m²)", field: "geogrelha_m2" },
                { label: "Qtd caminhões fresa/demolição", field: "qtd_caminhoes_fresa" },
                { label: "% conclusão da via", field: "perc_conclusao_via" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className={labelCls}>{label}</label>
                  <input
                    type="number"
                    value={(form as any)[field]}
                    onChange={e => set(field, e.target.value)}
                    placeholder="0"
                    min={0}
                    max={field === "perc_conclusao_via" ? 100 : undefined}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            {/* Seção 4 — Ocorrências */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Ocorrências</h2>
              <div>
                <label className={labelCls}>Houve ocorrência?</label>
                <div className="flex gap-3">
                  {["Sim", "Não"].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => set("houve_ocorrencia", opt === "Sim")}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        form.houve_ocorrencia === (opt === "Sim") ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              {form.houve_ocorrencia && (
                <div>
                  <label className={labelCls}>Descrição da ocorrência</label>
                  <textarea
                    value={form.descricao_ocorrencia}
                    onChange={e => set("descricao_ocorrencia", e.target.value)}
                    rows={3}
                    placeholder="Descreva o que aconteceu..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Observações */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold">Observações Gerais</h2>
              <textarea
                value={form.observacoes}
                onChange={e => set("observacoes", e.target.value)}
                rows={3}
                placeholder="Observações adicionais..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
          </>
        )}

        {/* Botões fixos */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => handleSalvar("rascunho")}
            disabled={salvando || salvo}
            className="flex-1 h-12 rounded-xl border-2 border-border text-foreground font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Salvar rascunho"}
          </button>
          <button
            onClick={() => handleSalvar("enviado")}
            disabled={salvando || salvo}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {salvo ? <CheckCircle2 className="w-4 h-4" /> : salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {salvo ? "Enviado!" : "Enviar RDO"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
