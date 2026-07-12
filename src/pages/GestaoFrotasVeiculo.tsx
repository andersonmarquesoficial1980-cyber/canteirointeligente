import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit2, Save, UserCheck, History, FileText, Loader2, Gauge, Lock, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type MedidorAtual = {
  valor: number;
  tipo: "horímetro" | "odômetro";
  data: string;
  fonte: string;
} | null;

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatBRL(v: number) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_OPTIONS = [
  { value: "ativo",          label: "✅ Operacional" },
  { value: "em_manutencao", label: "🔧 Em Manutenção" },
  { value: "inativo",        label: "🚫 Inativo" },
  { value: "disposicao",     label: "📦 Disposição" },
];

const STATUS_LABELS: Record<string, { label: string; bg: string; cor: string }> = {
  ativo:          { label: "Operacional",  bg: "#dcfce7", cor: "#166534" },
  em_manutencao:  { label: "Manutenção",   bg: "#fef3c7", cor: "#92400e" },
  inativo:        { label: "Inativo",      bg: "#fee2e2", cor: "#991b1b" },
  disposicao:     { label: "Disposição",   bg: "#f1f5f9", cor: "#475569" },
};

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
  const [medidorAtual, setMedidorAtual] = useState<MedidorAtual>(null);

  useEffect(() => { if (id) buscarDados(); }, [id]);

  async function buscarDados() {
    setLoading(true);
    const [{ data: v }, { data: h }, { data: d }] = await Promise.all([
      (supabase as any).from("equipamentos").select("*").eq("id", id).single(),
      supabase.from("frotas_historico_condutor").select("*").eq("frota_id", id).order("created_at", { ascending: false }),
      supabase.from("manutencao_documentos").select("*").eq("equipment_fleet", id).order("data_vencimento"),
    ]);
    if (v) setVeiculo(v);
    if (h) setHistorico(h);
    if (v) {
      const { data: docsByPlaca } = await supabase.from("manutencao_documentos").select("*").eq("equipment_fleet", v.placa);
      setDocumentos(docsByPlaca || d || []);

      const frota = v.frota || v.placa;
      const usaOdometro = ["CAMINHÃO", "CARRETA", "VEÍCULO", "VAN", "MICRO-ÔNIBUS"].some(
        t => (v.tipo || "").toUpperCase().includes(t)
      );

      const [{ data: ultimoDiario }, { data: ultimoAbastec }] = await Promise.all([
        (supabase as any)
          .from("equipment_diaries")
          .select(usaOdometro ? "odometer_final,date,created_at" : "meter_final,date,created_at")
          .eq("equipment_fleet", frota)
          .not(usaOdometro ? "odometer_final" : "meter_final", "is", null)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("abastecimentos")
          .select(usaOdometro ? "km_odometro,data,created_at" : "horimetro,data,created_at")
          .eq("equipment_fleet", frota)
          .not(usaOdometro ? "km_odometro" : "horimetro", "is", null)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const valorDiario = ultimoDiario ? (usaOdometro ? ultimoDiario.odometer_final : ultimoDiario.meter_final) : null;
      const dataDiario = ultimoDiario?.date || null;
      const valorAbastec = ultimoAbastec ? (usaOdometro ? ultimoAbastec.km_odometro : ultimoAbastec.horimetro) : null;
      const dataAbastec = ultimoAbastec?.data || null;

      let melhor: MedidorAtual = null;
      if (valorDiario != null && dataDiario) {
        melhor = { valor: Number(valorDiario), tipo: usaOdometro ? "odômetro" : "horímetro", data: dataDiario, fonte: "Diário" };
      }
      if (valorAbastec != null && dataAbastec) {
        if (!melhor || dataAbastec >= melhor.data) {
          melhor = { valor: Number(valorAbastec), tipo: usaOdometro ? "odômetro" : "horímetro", data: dataAbastec, fonte: "Abastecimento" };
        }
      }
      setMedidorAtual(melhor);
    }
    setLoading(false);
  }

  async function salvarEdicao() {
    setSalvando(true);
    // Salva APENAS os campos operacionais — não toca nos dados cadastrais
    await (supabase as any).from("equipamentos").update({
      status: veiculo.status,
      setor: veiculo.setor,
      condutor_atual: veiculo.condutor_atual,
      valor_mensal: veiculo.valor_mensal,
      motivo_manutencao: veiculo.motivo_manutencao,
      previsao_liberacao: veiculo.previsao_liberacao || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
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
    await (supabase as any).from("equipamentos").update({ condutor_atual: novoCondutor, updated_at: new Date().toISOString() }).eq("id", id);
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

  const statusAtual = STATUS_LABELS[veiculo.status] || STATUS_LABELS["ativo"];
  const condicaoLabel = (veiculo.condicao === "TERCEIRO" || veiculo.categoria === "locado") ? "Terceiro (Locado)" : "Próprio (Fremix)";
  const isTerceiro = veiculo.condicao === "TERCEIRO" || veiculo.categoria === "locado";

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            {veiculo.frota || veiculo.placa}
          </span>
          <span className="block text-[11px] text-primary-foreground/80">
            {veiculo.tipo || veiculo.nome} {veiculo.placa && veiculo.placa !== veiculo.frota ? `· ${veiculo.placa}` : ""}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => editando ? salvarEdicao() : setEditando(true)}
          disabled={salvando}
          className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1"
        >
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

        {/* Horímetro / Odômetro atual */}
        <div className={`rdo-card flex items-center gap-4 ${medidorAtual ? "border-l-4 border-l-primary" : "border-l-4 border-l-muted"}`}>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {medidorAtual?.tipo === "odômetro" ? "Odômetro Atual" : "Horímetro Atual"}
            </p>
            {medidorAtual ? (
              <>
                <p className="text-xl font-display font-extrabold text-primary leading-tight">
                  {medidorAtual.tipo === "odômetro"
                    ? `${medidorAtual.valor.toLocaleString("pt-BR")} km`
                    : `${medidorAtual.valor.toLocaleString("pt-BR")} h`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Última atualização: {fmtDate(medidorAtual.data)} • via {medidorAtual.fonte}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">Sem lançamentos</p>
                <p className="text-[11px] text-muted-foreground">Nenhum diário ou abastecimento registrado</p>
              </>
            )}
          </div>
        </div>

        {/* ── BLOCO 1: DADOS CADASTRAIS (somente leitura — gerenciado no Painel de Controle) */}
        <div className="rdo-card space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-bold text-sm">Dados Cadastrais</h3>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Editar no Painel de Controle
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Código / Frota",    value: veiculo.frota || "—" },
              { label: "Placa",             value: veiculo.placa || "—" },
              { label: "Tipo",              value: veiculo.tipo || veiculo.nome || "—" },
              { label: "Modelo / Nome",     value: veiculo.modelo_completo || veiculo.nome || "—" },
              { label: "Condição",          value: condicaoLabel },
              { label: "Empresa",           value: veiculo.empresa_proprietaria || veiculo.locadora || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <span className="rdo-label">{label}</span>
                <p className="text-sm font-medium text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── BLOCO 2: GESTÃO OPERACIONAL (editável pelo Gestão de Frotas) */}
        <div className="rdo-card space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm">Gestão Operacional</h3>
            {editando && (
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-semibold">
                modo edição
              </span>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <span className="rdo-label">Status do Equipamento</span>
            {editando ? (
              <Select
                value={veiculo.status || "ativo"}
                onValueChange={v => setVeiculo((prev: any) => ({
                  ...prev,
                  status: v,
                  // Limpa motivo e previsão se saiu de manutenção
                  motivo_manutencao: v !== "em_manutencao" ? "" : prev.motivo_manutencao,
                  previsao_liberacao: v !== "em_manutencao" ? null : prev.previsao_liberacao,
                }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <span style={{
                  background: statusAtual.bg, color: statusAtual.cor,
                  padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                }}>
                  {statusAtual.label}
                </span>
              </div>
            )}
          </div>

          {/* Motivo e previsão — aparecem quando em manutenção */}
          {(editando && (veiculo.status === "em_manutencao" || !veiculo.status)) || (!editando && (veiculo.motivo_manutencao || veiculo.previsao_liberacao)) ? (
            <div className="space-y-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="space-y-1.5">
                <span className="rdo-label">🔧 Motivo de Manutenção</span>
                {editando ? (
                  <Input
                    value={veiculo.motivo_manutencao || ""}
                    onChange={e => setVeiculo((v: any) => ({ ...v, motivo_manutencao: e.target.value }))}
                    placeholder="Ex: Troca de óleo, reparo elétrico..."
                    className="h-10 rounded-xl"
                  />
                ) : (
                  <p className="text-sm font-medium text-amber-800">{veiculo.motivo_manutencao || "—"}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">📅 Previsão de Liberação</span>
                {editando ? (
                  <Input
                    type="date"
                    value={veiculo.previsao_liberacao || ""}
                    onChange={e => setVeiculo((v: any) => ({ ...v, previsao_liberacao: e.target.value || null }))}
                    className="h-10 rounded-xl"
                  />
                ) : (
                  <p className="text-sm font-medium text-blue-700">
                    {veiculo.previsao_liberacao ? fmtDate(veiculo.previsao_liberacao) : "—"}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Equipe / Setor */}
          <div className="space-y-1.5">
            <span className="rdo-label">Equipe / Setor</span>
            {editando ? (
              <Input
                value={veiculo.setor || ""}
                onChange={e => setVeiculo((v: any) => ({ ...v, setor: e.target.value }))}
                placeholder="Ex: CBUQ01 - AELSON"
                className="h-10 rounded-xl"
              />
            ) : (
              <p className="text-sm font-medium">{veiculo.setor || "—"}</p>
            )}
          </div>

          {/* Valor mensal (só para terceiros) */}
          {(isTerceiro || editando) && (
            <div className="space-y-1.5">
              <span className="rdo-label">💰 Valor Mensal (locação)</span>
              {editando ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    value={veiculo.valor_mensal || ""}
                    onChange={e => setVeiculo((v: any) => ({ ...v, valor_mensal: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0,00"
                    className="h-10 rounded-xl pl-9"
                  />
                </div>
              ) : (
                <p className="text-sm font-medium text-orange-600 font-bold">
                  {veiculo.valor_mensal > 0 ? `${formatBRL(veiculo.valor_mensal)}/mês` : "—"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── CONDUTOR ── */}
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

        {/* ── DOCUMENTOS ── */}
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
                    {d.data_vencimento ? (dias <= 0 ? "⛔ VENCIDO" : fmtDate(d.data_vencimento)) : "Sem vencimento"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ── HISTÓRICO DE CONDUTORES ── */}
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
