import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTiposServico } from "@/hooks/useFilteredData";

interface Ogs { id: string; ogs_number: string; client_name: string }

export default function EngRdoTecnicoEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: tiposServicoDB } = useTiposServico("CAUQ");
  const tiposServico = tiposServicoDB?.map(s => s.nome) ?? [];
  const [minhasOgs, setMinhasOgs] = useState<Ogs[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [usinas, setUsinas] = useState<string[]>([]);
  const [localizacoesSugeridas, setLocalizacoesSugeridas] = useState<string[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState({
    ogs_id: "",
    data: "",
    houve_producao: true,
    equipe: "",
    localizacao: "",
    tipos_servico: [] as string[],
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
    sma_ton: "",
    geogrelha_m2: "",
    egl_ton: "",
    rachao_ton: "",
    qtd_caminhoes_fresa: "",
    perc_conclusao_via: "",
    houve_ocorrencia: false,
    descricao_ocorrencia: "",
    observacoes: "",
  });

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));
  const toNum = (v: string) => v === "" ? null : Number(v.replace(",", "."));
  const numToStr = (v: number | null) => v == null ? "" : String(v);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar RDO existente
      const { data: rdo } = await (supabase as any)
        .from("rdo_engenheiro").select("*").eq("id", id).single();

      if (rdo) {
        setForm({
          ogs_id: rdo.ogs_id || "",
          data: rdo.data || "",
          houve_producao: rdo.houve_producao ?? true,
          equipe: rdo.equipe || "",
          localizacao: rdo.localizacao || "",
          tipos_servico: rdo.tipo_servico ? rdo.tipo_servico.split(", ").map((s: string) => s.trim()) : [],
          solucao_empregada: rdo.solucao_empregada || "",
          usina_programada: rdo.usina_programada || "",
          cauq_programado: numToStr(rdo.cauq_programado),
          usina_atendeu: rdo.usina_atendeu == null ? "" : rdo.usina_atendeu ? "sim" : "nao",
          fresagem_m2: numToStr(rdo.fresagem_m2),
          rap_espumado_m2: numToStr(rdo.rap_espumado_m2),
          binder_ton: numToStr(rdo.binder_ton),
          cbuq_fx3_ton: numToStr(rdo.cbuq_fx3_ton),
          gap_ton: numToStr(rdo.gap_ton),
          bgs_ton: numToStr(rdo.bgs_ton),
          sma_ton: numToStr(rdo.sma_ton),
          geogrelha_m2: numToStr(rdo.geogrelha_m2),
          egl_ton: numToStr((rdo as any).egl_ton),
          rachao_ton: numToStr((rdo as any).rachao_ton),
          qtd_caminhoes_fresa: numToStr(rdo.qtd_caminhoes_fresa),
          perc_conclusao_via: numToStr(rdo.perc_conclusao_via),
          houve_ocorrencia: rdo.houve_ocorrencia ?? false,
          descricao_ocorrencia: rdo.descricao_ocorrencia || "",
          observacoes: rdo.observacoes || "",
        });
      }

      // OGSs
      const { data: vinculos } = await (supabase as any)
        .from("engenheiro_ogs")
        .select("ogs_reference(id, ogs_number, client_name)")
        .eq("engenheiro_id", user.id)
        .eq("ativo", true);
      const ogsVinculadas = (vinculos || []).map((v: any) => v.ogs_reference).filter(Boolean);
      if (ogsVinculadas.length > 0) {
        setMinhasOgs([...ogsVinculadas].sort((a: Ogs, b: Ogs) => parseInt(b.ogs_number) - parseInt(a.ogs_number)));
      } else {
        const { data: profile } = await (supabase as any).from("profiles").select("company_id").eq("user_id", user.id).single();
        const { data: todasOgs } = await (supabase as any).from("ogs_reference").select("id, ogs_number, client_name").eq("company_id", profile?.company_id).order("ogs_number", { ascending: false });
        setMinhasOgs(todasOgs || []);
      }

      // Equipes e usinas
      const { data: eqs } = await (supabase as any).from("ci_equipes").select("nome").order("nome");
      setEquipes((eqs || []).map((e: any) => e.nome));
      const { data: us } = await (supabase as any).from("usinas").select("nome").order("nome");
      setUsinas((us || []).map((u: any) => u.nome));

      setCarregando(false);
    };
    load();
  }, [id]);

  // Sugestões de localização
  useEffect(() => {
    if (!form.ogs_id) { setLocalizacoesSugeridas([]); return; }
    const buscar = async () => {
      const { data } = await (supabase as any).from("ogs_reference").select("location_address").eq("id", form.ogs_id).single();
      if (data?.location_address) {
        setLocalizacoesSugeridas(data.location_address.split(";").map((r: string) => r.trim()).filter(Boolean));
      } else {
        setLocalizacoesSugeridas([]);
      }
    };
    buscar();
  }, [form.ogs_id]);

  const handleSalvar = async (status: "rascunho" | "enviado") => {
    if (!form.ogs_id) { toast({ title: "Selecione uma OGS", variant: "destructive" }); return; }
    if (!form.data) { toast({ title: "Informe a data", variant: "destructive" }); return; }
    setSalvando(true);

    const selectedOgs = minhasOgs.find(o => o.id === form.ogs_id);

    const payload = {
      ogs_id: form.ogs_id,
      ogs_number: selectedOgs?.ogs_number,
      data: form.data,
      houve_producao: form.houve_producao,
      equipe: form.equipe || null,
      localizacao: form.localizacao || null,
      tipo_servico: form.tipos_servico.length > 0 ? form.tipos_servico.join(", ") : null,
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
      sma_ton: toNum(form.sma_ton),
      geogrelha_m2: toNum(form.geogrelha_m2),
      egl_ton: toNum(form.egl_ton),
      rachao_ton: toNum(form.rachao_ton),
      qtd_caminhoes_fresa: form.qtd_caminhoes_fresa === "" ? null : parseInt(form.qtd_caminhoes_fresa),
      perc_conclusao_via: toNum(form.perc_conclusao_via),
      houve_ocorrencia: form.houve_ocorrencia,
      descricao_ocorrencia: form.houve_ocorrencia ? form.descricao_ocorrencia || null : null,
      observacoes: form.observacoes || null,
      status,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase as any).from("rdo_engenheiro").update(payload).eq("id", id);
    setSalvando(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    setSalvo(true);
    toast({ title: status === "enviado" ? "RDO atualizado e enviado!" : "Rascunho salvo" });
    setTimeout(() => navigate(`/engenharia/rdo-tecnico/${id}`), 1200);
  };

  const inputCls = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";
  const sectionCls = "rounded-2xl bg-white border border-border p-4 space-y-4";

  if (carregando) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Editar RDO Técnico</h1>
            <p className="text-xs text-muted-foreground">Alterar lançamento de Engenharia</p>
          </div>
        </div>

        {/* Seção 1 — Identificação */}
        <div className={sectionCls}>
          <h2 className="text-sm font-bold text-foreground">Identificação</h2>
          <div>
            <label className={labelCls}>OGS / Obra *</label>
            <select value={form.ogs_id} onChange={e => set("ogs_id", e.target.value)} className={inputCls}>
              <option value="">Selecione a obra...</option>
              {minhasOgs.map(o => (<option key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</option>))}
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
                <button key={opt} type="button" onClick={() => set("houve_producao", opt === "Sim")}
                  className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${form.houve_producao === (opt === "Sim") ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"}`}
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
              <div className="relative">
                <label className={labelCls}>Localização / Rua</label>
                <input value={form.localizacao}
                  onChange={e => { set("localizacao", e.target.value); setShowSugestoes(true); }}
                  onFocus={() => setShowSugestoes(true)}
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                  placeholder="Ex: Av. Paulista, 1000" className={inputCls} autoComplete="off" />
                {showSugestoes && localizacoesSugeridas.length > 0 && (() => {
                  const filtradas = form.localizacao ? localizacoesSugeridas.filter(s => s.toLowerCase().includes(form.localizacao.toLowerCase())) : localizacoesSugeridas;
                  return filtradas.length > 0 ? (
                    <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filtradas.map((s, i) => (<li key={i} onMouseDown={() => { set("localizacao", s); setShowSugestoes(false); }} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary/10 hover:text-primary">{s}</li>))}
                    </ul>
                  ) : null;
                })()}
              </div>
              <div>
                <label className={labelCls}>Tipo de Serviço</label>
                <div className="rounded-xl border border-border bg-background p-2 space-y-1 max-h-52 overflow-y-auto">
                  {tiposServico.map(t => (
                    <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm">
                      <input type="checkbox" checked={form.tipos_servico.includes(t)}
                        onChange={e => { const prev = form.tipos_servico; set("tipos_servico", e.target.checked ? [...prev, t] : prev.filter(x => x !== t)); }}
                        className="w-4 h-4 accent-primary" />{t}
                    </label>
                  ))}
                  {form.tipos_servico.length > 0 && (
                    <p className="text-xs text-primary font-semibold px-2 pt-1 border-t border-border">
                      {form.tipos_servico.length} selecionado{form.tipos_servico.length > 1 ? "s" : ""}: {form.tipos_servico.join(", ")}
                    </p>
                  )}
                </div>
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
                <input type="number" value={form.cauq_programado} onChange={e => set("cauq_programado", e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Usina atendeu?</label>
                <div className="flex gap-3">
                  {["sim", "nao"].map(opt => (
                    <button key={opt} type="button" onClick={() => set("usina_atendeu", opt)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${form.usina_atendeu === opt ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"}`}
                    >{opt === "sim" ? "Sim" : "Não"}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Seção 3 — Quantitativos */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Quantitativos de Produção</h2>
              
              {/* Mapeamento: Tipo de Serviço → Campo de Produção
                  - FRESAGEM → fresagem_m2
                  - RAP ESPUMADO → rap_espumado_m2
                  - BINDER → binder_ton (não há checkbox, sempre visível)
                  - CBUQ FX3 → cbuq_fx3_ton (não há checkbox, sempre visível)
                  - GAP GRADED → gap_ton
                  - BGS → bgs_ton
                  - SMA → sma_ton
                  - Geogrelha → geogrelha_m2 (não há checkbox, sempre visível)
                  - EGL → egl_ton (novo campo)
                  - RACHÃO → rachao_ton (novo campo)
              */}
              
              {[
                { label: "Fresagem (m²)", field: "fresagem_m2", requiredType: "FRESAGEM" },
                { label: "RAP Espumado (m²)", field: "rap_espumado_m2", requiredType: "RAP ESPUMADO" },
                { label: "Binder (ton)", field: "binder_ton", requiredType: null },
                { label: "CBUQ FX3 (ton)", field: "cbuq_fx3_ton", requiredType: null },
                { label: "GAP (ton)", field: "gap_ton", requiredType: "GAP GRADED" },
                { label: "BGS (ton)", field: "bgs_ton", requiredType: "BGS" },
                { label: "SMA (ton)", field: "sma_ton", requiredType: "SMA" },
                { label: "Geogrelha (m²)", field: "geogrelha_m2", requiredType: null },
                { label: "EGL (ton)", field: "egl_ton", requiredType: "EGL" },
                { label: "RACHÃO (ton)", field: "rachao_ton", requiredType: "RACHÃO" },
                { label: "Qtd caminhões fresa/demolição", field: "qtd_caminhoes_fresa", requiredType: null },
                { label: "% conclusão da via", field: "perc_conclusao_via", requiredType: null },
              ].map(({ label, field, requiredType }) => {
                const shouldShow = requiredType === null || form.tipos_servico.includes(requiredType);
                return shouldShow ? (
                  <div key={field}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" value={(form as any)[field]} onChange={e => set(field, e.target.value)}
                      placeholder="0" min={0} max={field === "perc_conclusao_via" ? 100 : undefined} className={inputCls} />
                  </div>
                ) : null;
              })}
            </div>

            {/* Seção 4 — Ocorrências */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Ocorrências</h2>
              <div>
                <label className={labelCls}>Houve ocorrência?</label>
                <div className="flex gap-3">
                  {["Sim", "Não"].map(opt => (
                    <button key={opt} type="button" onClick={() => set("houve_ocorrencia", opt === "Sim")}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${form.houve_ocorrencia === (opt === "Sim") ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"}`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              {form.houve_ocorrencia && (
                <div>
                  <label className={labelCls}>Descrição da ocorrência</label>
                  <textarea value={form.descricao_ocorrencia} onChange={e => set("descricao_ocorrencia", e.target.value)}
                    placeholder="Descreva o que aconteceu..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 min-h-[80px] resize-none" />
                </div>
              )}
            </div>
          </>
        )}

        {/* Seção 5 — Observações */}
        <div className={sectionCls}>
          <h2 className="text-sm font-bold text-foreground">Observações</h2>
          <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações gerais..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 min-h-[80px] resize-none" />
        </div>

        {/* Botões */}
        {salvo ? (
          <div className="flex items-center justify-center gap-2 py-4 text-green-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Salvo com sucesso!
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 max-w-lg mx-auto">
            <button onClick={() => handleSalvar("rascunho")} disabled={salvando}
              className="flex-1 h-12 rounded-xl border border-border text-sm font-semibold hover:bg-muted flex items-center justify-center gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Rascunho
            </button>
            <button onClick={() => handleSalvar("enviado")} disabled={salvando}
              className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar e Enviar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
