/**
 * PontoAprovacoes — Gestor/Admin aprova ou reprova solicitações de ponto
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Solicitacao {
  id: string;
  staff_id: string;
  tipo: string;
  status: string;
  data_referencia: string;
  tipo_registro: string | null;
  hora_atual: string | null;
  hora_solicitada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string;
  observacao: string | null;
  created_at: string;
  funcionarios?: { nome: string; funcao: string; matricula: string } | null;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtDateHour(dt: string) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PontoAprovacoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState<Record<string, string>>({});
  const [showReprovacao, setShowReprovacao] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("ponto_solicitacoes")
      .select("*, funcionarios(nome, funcao, matricula)")
      .eq("status", filtroStatus)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setSolicitacoes(data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [filtroStatus]);

  const aprovar = async (id: string) => {
    setProcessando(id);
    try {
      const { error } = await (supabase as any)
        .from("ponto_solicitacoes")
        .update({ status: "aprovado", aprovado_por: profile?.user_id || null, aprovado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "✅ Solicitação aprovada!" });
      carregar();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setProcessando(null); }
  };

  const reprovar = async (id: string) => {
    const motivo = motivoReprovacao[id];
    if (!motivo?.trim()) { toast({ title: "Informe o motivo da reprovação", variant: "destructive" }); return; }
    setProcessando(id);
    try {
      const { error } = await (supabase as any)
        .from("ponto_solicitacoes")
        .update({
          status: "reprovado",
          aprovado_por: profile?.user_id || null,
          aprovado_em: new Date().toISOString(),
          motivo_reprovacao: motivo
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Solicitação reprovada." });
      setShowReprovacao(null);
      setMotivoReprovacao(prev => { const n = { ...prev }; delete n[id]; return n; });
      carregar();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setProcessando(null); }
  };

  const pendentes = solicitacoes.filter(s => s.status === "pendente").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Aprovações de Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Ajustes e abonos pendentes</p>
        </div>
        {filtroStatus === "pendente" && pendentes > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendentes}</span>
        )}
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Filtro de status */}
        <div className="flex gap-2">
          {["pendente", "aprovado", "reprovado"].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`flex-1 h-9 rounded-xl text-xs font-bold capitalize border-2 transition-colors ${filtroStatus === s ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}>
              {s === "pendente" ? "⏳ Pendentes" : s === "aprovado" ? "✅ Aprovados" : "❌ Reprovados"}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground py-6"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando...</p>}

        {!loading && solicitacoes.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            {filtroStatus === "pendente" ? "Nenhuma solicitação pendente 🎉" : "Nenhum registro encontrado."}
          </p>
        )}

        {!loading && solicitacoes.map(s => (
          <div key={s.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-sm">{s.funcionarios?.nome || "—"}</p>
                <p className="text-xs text-muted-foreground">{s.funcionarios?.funcao} · {s.funcionarios?.matricula}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.tipo === "ajuste" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                  {s.tipo === "ajuste" ? "Ajuste" : "Abono"}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateHour(s.created_at)}</p>
              </div>
            </div>

            {/* Detalhes */}
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-semibold">Dia {fmtDate(s.data_referencia)}</span>
              </div>
              {s.tipo === "ajuste" ? (
                <div className="text-xs space-y-0.5">
                  <p><span className="text-muted-foreground">Registro:</span> {s.tipo_registro === "entrada" ? "🟢 Entrada" : "🔴 Saída"}</p>
                  {s.hora_atual && <p><span className="text-muted-foreground">Atual:</span> {s.hora_atual.slice(0,5)}</p>}
                  <p><span className="text-muted-foreground">Solicitado:</span> <span className="font-bold text-primary">{s.hora_solicitada?.slice(0,5)}</span></p>
                </div>
              ) : (
                <div className="text-xs">
                  <p><span className="text-muted-foreground">Período:</span> <span className="font-bold">{s.hora_inicio?.slice(0,5)} – {s.hora_fim?.slice(0,5)}</span></p>
                </div>
              )}
              <p className="text-xs"><span className="text-muted-foreground">Motivo:</span> {s.motivo}</p>
              {s.observacao && <p className="text-xs text-muted-foreground italic">"{s.observacao}"</p>}
            </div>

            {/* Ações — só para pendentes */}
            {s.status === "pendente" && (
              <div className="space-y-2">
                {showReprovacao === s.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Motivo da reprovação..."
                      value={motivoReprovacao[s.id] || ""}
                      onChange={e => setMotivoReprovacao(prev => ({ ...prev, [s.id]: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-border bg-secondary px-3 text-sm focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => reprovar(s.id)}
                        disabled={processando === s.id} className="flex-1 h-9 text-xs">
                        {processando === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><XCircle className="w-3.5 h-3.5 mr-1" /> Confirmar Reprovação</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowReprovacao(null)} className="h-9 text-xs px-3">Voltar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => aprovar(s.id)} disabled={processando === s.id}
                      className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                      {processando === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> Aprovar</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowReprovacao(s.id)}
                      className="flex-1 h-9 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50">
                      <XCircle className="w-3.5 h-3.5" /> Reprovar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
