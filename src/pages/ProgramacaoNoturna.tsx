// ProgramacaoNoturna — Fase 1: Engenharia/Programador cria OS Noturna
// Novo módulo isolado — não altera nenhuma tela existente
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, CalendarDays, ClipboardList,
  CheckCircle2, Clock, XCircle, ChevronRight, Loader2, HardHat,
} from "lucide-react";
import { sortOgsData } from "@/hooks/useOgsReference";

// ─── tipos ────────────────────────────────────────────────────────────────────
interface Equipe { id: string; nome: string; responsavel: string | null; }
interface Equipamento { id: string; frota: string; tipo: string; nome: string; }
interface Carreta { id: string; frota: string; modelo: string; }
interface OgsItem { ogs_number: string; client_name: string; location_address: string; }

interface Programacao {
  id: string;
  data: string;
  equipe: string;
  responsavel: string | null;
  ogs: string | null;
  cliente: string | null;
  local: string | null;
  periodo: string;
  status_equipe: string;
  status_programacao: string;
  equipamentos_designados: string[] | null;
  carretas_designadas: string[] | null;
  engenheiro_responsavel: string | null;
  obs: string | null;
  obs_manutencao: string | null;
  confirmado_manutencao: boolean;
  confirmado_por: string | null;
  confirmado_em: string | null;
  tipo_servico: string | null;
  created_at: string;
}

