import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit2, Save, UserCheck, History, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function GestaoFrotasVeiculo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [veiculo, setVeiculo] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoCondutor, setNovoCondutor] = useState("");
  const [motivoTroca, setMotivoTroca] = useState("");
  const [trocandoCondutor, setTrocandoCondutor] = useState(false);

  useEffect(() => { if (id) buscarDados(); }, [id]);

  async function buscarDados() {
    setLoading(true);
    const [{ data: v }, { data: h }, { data: d }] = await Promise.all([
      supabase.from("frotas_gestao").select("*").eq("id", id).single(),
      supabase.from("frotas_historico_condutor").select("*").eq("frota_id", id).order("created_at", { ascending: false }),
      supabase.from("manutencao_documentos").select("*").eq("equipment_fleet", id).order("data_vencimento"),
    ]);
    if (v) setVeiculo(v);
    if (h) setHistorico(h);
    // Buscar docs pela placa também
    if (v) {
      const { data: docsByPlaca } = await supabase.from("manutencao_documentos").select("*").eq("equipment_fleet", v.placa);
      setDocumentos(docsByPlaca || d || []);
    }
    setLoading(false);
  }

  async function salvarEdicao() {
    setSalvando(true);
    await supabase.from("frotas_gestao").update({ ...veiculo, updated_at: new Date().toISOString() }).eq("id", id);
    setEditando(false);
    setSalvando(false);
  }

  async function trocarCondutor() {
    if (!novoCondutor) return;
    setTrocandoCondutor(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("frotas_historico_condutor").insert({
      frota_id: id,
      condutor_anterior: veiculo.condutor_atual,
      condutor_novo: novoCondutor,
      data_troca: new Date().toISOString().split("T")[0],
      motivo: motivoTroca || null,
      registrado_por: user?.email,
    });
    await supabase.from("frotas_gestao").update({ condutor_atual: novoCondutor, updated_at: new Date().toISOString() }).eq("id", id);
    setNovoCondutor("");
    setMotivoTroca("");
    buscarDados();
    setTrocandoCondutor(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!veiculo) return <div className="p-8 text-center text-muted-foreground">Veículo não encontrado.</div>;

  const hoje = new Date();
  const docsVencendo = documentos.filter(d => {
    if (!d.data_vencimento) return false;
    const dias = Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / 86400000);
    return dias <= 30;
  });

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">{veiculo.placa}</span>
          <span className="block text-[11px] text-primary-foreground/80">{veiculo.modelo}</span>
        </div>
        <Button size="sm" onClick={() => editando ? salvarEdicao() : setEditando(true)} disabled={salvando} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          {editando ? <><Save className="w-4 h-4" /> Salvar</> : <><Edit2 className="w-4 h-4" /> Editar</>}
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Alertas documentos */}
        {docsVencendo.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-sm font-bold text-orange-700">⚠️ {docsVencendo.length} documento{docsVencendo.length !== 1 ? "s" : ""} vencendo</p>
            {docsVencendo.map((d, i) => {
              const dias = Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / 86400000);
              return <p key={i} className="text-xs text-orange-600">{d.tipo_documento}: {dias <= 0 ? "⛔ VENCIDO" : `${dias} dias`}</p>;
            })}
          </div>
        )}

        {/* Dados do veículo */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm">Dados do Veículo</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Código de Custo", field: "codigo_custo" },
              { label: "Placa", field: "placa" },
              { label: "Modelo", field: "modelo" },
              { label: "Ano", field: "ano" },
              { label: "Setor", field: "setor" },
              { label: "Locadora", field: "locadora" },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <span className="rdo-label">{label}</span>
                {editando ? (
                  <Input value={veiculo[field] || ""} onChange={e => setVeiculo((v: any) => ({ ...v, [field]: e.target.value }))} className="h-10 rounded-xl" />
                ) : (
                  <p className="text-sm font-medium">{veiculo[field] || "—"}</p>
                )}
              </div>
            ))}
          </div>
          {editando && (
            <div className="space-y-1.5">
              <span className="rdo-label">Categoria</span>
              <Select value={veiculo.categoria} onValueChange={v => setVeiculo((prev: any) => ({ ...prev, categoria: v }))}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="locado">Locado</SelectItem>
                  <SelectItem value="proprio">Próprio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Condutor atual + troca */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" /> Condutor
          </h3>
          <div className="bg-primary/5 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Condutor Atual</p>
            <p className="font-display font-bold text-base">{veiculo.condutor_atual || "Sem condutor"}</p>
          </div>
          <div className="space-y-2">
            <span className="rdo-label">Trocar Condutor</span>
            <Input value={novoCondutor} onChange={e => setNovoCondutor(e.target.value)} placeholder="Nome do novo condutor" className="h-10 rounded-xl" />
            <Input value={motivoTroca} onChange={e => setMotivoTroca(e.target.value)} placeholder="Motivo (opcional)" className="h-10 rounded-xl" />
            <Button onClick={trocarCondutor} disabled={trocandoCondutor || !novoCondutor} className="w-full h-10 rounded-xl text-sm font-semibold gap-2">
              {trocandoCondutor ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Confirmar Troca
            </Button>
          </div>
        </div>

        {/* Documentos */}
        <div className="rdo-card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Documentos ({documentos.length})
            </h3>
            <button onClick={() => navigate("/manutencao/documentos")} className="text-xs text-primary underline">Ver todos</button>
          </div>
          {documentos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum documento cadastrado para este veículo.</p>
          ) : (
            documentos.map((d, i) => {
              const dias = d.data_vencimento ? Math.ceil((new Date(d.data_vencimento).getTime() - hoje.getTime()) / 86400000) : 999;
              return (
                <div key={i} className={`flex items-center justify-between p-2 rounded-xl border text-xs ${dias <= 0 ? "bg-red-50 border-red-200" : dias <= 30 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                  <span className="font-semibold">{d.tipo_documento}</span>
                  <span className={dias <= 0 ? "text-red-600 font-bold" : dias <= 30 ? "text-orange-600 font-semibold" : "text-green-600"}>
                    {d.data_vencimento ? (dias <= 0 ? "⛔ VENCIDO" : `${fmtDate(d.data_vencimento)}`) : "Sem vencimento"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Histórico de condutores */}
        {historico.length > 0 && (
          <div className="rdo-card space-y-2">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" /> Histórico de Condutores
            </h3>
            {historico.map((h, i) => (
              <div key={i} className="text-xs border-b border-border pb-1.5 last:border-0">
                <p><span className="text-muted-foreground">{fmtDate(h.data_troca)}</span> — <strong>{h.condutor_anterior || "Sem condutor"}</strong> → <strong>{h.condutor_novo}</strong></p>
                {h.motivo && <p className="text-muted-foreground">{h.motivo}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
