import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, FileText, Plus, Loader2, Check, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function fmtDate(d: string) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}
function fmtBRL(v: number) {
  return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";
}

export default function MedicoesTerceiros() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<"busca" | "config" | "resultado" | "historico">("busca");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Busca
  const [frota, setFrota] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [equipamento, setEquipamento] = useState<any>(null);

  // Dados do período
  const [diasTrabalhados, setDiasTrabalhados] = useState(0);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<any[]>([]);

  // Config de cobrança
  const [cobrarDias, setCobrarDias] = useState(true);
  const [cobrarOcorr, setCobrarOcorr] = useState(false);
  const [cobrarManut, setCobrarManut] = useState(false);
  const [cobrarDiesel, setCobrarDiesel] = useState(false);
  const [valorDiaria, setValorDiaria] = useState("");

  // Histórico
  const [historico, setHistorico] = useState<any[]>([]);

  // Medição gerada
  const [medicaoGerada, setMedicaoGerada] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { buscarProfile(); }, []);

  async function buscarProfile() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.user.id).single();
    setProfile(p);
    buscarHistorico(p?.company_id);
  }

  async function buscarHistorico(companyId: string) {
    const { data } = await (supabase as any)
      .from("equipamentos_medicoes")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistorico(data || []);
  }

  async function buscarDados() {
    if (!frota.trim() || !dataInicio || !dataFim) {
      toast({ title: "Preencha frota e período", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Busca equipamento
    const { data: eq } = await (supabase as any)
      .from("equipamentos")
      .select("*")
      .ilike("frota", frota.trim())
      .eq("company_id", profile?.company_id)
      .single();

    if (!eq) {
      toast({ title: `Frota "${frota}" não encontrada`, variant: "destructive" });
      setLoading(false);
      return;
    }
    setEquipamento(eq);
    if (eq.valor_mensal) setValorDiaria((eq.valor_mensal / 30).toFixed(2));

    // Busca ocorrências no período
    const { data: ocorr } = await (supabase as any)
      .from("equipamentos_ocorrencias")
      .select("*")
      .eq("equipamento_id", eq.id)
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim + "T23:59:59");

    // Busca manutenções no período
    const { data: manut } = await (supabase as any)
      .from("equipamentos_manutencoes")
      .select("*")
      .eq("equipamento_id", eq.id)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    // Busca abastecimentos no período (por frota texto)
    const { data: abt } = await (supabase as any)
      .from("abastecimentos")
      .select("*")
      .eq("equipment_fleet", eq.frota)
      .eq("company_id", profile?.company_id)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    // Calcula dias trabalhados (dias úteis no período com RDO ou diário)
    const { data: diarios } = await (supabase as any)
      .from("equipment_diaries")
      .select("id, date")
      .eq("company_id", profile?.company_id)
      .gte("date", dataInicio)
      .lte("date", dataFim);

    // Dias com lançamento de equipamento nessa frota
    const { data: rdoEquip } = await (supabase as any)
      .from("rdo_equipamentos")
      .select("rdo_id, frota, rdo_diarios(data)")
      .eq("frota", eq.frota);

    const diasComLancamento = new Set(
      (rdoEquip || [])
        .filter((r: any) => r.rdo_diarios?.data >= dataInicio && r.rdo_diarios?.data <= dataFim)
        .map((r: any) => r.rdo_diarios?.data)
    );

    // Se não tem lançamento em RDO, calcula por dias corridos
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diasCorridos = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1;
    const dias = diasComLancamento.size > 0 ? diasComLancamento.size : diasCorridos;

    setOcorrencias(ocorr || []);
    setManutencoes(manut || []);
    setAbastecimentos(abt || []);
    setDiasTrabalhados(dias);
    setLoading(false);
    setStep("config");
  }

  function calcularTotal() {
    const vDiaria = parseFloat(valorDiaria) || 0;
    let total = cobrarDias ? (vDiaria * diasTrabalhados) : 0;
    if (cobrarManut) total += manutencoes.reduce((s, m) => s + (m.custo || 0), 0);
    return total;
  }

  async function gerarMedicao() {
    setSalvando(true);
    const numero = `MED-${Date.now().toString().slice(-6)}`;
    const totalDiesel = abastecimentos.reduce((s, a) => s + (a.litros || 0), 0);
    const itens = [
      cobrarDias && { descricao: `${diasTrabalhados} dias trabalhados × ${fmtBRL(parseFloat(valorDiaria) || 0)}/dia`, valor: (parseFloat(valorDiaria) || 0) * diasTrabalhados, cobrar: true },
      cobrarManut && manutencoes.length > 0 && { descricao: `${manutencoes.length} manutenção(ões)`, valor: manutencoes.reduce((s, m) => s + (m.custo || 0), 0), cobrar: true },
      cobrarOcorr && { descricao: `${ocorrencias.length} ocorrência(s) registrada(s)`, valor: 0, cobrar: false },
      cobrarDiesel && { descricao: `${totalDiesel.toFixed(0)}L diesel abastecido`, valor: 0, cobrar: false },
    ].filter(Boolean);

    const { data, error } = await (supabase as any).from("equipamentos_medicoes").insert({
      equipamento_id: equipamento.id,
      company_id: profile?.company_id,
      frota: equipamento.frota,
      empresa_proprietaria: equipamento.empresa_proprietaria,
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      dias_trabalhados: diasTrabalhados,
      valor_base: parseFloat(valorDiaria) || equipamento.valor_mensal || 0,
      valor_total: calcularTotal(),
      cobrar_ocorrencias: cobrarOcorr,
      cobrar_manutencoes: cobrarManut,
      cobrar_diesel: cobrarDiesel,
      total_ocorrencias: ocorrencias.length,
      total_manutencoes: manutencoes.length,
      total_diesel: totalDiesel,
      itens_medicao: itens,
      status: "PENDENTE",
      numero_medicao: numero,
      gerado_por: profile?.nome_completo || profile?.email,
    }).select().single();

    if (!error && data) {
      setMedicaoGerada(data);
      toast({ title: `Medição ${numero} gerada!` });
      setStep("resultado");
      buscarHistorico(profile?.company_id);
    } else {
      toast({ title: "Erro ao gerar medição", variant: "destructive" });
    }
    setSalvando(false);
  }

  async function atualizarStatusMedicao(id: string, status: string) {
    await (supabase as any).from("equipamentos_medicoes").update({ status }).eq("id", id);
    buscarHistorico(profile?.company_id);
    toast({ title: `Status atualizado: ${status}` });
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate("/medicoes")} className="hover:bg-white/15 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-black">Medições</h1>
            <p className="text-sm opacity-80">Equipamentos Terceirizados</p>
          </div>
        </div>
        {/* Abas */}
        <div className="flex gap-2">
          {(["busca", "historico"] as const).map(s => (
            <button key={s} onClick={() => setStep(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${step === s || (step === "config" && s === "busca") || (step === "resultado" && s === "historico") ? "bg-white text-violet-700" : "bg-white/20 text-white"}`}>
              {s === "busca" ? "Nova Medição" : `Histórico (${historico.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ===== BUSCA ===== */}
        {(step === "busca") && (
          <div className="space-y-4">
            <div className="rdo-card space-y-3">
              <h3 className="font-display font-bold text-sm">Buscar Equipamento</h3>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Frota *</Label>
                <Input value={frota} onChange={e => setFrota(e.target.value.toUpperCase())} className="h-11 rounded-xl font-mono" placeholder="Ex: FA20, MOBILE01..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Período início *</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Período fim *</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <Button onClick={buscarDados} disabled={loading} className="w-full h-11 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
              </Button>
            </div>
          </div>
        )}

        {/* ===== CONFIG ===== */}
        {step === "config" && equipamento && (
          <div className="space-y-4">
            {/* Info equipamento */}
            <div className="rdo-card border-l-4 border-l-violet-400">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-bold">{equipamento.frota} — {equipamento.tipo}</p>
                  <p className="text-sm text-muted-foreground">{equipamento.empresa_proprietaria || "Próprio"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtDate(dataInicio)} a {fmtDate(dataFim)}</p>
                </div>
                <button onClick={() => setStep("busca")} className="text-muted-foreground p-1"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Resumo do período */}
            <div className="rdo-card space-y-2">
              <h3 className="font-display font-bold text-sm">Resumo do Período</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-violet-50 rounded-xl p-2">
                  <p className="text-lg font-display font-black text-violet-700">{diasTrabalhados}</p>
                  <p className="text-[10px] text-muted-foreground">Dias</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-2">
                  <p className="text-lg font-display font-black text-orange-700">{ocorrencias.length}</p>
                  <p className="text-[10px] text-muted-foreground">Ocorrências</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-2">
                  <p className="text-lg font-display font-black text-blue-700">{manutencoes.length}</p>
                  <p className="text-[10px] text-muted-foreground">Manutenções</p>
                </div>
              </div>
              {abastecimentos.length > 0 && (
                <div className="bg-green-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-display font-black text-green-700">
                    {abastecimentos.reduce((s, a) => s + (a.litros || 0), 0).toFixed(0)}L
                  </p>
                  <p className="text-[10px] text-muted-foreground">Diesel abastecido</p>
                </div>
              )}
            </div>

            {/* Configurar cobrança */}
            <div className="rdo-card space-y-3">
              <h3 className="font-display font-bold text-sm">O que cobrar na medição?</h3>

              {/* Diária */}
              <div className={`p-3 rounded-xl border-2 transition-all ${cobrarDias ? "border-violet-400 bg-violet-50" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCobrarDias(v => !v)}
                      className={`w-5 h-5 rounded flex items-center justify-center ${cobrarDias ? "bg-violet-600" : "border-2 border-border"}`}>
                      {cobrarDias && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className="text-sm font-medium">{diasTrabalhados} dias trabalhados</span>
                  </div>
                </div>
                {cobrarDias && (
                  <div className="mt-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor por dia (R$)</Label>
                    <Input type="number" value={valorDiaria} onChange={e => setValorDiaria(e.target.value)} className="h-9 rounded-xl" placeholder="0,00" />
                  </div>
                )}
              </div>

              {/* Manutenções */}
              {manutencoes.length > 0 && (
                <div className={`p-3 rounded-xl border-2 transition-all ${cobrarManut ? "border-blue-400 bg-blue-50" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCobrarManut(v => !v)}
                      className={`w-5 h-5 rounded flex items-center justify-center ${cobrarManut ? "bg-blue-600" : "border-2 border-border"}`}>
                      {cobrarManut && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <span className="text-sm font-medium">{manutencoes.length} manutenção(ões)</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {fmtBRL(manutencoes.reduce((s, m) => s + (m.custo || 0), 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Ocorrências — só informativo */}
              {ocorrencias.length > 0 && (
                <div className={`p-3 rounded-xl border-2 transition-all ${cobrarOcorr ? "border-orange-400 bg-orange-50" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCobrarOcorr(v => !v)}
                      className={`w-5 h-5 rounded flex items-center justify-center ${cobrarOcorr ? "bg-orange-600" : "border-2 border-border"}`}>
                      {cobrarOcorr && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div>
                      <span className="text-sm font-medium">{ocorrencias.length} ocorrência(s)</span>
                      <p className="text-[10px] text-muted-foreground">Incluir no relatório (sem cobrança)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Diesel */}
              {abastecimentos.length > 0 && (
                <div className={`p-3 rounded-xl border-2 transition-all ${cobrarDiesel ? "border-green-400 bg-green-50" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCobrarDiesel(v => !v)}
                      className={`w-5 h-5 rounded flex items-center justify-center ${cobrarDiesel ? "bg-green-600" : "border-2 border-border"}`}>
                      {cobrarDiesel && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div>
                      <span className="text-sm font-medium">{abastecimentos.reduce((s, a) => s + (a.litros || 0), 0).toFixed(0)}L diesel</span>
                      <p className="text-[10px] text-muted-foreground">Incluir no relatório (sem cobrança)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="rdo-card bg-violet-50 border-violet-200 text-center">
              <p className="text-xs text-muted-foreground">Total da Medição</p>
              <p className="text-3xl font-display font-black text-violet-700">{fmtBRL(calcularTotal())}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmtDate(dataInicio)} a {fmtDate(dataFim)}</p>
            </div>

            <Button onClick={gerarMedicao} disabled={salvando} className="w-full h-12 gap-2 bg-violet-600 hover:bg-violet-700 text-base font-bold">
              {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} Gerar Medição
            </Button>
          </div>
        )}

        {/* ===== RESULTADO ===== */}
        {step === "resultado" && medicaoGerada && (
          <div className="space-y-4">
            <div className="rdo-card border-l-4 border-l-green-500 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <h3 className="font-display font-bold">Medição Gerada!</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Número</p><p className="font-bold text-violet-700">{medicaoGerada.numero_medicao}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{medicaoGerada.status}</p></div>
                <div><p className="text-xs text-muted-foreground">Frota</p><p className="font-medium">{medicaoGerada.frota}</p></div>
                <div><p className="text-xs text-muted-foreground">Dias</p><p className="font-medium">{medicaoGerada.dias_trabalhados}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Período</p><p className="font-medium">{fmtDate(medicaoGerada.periodo_inicio)} a {fmtDate(medicaoGerada.periodo_fim)}</p></div>
              </div>
              {medicaoGerada.itens_medicao && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Itens</p>
                  {medicaoGerada.itens_medicao.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-1 last:border-0">
                      <span className="text-muted-foreground">{item.descricao}</span>
                      {item.valor > 0 && <span className="font-bold text-violet-700">{fmtBRL(item.valor)}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-bold">Total</span>
                <span className="text-xl font-display font-black text-violet-700">{fmtBRL(medicaoGerada.valor_total)}</span>
              </div>
            </div>

            {/* Atualizar status */}
            <div className="rdo-card space-y-2">
              <p className="text-sm font-medium">Atualizar status da medição:</p>
              <div className="flex gap-2 flex-wrap">
                {["PENDENTE", "APROVADA", "PAGA", "CANCELADA"].map(s => (
                  <Button key={s} size="sm" variant={medicaoGerada.status === s ? "default" : "outline"}
                    onClick={() => { atualizarStatusMedicao(medicaoGerada.id, s); setMedicaoGerada({ ...medicaoGerada, status: s }); }}
                    className="text-xs h-8">
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={() => { setStep("busca"); setEquipamento(null); setFrota(""); setDataInicio(""); setDataFim(""); }} className="w-full h-11">
              Nova Medição
            </Button>
          </div>
        )}

        {/* ===== HISTÓRICO ===== */}
        {step === "historico" && (
          <div className="space-y-3">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma medição gerada ainda.</p>
            ) : historico.map(m => {
              const statusColor: Record<string, string> = {
                PENDENTE: "bg-orange-100 text-orange-700",
                APROVADA: "bg-blue-100 text-blue-700",
                PAGA: "bg-green-100 text-green-700",
                CANCELADA: "bg-gray-100 text-gray-500",
              };
              return (
                <div key={m.id} className="rdo-card hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm">{m.frota}</span>
                        <span className="text-xs text-muted-foreground">{m.numero_medicao}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColor[m.status] || statusColor.PENDENTE}`}>{m.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(m.periodo_inicio)} a {fmtDate(m.periodo_fim)} · {m.dias_trabalhados} dias</p>
                      {m.empresa_proprietaria && <p className="text-xs text-muted-foreground">{m.empresa_proprietaria}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-display font-black text-violet-700">{fmtBRL(m.valor_total)}</p>
                      <div className="flex gap-1 mt-1 justify-end">
                        {["APROVADA", "PAGA"].map(s => (
                          <Button key={s} size="sm" variant="outline" onClick={() => atualizarStatusMedicao(m.id, s)}
                            className={`text-[10px] h-6 px-2 ${m.status === s ? "bg-green-50 border-green-300 text-green-700" : ""}`}>
                            {s === "APROVADA" ? "Aprovar" : "Pagar"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
