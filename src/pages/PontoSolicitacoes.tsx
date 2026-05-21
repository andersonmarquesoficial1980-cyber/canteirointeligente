/**
 * PontoSolicitacoes — Funcionário faz solicitação de ajuste ou abono
 * Acessado via RH → Solicitações de Ponto
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Clock, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Funcionario { id: string; nome: string; funcao: string; matricula: string; }
interface Solicitacao {
  id: string; tipo: string; status: string; data_referencia: string;
  tipo_registro: string | null; hora_atual: string | null; hora_solicitada: string | null;
  hora_inicio: string | null; hora_fim: string | null; motivo: string;
  observacao: string | null; created_at: string; motivo_reprovacao: string | null;
}

const MOTIVOS_AJUSTE = ["Horário de entrada", "Horário de saída", "Esqueci de bater", "Sistema falhou", "Outro"];
const MOTIVOS_ABONO = ["Obra cancelada — chuva", "Ausência justificada", "Atestado médico", "Falta justificada", "Feriado", "Outro"];

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" },
    aprovado: { label: "Aprovado", cls: "bg-green-100 text-green-700" },
    reprovado: { label: "Reprovado", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.label}</span>;
}

export default function PontoSolicitacoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [selectedFuncId, setSelectedFuncId] = useState("");
  const [buscaFunc, setBuscaFunc] = useState("");
  const [showBusca, setShowBusca] = useState(false);
  const [selectedFunc, setSelectedFunc] = useState<Funcionario | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [tipoSolic, setTipoSolic] = useState<"ajuste" | "abono">("ajuste");
  const [dataRef, setDataRef] = useState("");
  const [tipoReg, setTipoReg] = useState("entrada");
  const [horaAtual, setHoraAtual] = useState("");
  const [horaSolicitada, setHoraSolicitada] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).from("funcionarios").select("id, nome, funcao, matricula").order("nome")
      .then(({ data }: any) => { if (data) setFuncionarios(data); });
  }, []);

  useEffect(() => {
    if (!selectedFuncId) return;
    (supabase as any)
      .from("ponto_solicitacoes")
      .select("*")
      .eq("staff_id", selectedFuncId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }: any) => { if (data) setSolicitacoes(data); });
  }, [selectedFuncId]);

  const funcsFiltrados = buscaFunc.trim()
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(buscaFunc.toLowerCase()) || f.matricula?.includes(buscaFunc))
    : [];

  const resetForm = () => {
    setTipoSolic("ajuste"); setDataRef(""); setTipoReg("entrada");
    setHoraAtual(""); setHoraSolicitada(""); setHoraInicio(""); setHoraFim("");
    setMotivo(""); setObservacao(""); setShowForm(false);
  };

  const salvar = async () => {
    if (!selectedFunc) { toast({ title: "Selecione o funcionário", variant: "destructive" }); return; }
    if (!dataRef || !motivo) { toast({ title: "Preencha data e motivo", variant: "destructive" }); return; }
    if (tipoSolic === "ajuste" && !horaSolicitada) { toast({ title: "Informe o horário solicitado", variant: "destructive" }); return; }
    if (tipoSolic === "abono" && (!horaInicio || !horaFim)) { toast({ title: "Informe o período do abono", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const payload: any = {
        staff_id: selectedFunc.id,
        company_id: profile?.company_id || null,
        tipo: tipoSolic,
        data_referencia: dataRef,
        motivo,
        observacao: observacao || null,
      };
      if (tipoSolic === "ajuste") {
        payload.tipo_registro = tipoReg;
        payload.hora_atual = horaAtual || null;
        payload.hora_solicitada = horaSolicitada;
      } else {
        payload.hora_inicio = horaInicio;
        payload.hora_fim = horaFim;
      }

      const { error } = await (supabase as any).from("ponto_solicitacoes").insert(payload);
      if (error) throw error;

      toast({ title: "✅ Solicitação enviada!" });
      resetForm();

      // Recarrega lista
      const { data } = await (supabase as any)
        .from("ponto_solicitacoes").select("*").eq("staff_id", selectedFunc.id)
        .order("created_at", { ascending: false }).limit(30);
      if (data) setSolicitacoes(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Solicitações de Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Ajuste e abono</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">

        {/* Seleção de funcionário */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          {selectedFunc ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{selectedFunc.nome}</p>
                <p className="text-xs text-muted-foreground">{selectedFunc.funcao} · {selectedFunc.matricula}</p>
              </div>
              <button onClick={() => { setSelectedFunc(null); setSelectedFuncId(""); setBuscaFunc(""); setSolicitacoes([]); }}
                className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded">Trocar</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={buscaFunc} onChange={e => { setBuscaFunc(e.target.value); setShowBusca(true); }}
                onFocus={() => setShowBusca(true)}
                placeholder="Buscar funcionário..." 
                className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              {showBusca && funcsFiltrados.length > 0 && (
                <div className="absolute z-10 top-12 left-0 right-0 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {funcsFiltrados.map(f => (
                    <button key={f.id} type="button" onClick={() => { setSelectedFunc(f); setSelectedFuncId(f.id); setBuscaFunc(""); setShowBusca(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0">
                      <p className="text-sm font-medium">{f.nome}</p>
                      <p className="text-xs text-muted-foreground">{f.funcao} · {f.matricula}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nova solicitação */}
        {selectedFunc && !showForm && (
          <Button onClick={() => setShowForm(true)} className="w-full h-11 gap-2">
            <Plus className="w-4 h-4" /> Nova Solicitação
          </Button>
        )}

        {selectedFunc && showForm && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-bold">Nova Solicitação</h2>

            {/* Tipo */}
            <div className="flex gap-2">
              <button onClick={() => setTipoSolic("ajuste")}
                className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 gap-1.5 flex items-center justify-center transition-colors ${tipoSolic === "ajuste" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                <Clock className="w-3.5 h-3.5" /> Ajuste de Ponto
              </button>
              <button onClick={() => setTipoSolic("abono")}
                className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 gap-1.5 flex items-center justify-center transition-colors ${tipoSolic === "abono" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
                <FileText className="w-3.5 h-3.5" /> Abono
              </button>
            </div>

            {/* Data */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data de referência *</label>
              <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="bg-secondary border-border" />
            </div>

            {/* Campos ajuste */}
            {tipoSolic === "ajuste" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registro</label>
                    <Select value={tipoReg} onValueChange={setTipoReg}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hora atual (se houver)</label>
                    <Input type="time" value={horaAtual} onChange={e => setHoraAtual(e.target.value)} className="bg-secondary border-border" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horário correto *</label>
                  <Input type="time" value={horaSolicitada} onChange={e => setHoraSolicitada(e.target.value)} className="bg-secondary border-border" />
                </div>
              </>
            )}

            {/* Campos abono */}
            {tipoSolic === "abono" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Início *</label>
                  <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fim *</label>
                  <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo *</label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(tipoSolic === "ajuste" ? MOTIVOS_AJUSTE : MOTIVOS_ABONO).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Observação */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observação (opcional)</label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                placeholder="Detalhes adicionais..."
                className="w-full min-h-[70px] rounded-xl border border-border bg-secondary px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div className="flex gap-2">
              <Button onClick={salvar} disabled={saving} className="flex-1 h-10 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Solicitação"}
              </Button>
              <Button variant="outline" onClick={resetForm} className="h-10 text-sm px-4">Cancelar</Button>
            </div>
          </div>
        )}

        {/* Lista de solicitações */}
        {selectedFunc && solicitacoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground px-1">Histórico de solicitações</p>
            {solicitacoes.map(s => (
              <div key={s.id} className="bg-card rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{fmtDate(s.data_referencia)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.tipo === "ajuste" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {s.tipo === "ajuste" ? "Ajuste" : "Abono"}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{s.motivo}</p>
                {s.tipo === "ajuste" && s.hora_solicitada && (
                  <p className="text-xs">{s.tipo_registro === "entrada" ? "🟢 Entrada" : "🔴 Saída"} → {s.hora_solicitada.slice(0,5)}</p>
                )}
                {s.tipo === "abono" && s.hora_inicio && s.hora_fim && (
                  <p className="text-xs">⏱ {s.hora_inicio.slice(0,5)} – {s.hora_fim.slice(0,5)}</p>
                )}
                {s.status === "reprovado" && s.motivo_reprovacao && (
                  <p className="text-xs text-red-600">Motivo reprovação: {s.motivo_reprovacao}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedFunc && solicitacoes.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação encontrada.</p>
        )}
      </div>
    </div>
  );
}