const PERIODOS = ["NOTURNO", "DIURNO", "INTEGRAL"];
const TIPOS_SERVICO = ["PAVIMENTAÇÃO", "RETRABALHO", "FRESAGEM", "INFRA", "BGS", "OUTRO"];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  RASCUNHO:            { label: "Rascunho",            color: "bg-gray-100 text-gray-600 border-gray-200",     icon: Clock },
  AGUARDANDO_MANUTENCAO: { label: "Aguard. Manutenção", color: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  CONFIRMADO:          { label: "Confirmado",           color: "bg-green-50 text-green-700 border-green-200",   icon: CheckCircle2 },
  CANCELADO:           { label: "Cancelado",            color: "bg-red-50 text-red-700 border-red-200",         icon: XCircle },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ─── componente ───────────────────────────────────────────────────────────────
export default function ProgramacaoNoturna() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // dados de referência
  const [equipes, setEquipes]         = useState<Equipe[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [carretas, setCarretas]       = useState<Carreta[]>([]);
  const [ogsList, setOgsList]         = useState<OgsItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // lista de programações
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [filtroData, setFiltroData]     = useState(new Date().toISOString().split("T")[0]);

  // form
  const [showForm, setShowForm]           = useState(false);
  const [formData, setFormData]           = useState(new Date().toISOString().split("T")[0]);
  const [formEquipe, setFormEquipe]       = useState("");
  const [formOgs, setFormOgs]             = useState("");
  const [formCliente, setFormCliente]     = useState("");
  const [formLocal, setFormLocal]         = useState("");
  const [formPeriodo, setFormPeriodo]     = useState("NOTURNO");
  const [formTipo, setFormTipo]           = useState("");
  const [formEngenheiro, setFormEngenheiro] = useState("");
  const [formEquipsDesig, setFormEquipsDesig] = useState<string[]>([]);
  const [formCarretasDesig, setFormCarretasDesig] = useState<string[]>([]);
  const [formObs, setFormObs]             = useState("");
  const [formEquipSel, setFormEquipSel]   = useState("");
  const [formCarretaSel, setFormCarretaSel] = useState("");

  // ─── carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [eqs, equips, carr, ogs] = await Promise.all([
        (supabase as any).from("ci_equipes").select("*").eq("ativa", true).order("nome"),
        (supabase as any).from("equipamentos").select("id,frota,tipo,nome").eq("status", "ativo").order("tipo").order("frota"),
        (supabase as any).from("equipamentos").select("id,frota,nome").in("tipo", ["CAMINHÃO PLATAFORMA", "CARRETA CM"]).eq("status", "ativo").order("frota"),
        (supabase as any).from("ogs_reference").select("ogs_number,client_name,location_address"),
      ]);
      setEquipes(eqs.data || []);
      setEquipamentos(equips.data || []);
      setCarretas(carr.data || []);
      setOgsList(sortOgsData(ogs.data || []));
      setLoading(false);
    };
    load();
  }, []);

  // ─── buscar programações do dia ─────────────────────────────────────────────
  useEffect(() => {
    buscarProgramacoes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroData]);

  const buscarProgramacoes = async () => {
    const { data } = await (supabase as any)
      .from("ci_programacoes")
      .select("*")
      .eq("data", filtroData)
      .order("equipe");
    setProgramacoes(data || []);
  };

  // ─── autopreenchimento OGS ──────────────────────────────────────────────────
  const handleOgsChange = (ogs: string) => {
    setFormOgs(ogs);
    const o = ogsList.find(o => o.ogs_number === ogs);
    if (o) {
      setFormCliente(o.client_name);
      const ruas = o.location_address?.split(";").map((r: string) => r.trim()).filter(Boolean) || [];
      setFormLocal(ruas[0] || "");
    }
  };

  // ─── adicionar equipamento à lista ──────────────────────────────────────────
  const addEquip = () => {
    if (!formEquipSel || formEquipsDesig.includes(formEquipSel)) return;
    setFormEquipsDesig(prev => [...prev, formEquipSel]);
    setFormEquipSel("");
  };

  const removeEquip = (frota: string) => {
    setFormEquipsDesig(prev => prev.filter(f => f !== frota));
  };

  const addCarreta = () => {
    if (!formCarretaSel || formCarretasDesig.includes(formCarretaSel)) return;
    setFormCarretasDesig(prev => [...prev, formCarretaSel]);
    setFormCarretaSel("");
  };

  const removeCarreta = (frota: string) => {
    setFormCarretasDesig(prev => prev.filter(f => f !== frota));
  };

  // ─── salvar programação ─────────────────────────────────────────────────────
  const handleSalvar = async (status: "RASCUNHO" | "AGUARDANDO_MANUTENCAO") => {
    if (!formEquipe || !formData) {
      toast({ title: "Preencha equipe e data", variant: "destructive" });
      return;
    }

    setSaving(true);
    const equipeInfo = equipes.find(e => e.nome === formEquipe);

    const payload = {
      data: formData,
      equipe: formEquipe,
      responsavel: equipeInfo?.responsavel || null,
      ogs: formOgs || null,
      cliente: formCliente || null,
      local: formLocal || null,
      periodo: formPeriodo,
      status_equipe: "TRABALHOU",
      status_programacao: status,
      equipamentos_designados: formEquipsDesig.length ? formEquipsDesig : [],
      carretas_designadas: formCarretasDesig.length ? formCarretasDesig : [],
      engenheiro_responsavel: formEngenheiro || null,
      obs: formObs || null,
      tipo_servico: formTipo || null,
      confirmado_manutencao: false,
    };

    const { error } = await (supabase as any).from("ci_programacoes").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: status === "AGUARDANDO_MANUTENCAO"
          ? "✅ Programação enviada para Manutenção!"
          : "✅ Rascunho salvo!",
        description: `Equipe ${formEquipe} — ${fmtDate(formData)}`,
      });
      resetForm();
      setShowForm(false);
      buscarProgramacoes();
    }
    setSaving(false);
  };

  // ─── cancelar programação ───────────────────────────────────────────────────
  const handleCancelar = async (id: string) => {
    const { error } = await (supabase as any)
      .from("ci_programacoes")
      .update({ status_programacao: "CANCELADO" })
      .eq("id", id);
    if (!error) {
      toast({ title: "Programação cancelada" });
      buscarProgramacoes();
    }
  };

  const resetForm = () => {
    setFormEquipe("");
    setFormOgs("");
    setFormCliente("");
    setFormLocal("");
    setFormPeriodo("NOTURNO");
    setFormTipo("");
    setFormEngenheiro("");
    setFormEquipsDesig([]);
    setFormCarretasDesig([]);
    setFormObs("");
    setFormEquipSel("");
    setFormCarretaSel("");
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Programação Noturna</h1>
          <p className="text-xs text-muted-foreground">Planejamento de obras e equipes</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-xl"
        >
          <Plus className="w-4 h-4" /> Nova
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* ── FORMULÁRIO (colapsável) ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <HardHat className="w-4 h-4 text-primary" />
                Nova Programação
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}>
                <XCircle className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Data */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data da Obra
              </Label>
              <Input
                type="date"
                value={formData}
                onChange={e => setFormData(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Equipe */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Equipe *
              </Label>
              <Select value={formEquipe} onValueChange={setFormEquipe}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione a equipe..." />
                </SelectTrigger>
                <SelectContent>
                  {equipes
                    .filter(e => e.nome.startsWith("CBUQ") || e.nome.startsWith("GRU"))
                    .map(e => (
                      <SelectItem key={e.id} value={e.nome}>
                        {e.nome}
                        {e.responsavel ? ` — ${e.responsavel}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período e Tipo de Serviço */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período</Label>
                <Select value={formPeriodo} onValueChange={setFormPeriodo}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Serviço</Label>
                <Select value={formTipo} onValueChange={setFormTipo}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_SERVICO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* OGS */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OGS / Obra</Label>
              <Select value={formOgs} onValueChange={handleOgsChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione a OGS..." />
                </SelectTrigger>
                <SelectContent>
                  {ogsList.map(o => (
                    <SelectItem key={o.ogs_number} value={o.ogs_number}>
                      {o.ogs_number} — {o.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formCliente && (
                <p className="text-xs text-muted-foreground pl-1">
                  {formCliente} {formLocal ? `· ${formLocal}` : ""}
                </p>
              )}
            </div>

            {/* Local (editável) */}
            {formOgs && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local / Rua</Label>
                <Input
                  value={formLocal}
                  onChange={e => setFormLocal(e.target.value)}
                  placeholder="Ex: Av. Paulista, trecho 2"
                  className="text-sm"
                />
              </div>
            )}

            {/* Engenheiro responsável */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engenheiro Responsável</Label>
              <Input
                value={formEngenheiro}
                onChange={e => setFormEngenheiro(e.target.value)}
                placeholder="Nome do engenheiro..."
                className="text-sm"
              />
            </div>

            {/* Equipamentos designados */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Equipamentos Designados
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={formEquipSel} onValueChange={setFormEquipSel}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecionar equipamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {equipamentos
                        .filter(e => !formEquipsDesig.includes(e.frota))
                        .map(e => (
                          <SelectItem key={e.id} value={e.frota}>
                            {e.frota} — {e.tipo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addEquip}
                  disabled={!formEquipSel}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formEquipsDesig.length > 0 && (
                <div className="space-y-1">
                  {formEquipsDesig.map(frota => (
                    <div key={frota} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-blue-800">{frota}</span>
                      <button onClick={() => removeEquip(frota)}>
                        <Trash2 className="w-3.5 h-3.5 text-blue-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Carretas */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Carretas de Transporte
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={formCarretaSel} onValueChange={setFormCarretaSel}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecionar carreta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {carretas
                        .filter(c => !formCarretasDesig.includes(c.frota))
                        .map(c => (
                          <SelectItem key={c.id} value={c.frota}>
                            {c.frota} — {c.modelo || "Plataforma"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addCarreta}
                  disabled={!formCarretaSel}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formCarretasDesig.length > 0 && (
                <div className="space-y-1">
                  {formCarretasDesig.map(frota => (
                    <div key={frota} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-orange-800">{frota}</span>
                      <button onClick={() => removeCarreta(frota)}>
                        <Trash2 className="w-3.5 h-3.5 text-orange-400 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
              <Textarea
                value={formObs}
                onChange={e => setFormObs(e.target.value)}
                placeholder="Detalhes, instruções especiais..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => handleSalvar("RASCUNHO")}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Rascunho"}
              </Button>
              <Button
                className="flex-1 text-sm"
                onClick={() => handleSalvar("AGUARDANDO_MANUTENCAO")}
                disabled={saving || !formEquipe}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar p/ Manutenção"}
              </Button>
            </div>
          </div>
        )}

        {/* ── FILTRO DE DATA ── */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-border shadow-sm px-4 py-3">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Visualizando</Label>
            <Input
              type="date"
              value={filtroData}
              onChange={e => setFiltroData(e.target.value)}
              className="text-sm border-0 p-0 h-auto focus-visible:ring-0 font-semibold"
            />
          </div>
        </div>

        {/* ── LISTA DE PROGRAMAÇÕES ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Programações — {fmtDate(filtroData)}
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 ml-1">
              {programacoes.length}
            </span>
          </h2>

          {programacoes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma programação para esta data.</p>
              <button
                onClick={() => { setFormData(filtroData); resetForm(); setShowForm(true); }}
                className="mt-2 text-sm text-primary font-semibold"
              >
                + Criar programação
              </button>
            </div>
          ) : (
            programacoes.map(prog => {
              const cfg = STATUS_CONFIG[prog.status_programacao] || STATUS_CONFIG.CONFIRMADO;
              const Icon = cfg.icon;
              const equips = prog.equipamentos_designados || [];
              const carrs = prog.carretas_designadas || [];

              return (
                <div
                  key={prog.id}
                  className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3"
                >
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{prog.equipe}</p>
                      {prog.responsavel && (
                        <p className="text-xs text-muted-foreground">Enc: {prog.responsavel}</p>
                      )}
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold border px-2 py-0.5 rounded-full ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Info da obra */}
                  <div className="space-y-1">
                    {prog.ogs && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">OGS</span>
                        <span className="text-xs font-semibold text-foreground">{prog.ogs}</span>
                        {prog.tipo_servico && (
                          <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5">{prog.tipo_servico}</span>
                        )}
                      </div>
                    )}
                    {prog.cliente && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">Cliente</span>
                        <span className="text-xs text-foreground">{prog.cliente}</span>
                      </div>
                    )}
                    {prog.local && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">Local</span>
                        <span className="text-xs text-foreground">{prog.local}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">Período</span>
                      <span className="text-xs font-medium text-foreground">{prog.periodo}</span>
                    </div>
                    {prog.engenheiro_responsavel && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">Eng.</span>
                        <span className="text-xs text-foreground">{prog.engenheiro_responsavel}</span>
                      </div>
                    )}
                  </div>

                  {/* Equipamentos */}
                  {equips.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Equipamentos</p>
                      <div className="flex flex-wrap gap-1">
                        {equips.map(f => (
                          <span key={f} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-0.5">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Carretas */}
                  {carrs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Carretas</p>
                      <div className="flex flex-wrap gap-1">
                        {carrs.map(f => (
                          <span key={f} className="text-xs bg-orange-50 text-orange-800 border border-orange-200 rounded px-2 py-0.5">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirmação Manutenção */}
                  {prog.confirmado_manutencao && (
                    <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-green-800">Manutenção confirmou</p>
                        {prog.confirmado_por && (
                          <p className="text-xs text-green-700">{prog.confirmado_por}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Obs */}
                  {prog.obs && (
                    <p className="text-xs text-muted-foreground italic border-t border-border pt-2">
                      {prog.obs}
                    </p>
                  )}

                  {/* Ações */}
                  {prog.status_programacao !== "CANCELADO" && prog.status_programacao !== "CONFIRMADO" && (
                    <div className="flex justify-end pt-1 border-t border-border">
                      <button
                        onClick={() => handleCancelar(prog.id)}
                        className="text-xs text-red-500 font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
