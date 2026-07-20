import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTiposServico } from "@/hooks/useFilteredData";

interface Ogs { id: string; ogs_number: string; client_name: string }

export default function EngRdoTecnico() {
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

  const hoje = new Date().toISOString().split("T")[0];

  const motivosSemProducao = ["Chuva", "Sem Atividade", "Folga / Feriado", "Outro"];
  const niveisChuva = ["Fraco", "Moderado", "Forte"];
  const tiposSecao = ["Funcional", "Intermediário", "Estrutural"];

  const [form, setForm] = useState({
    ogs_id: "",
    data: hoje,
    houve_producao: true,
    choveu: false,
    intensidade_chuva: "",
    tipo_secao: [] as string[],
    motivo_sem_producao: "",
    outro_motivo_sem_producao: "",
    equipe: "",
    localizacao: "",
    tipos_servico: [] as string[],
    infra_descricao: "",
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
    bgtc_m3: "",
    macadame_m3: "",
    cauq_rima_ton: "",
    bm25_ton: "",
    geogrelha_m2: "",
    egl_ton: "",
    rachao_ton: "",
    qtd_caminhoes_fresa: "",
    perc_conclusao_via: "",
    equipamentos_conforme: "",
    equipamentos_nao_conformes: "",
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
        const sorted = [...ogsVinculadas].sort((a: Ogs, b: Ogs) =>
          parseInt(b.ogs_number) - parseInt(a.ogs_number)
        );
        setMinhasOgs(sorted);
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
          .order("ogs_number", { ascending: false });
        setMinhasOgs(todasOgs || []);
      }

      // Equipes cadastradas
      const { data: eqs } = await (supabase as any)
        .from("ci_equipes")
        .select("nome")
        .order("nome");
      setEquipes((eqs || []).map((e: any) => e.nome));

      // Usinas cadastradas: buscar fornecedores vinculados a CAUQ/PAVIMENTACAO com tipo_insumo Massa Asfáltica
      const { data: fornecs } = await (supabase as any)
        .from("fornecedores")
        .select("nome, vinculo_rdo, tipo_insumos")
        .or("vinculo_rdo.eq.CAUQ,vinculo_rdo.eq.PAVIMENTACAO")
        .order("nome");
      
      const usinasList = (fornecs || [])
        .filter((f: any) => {
          // Filtrar apenas fornecedores com Massa Asfáltica
          const tipos = f.tipo_insumos || [];
          const tiposStr = f.tipo_insumo || "";
          return tipos.includes("Massa Asfáltica") || tiposStr.includes("Massa Asfáltica");
        })
        .map((f: any) => f.nome);
      
      setUsinas(usinasList);
    };
    load();
  }, []);

  // Busca localizações cadastradas no location_address da OGS selecionada
  useEffect(() => {
    if (!form.ogs_id) { setLocalizacoesSugeridas([]); return; }
    const buscarLocalizacoes = async () => {
      const { data } = await (supabase as any)
        .from("ogs_reference")
        .select("location_address")
        .eq("id", form.ogs_id)
        .single();
      if (data?.location_address) {
        const ruas = data.location_address
          .split(";")
          .map((r: string) => r.trim())
          .filter(Boolean);
        setLocalizacoesSugeridas(ruas);
      } else {
        setLocalizacoesSugeridas([]);
      }
    };
    buscarLocalizacoes();
  }, [form.ogs_id]);

  const ogsSelecionada = minhasOgs.find(o => o.id === form.ogs_id);
  const obraExigeSecao = !!ogsSelecionada?.client_name && /(MOTIVA|PMSP)/i.test(ogsSelecionada.client_name);

  useEffect(() => {
    if (!obraExigeSecao && form.tipo_secao.length > 0) {
      set("tipo_secao", []);
    }
  }, [obraExigeSecao]);

  const handleSalvar = async (status: "rascunho" | "enviado") => {
    if (!form.ogs_id) { toast({ title: "Selecione uma OGS", variant: "destructive" }); return; }
    if (!form.data) { toast({ title: "Informe a data", variant: "destructive" }); return; }
    if (!form.houve_producao && !form.motivo_sem_producao) {
      toast({ title: "Selecione o motivo da não produção", variant: "destructive" });
      return;
    }
    if (!form.houve_producao && form.motivo_sem_producao === "Outro" && !form.outro_motivo_sem_producao.trim()) {
      toast({ title: "Descreva o motivo em 'Outro'", variant: "destructive" });
      return;
    }
    if (form.choveu && !form.intensidade_chuva) {
      toast({ title: "Selecione a intensidade da chuva", variant: "destructive" });
      return;
    }
    if (obraExigeSecao && form.tipo_secao.length === 0) {
      toast({ title: "Selecione ao menos uma seção da obra", variant: "destructive" });
      return;
    }
    if (form.tipos_servico.includes("INFRA") && !form.infra_descricao.trim()) {
      toast({ title: "Descreva o tipo de infra executada", variant: "destructive" });
      return;
    }
    if (form.houve_producao && form.equipamentos_conforme === "") {
      toast({ title: "Informe a condição dos equipamentos na obra", variant: "destructive" });
      return;
    }
    if (form.houve_producao && form.equipamentos_conforme === "nao" && !form.equipamentos_nao_conformes.trim()) {
      toast({ title: "Descreva quais equipamentos não estão conformes", variant: "destructive" });
      return;
    }
    setSalvando(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("company_id")
      .eq("user_id", user?.id)
      .single();

    const semProducao = !form.houve_producao;

    const payload = {
      company_id: profile?.company_id,
      engenheiro_id: user?.id,
      ogs_id: form.ogs_id,
      ogs_number: ogsSelecionada?.ogs_number,
      data: form.data,
      houve_producao: form.houve_producao,
      choveu: form.choveu,
      intensidade_chuva: form.choveu ? form.intensidade_chuva || null : null,
      tipo_secao: obraExigeSecao
        ? (form.tipo_secao.length > 0 ? form.tipo_secao.join(", ") : null)
        : null,
      motivo_sem_producao: semProducao ? form.motivo_sem_producao || null : null,
      outro_motivo_sem_producao: semProducao && form.motivo_sem_producao === "Outro"
        ? form.outro_motivo_sem_producao.trim() || null
        : null,
      equipe: semProducao ? null : form.equipe || null,
      localizacao: semProducao ? null : form.localizacao || null,
      tipo_servico: semProducao ? null : form.tipos_servico.length > 0 ? form.tipos_servico.join(", ") : null,
      infra_descricao: semProducao ? null : form.tipos_servico.includes("INFRA") ? form.infra_descricao.trim() || null : null,
      solucao_empregada: semProducao ? null : form.solucao_empregada || null,
      usina_programada: semProducao ? null : form.usina_programada || null,
      cauq_programado: semProducao ? null : toNum(form.cauq_programado),
      usina_atendeu: semProducao ? null : form.usina_atendeu === "" ? null : form.usina_atendeu === "sim",
      fresagem_m2: semProducao ? null : toNum(form.fresagem_m2),
      rap_espumado_m2: semProducao ? null : toNum(form.rap_espumado_m2),
      binder_ton: semProducao ? null : toNum(form.binder_ton),
      cbuq_fx3_ton: semProducao ? null : toNum(form.cbuq_fx3_ton),
      gap_ton: semProducao ? null : toNum(form.gap_ton),
      bgs_ton: semProducao ? null : toNum(form.bgs_ton),
      sma_ton: semProducao ? null : toNum((form as any).sma_ton),
      bgtc_m3: semProducao ? null : toNum(form.bgtc_m3),
      macadame_m3: semProducao ? null : toNum(form.macadame_m3),
      cauq_rima_ton: semProducao ? null : toNum(form.cauq_rima_ton),
      bm25_ton: semProducao ? null : toNum(form.bm25_ton),
      geogrelha_m2: semProducao ? null : toNum(form.geogrelha_m2),
      egl_ton: semProducao ? null : toNum(form.egl_ton),
      rachao_ton: semProducao ? null : toNum(form.rachao_ton),
      qtd_caminhoes_fresa: semProducao ? null : form.qtd_caminhoes_fresa === "" ? null : parseInt(form.qtd_caminhoes_fresa),
      perc_conclusao_via: semProducao ? null : toNum(form.perc_conclusao_via),
      equipamentos_conforme: semProducao ? null : form.equipamentos_conforme === "" ? null : form.equipamentos_conforme === "sim",
      equipamentos_nao_conformes: semProducao
        ? null
        : form.equipamentos_conforme === "nao"
          ? form.equipamentos_nao_conformes.trim() || null
          : null,
      houve_ocorrencia: semProducao ? false : form.houve_ocorrencia,
      descricao_ocorrencia: semProducao ? null : form.houve_ocorrencia ? form.descricao_ocorrencia || null : null,
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
    <>
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
                  onClick={() => {
                    const houveProducao = opt === "Sim";
                    setForm(prev => ({
                      ...prev,
                      houve_producao: houveProducao,
                      ...(houveProducao
                        ? { motivo_sem_producao: "", outro_motivo_sem_producao: "" }
                        : {}),
                    }));
                  }}
                  className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.houve_producao === (opt === "Sim")
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          {!form.houve_producao && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Motivo da não produção *</label>
                <div className="grid grid-cols-2 gap-2">
                  {motivosSemProducao.map((motivo) => (
                    <button
                      key={motivo}
                      type="button"
                      onClick={() => set("motivo_sem_producao", motivo)}
                      className={`h-10 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        form.motivo_sem_producao === motivo
                          ? "bg-primary text-white border-primary"
                          : "bg-background text-foreground border-border"
                      }`}
                    >
                      {motivo}
                    </button>
                  ))}
                </div>
              </div>

              {form.motivo_sem_producao === "Outro" && (
                <div>
                  <label className={labelCls}>Descreva o motivo *</label>
                  <textarea
                    value={form.outro_motivo_sem_producao}
                    onChange={e => set("outro_motivo_sem_producao", e.target.value)}
                    rows={3}
                    placeholder="Digite o motivo da não produção..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seção 1.5 — Meteorologia */}
        <div className={sectionCls}>
          <h2 className="text-sm font-bold text-foreground">Meteorologia</h2>

          <div>
            <label className={labelCls}>Choveu no período?</label>
            <div className="flex gap-3">
              {["Sim", "Não"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const choveu = opt === "Sim";
                    setForm(prev => ({
                      ...prev,
                      choveu,
                      intensidade_chuva: choveu ? prev.intensidade_chuva : "",
                    }));
                  }}
                  className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.choveu === (opt === "Sim")
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          {form.choveu && (
            <div>
              <label className={labelCls}>Nível da chuva *</label>
              <div className="grid grid-cols-3 gap-2">
                {niveisChuva.map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => set("intensidade_chuva", nivel)}
                    className={`h-10 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.intensidade_chuva === nivel
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    {nivel}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {obraExigeSecao && (
          <div className={sectionCls}>
            <h2 className="text-sm font-bold text-foreground">Seção da Obra</h2>
            <div>
              <label className={labelCls}>Selecione a seção (1 ou mais) *</label>
              <div className="grid grid-cols-1 gap-2">
                {tiposSecao.map((secao) => (
                  <button
                    key={secao}
                    type="button"
                    onClick={() => {
                      const atual = form.tipo_secao;
                      set("tipo_secao", atual.includes(secao)
                        ? atual.filter((s) => s !== secao)
                        : [...atual, secao]);
                    }}
                    className={`h-10 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.tipo_secao.includes(secao)
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    {secao}
                  </button>
                ))}
              </div>
              {form.tipo_secao.length > 0 && (
                <p className="text-xs text-primary font-semibold mt-2">
                  Selecionada{form.tipo_secao.length > 1 ? "s" : ""}: {form.tipo_secao.join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

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
                <input
                  value={form.localizacao}
                  onChange={e => { set("localizacao", e.target.value); setShowSugestoes(true); }}
                  onFocus={() => setShowSugestoes(true)}
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                  placeholder="Ex: Av. Paulista, 1000"
                  className={inputCls}
                  autoComplete="off"
                />
                {showSugestoes && localizacoesSugeridas.length > 0 && (() => {
                  const filtradas = form.localizacao
                    ? localizacoesSugeridas.filter(s => s.toLowerCase().includes(form.localizacao.toLowerCase()))
                    : localizacoesSugeridas;
                  return filtradas.length > 0 ? (
                    <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filtradas.map((s, i) => (
                        <li
                          key={i}
                          onMouseDown={() => { set("localizacao", s); setShowSugestoes(false); }}
                          className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary/10 hover:text-primary"
                        >{s}</li>
                      ))}
                    </ul>
                  ) : null;
                })()}
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
                  {["sim", "nao"].map((opt) => (
                    <button key={opt} type="button"
                      onClick={() => set("usina_atendeu", opt)}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        form.usina_atendeu === opt ? "bg-primary text-white border-primary" : "bg-background text-foreground border-border"
                      }`}
                    >{opt === "sim" ? "Sim" : "Não"}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Tipo de Serviço</label>
                <div className="rounded-xl border border-border bg-background p-2 space-y-1 max-h-52 overflow-y-auto">
                  {tiposServico.map(t => (
                    <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.tipos_servico.includes(t)}
                        onChange={e => {
                          const prev = form.tipos_servico;
                          const next = e.target.checked ? [...prev, t] : prev.filter(x => x !== t);
                          setForm(current => ({
                            ...current,
                            tipos_servico: next,
                            ...(next.includes("INFRA") ? {} : { infra_descricao: "" }),
                          }));
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      {t}
                    </label>
                  ))}
                  {form.tipos_servico.length > 0 && (
                    <p className="text-xs text-primary font-semibold px-2 pt-1 border-t border-border">
                      {form.tipos_servico.length} selecionado{form.tipos_servico.length > 1 ? "s" : ""}: {form.tipos_servico.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {form.tipos_servico.includes("INFRA") && (
                <div>
                  <label className={labelCls}>Descrição da infra *</label>
                  <textarea
                    value={form.infra_descricao}
                    onChange={e => set("infra_descricao", e.target.value)}
                    rows={3}
                    placeholder="Ex: execução de galeria, drenagem, guia/sarjeta..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Seção 3 — Quantitativos */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Quantitativos de Produção</h2>
              
              {/* Mapeamento: Tipo de Serviço → Campo de Produção (100% CONDICIONAL)
                  - FRESAGEM → fresagem_m2
                  - APLICAÇÃO DE RAP ESPUMADO → rap_espumado_m2
                  - APLICAÇÃO DE FX II - BINDER → binder_ton
                  - APLICAÇÃO DE FX III → cbuq_fx3_ton
                  - APLICAÇÃO DE GAP GRADED → gap_ton
                  - APLICAÇÃO DE BGS → bgs_ton
                  - APLICAÇÃO DE SMA → sma_ton
                  - APLICAÇÃO DE BGTC → bgtc_m3
                  - APLICAÇÃO DE MACADAME → macadame_m3
                  - APLICAÇÃO DE CAUQ-RIMA → cauq_rima_ton
                  - APLICAÇÃO DE BM25 → bm25_ton
                  - GEOGRELHA → geogrelha_m2
                  - APLICAÇÃO DE EGL → egl_ton
                  - APLICAÇÃO DE RACHÃO → rachao_ton
              */}
              
              {[
                { label: "Fresagem (m²)", field: "fresagem_m2", requiredType: "FRESAGEM" },
                { label: "RAP Espumado (m²)", field: "rap_espumado_m2", requiredType: "APLICAÇÃO DE RAP ESPUMADO" },
                { label: "Binder (ton)", field: "binder_ton", requiredType: "APLICAÇÃO DE FX II - BINDER" },
                { label: "CBUQ FX3 (ton)", field: "cbuq_fx3_ton", requiredType: "APLICAÇÃO DE FX III" },
                { label: "GAP (ton)", field: "gap_ton", requiredType: "APLICAÇÃO DE GAP GRADED" },
                { label: "BGS (ton)", field: "bgs_ton", requiredType: "APLICAÇÃO DE BGS" },
                { label: "SMA (ton)", field: "sma_ton", requiredType: "APLICAÇÃO DE SMA" },
                { label: "BGTC (m³)", field: "bgtc_m3", requiredType: "APLICAÇÃO DE BGTC" },
                { label: "Macadame (m³)", field: "macadame_m3", requiredType: "APLICAÇÃO DE MACADAME" },
                { label: "CAUQ-RIMA (ton)", field: "cauq_rima_ton", requiredType: "APLICAÇÃO DE CAUQ-RIMA" },
                { label: "BM25 (ton)", field: "bm25_ton", requiredType: "APLICAÇÃO DE BM25" },
                { label: "Geogrelha (m²)", field: "geogrelha_m2", requiredType: "GEOGRELHA" },
                { label: "EGL (ton)", field: "egl_ton", requiredType: "APLICAÇÃO DE EGL" },
                { label: "RACHÃO (ton)", field: "rachao_ton", requiredType: "APLICAÇÃO DE RACHÃO" },
              ].map(({ label, field, requiredType }) => {
                // Lógica: mostrar campo APENAS se tipo de serviço foi selecionado
                const shouldShow = form.tipos_servico.includes(requiredType);
                
                return shouldShow ? (
                  <div key={field}>
                    <label className={labelCls}>{label}</label>
                    <input
                      type="number"
                      value={(form as any)[field]}
                      onChange={e => set(field, e.target.value)}
                      placeholder="0"
                      min={0}
                      className={inputCls}
                    />
                  </div>
                ) : null;
              })}
              
              {form.tipos_servico.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Selecione um tipo de serviço acima para ver os campos de produção</p>
              )}
            </div>

            {/* Seção 3b — Informações Adicionais */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Informações Adicionais</h2>

              {(form.tipos_servico.includes("FRESAGEM") || form.tipos_servico.includes("DEMOLIÇÃO")) && (
                <div>
                  <label className={labelCls}>Qtd caminhões fresa/demolição</label>
                  <input
                    type="number"
                    value={form.qtd_caminhoes_fresa}
                    onChange={e => set("qtd_caminhoes_fresa", e.target.value)}
                    placeholder="0"
                    min={0}
                    className={inputCls}
                  />
                </div>
              )}

              {form.tipos_servico.length > 0 && (
                <div>
                  <label className={labelCls}>% conclusão da via</label>
                  <input
                    type="number"
                    value={form.perc_conclusao_via}
                    onChange={e => set("perc_conclusao_via", e.target.value)}
                    placeholder="0"
                    min={0}
                    max={100}
                    className={inputCls}
                  />
                </div>
              )}

              {form.tipos_servico.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Selecione um tipo de serviço para exibir os quantitativos adicionais</p>
              )}
            </div>

            {/* Seção 3c — Equipamentos na Obra */}
            <div className={sectionCls}>
              <h2 className="text-sm font-bold text-foreground">Equipamentos na Obra</h2>
              <div>
                <label className={labelCls}>Condição dos equipamentos *</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, equipamentos_conforme: "sim", equipamentos_nao_conformes: "" }))}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.equipamentos_conforme === "sim"
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    Conforme
                  </button>
                  <button
                    type="button"
                    onClick={() => set("equipamentos_conforme", "nao")}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      form.equipamentos_conforme === "nao"
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    Não Conforme
                  </button>
                </div>
              </div>

              {form.equipamentos_conforme === "nao" && (
                <div>
                  <label className={labelCls}>Quais equipamentos não estão conformes? *</label>
                  <textarea
                    value={form.equipamentos_nao_conformes}
                    onChange={e => set("equipamentos_nao_conformes", e.target.value)}
                    rows={3}
                    placeholder="Ex: Rolo frota 124 com vazamento hidráulico; vibroacabadora sem sensor..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
              )}
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
    </>
  );
}
