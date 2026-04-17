import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Car, Truck, Wrench, FileText, Search, ChevronRight, BarChart3, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Veiculo {
  id: string;
  codigo_custo: string;
  placa: string;
  modelo: string;
  ano: string;
  setor: string;
  condutor_atual: string;
  tipo_veiculo: string;
  categoria: string;
  locadora: string;
  frota_operacional: string;
  status: string;
  observacoes: string;
  valor_mensal: number;
}

// Tipos principais e seus subtipos
const TIPOS_CONFIG: Record<string, { label: string; icon: any; subtipos: string[] }> = {
  veiculo_leve: {
    label: "Veículos Leves",
    icon: Car,
    subtipos: [], // abre direto
  },
  utilitario: {
    label: "Utilitários",
    icon: Car,
    subtipos: ["SAVEIRO", "MONTANA", "PICK-UP"],
  },
  caminhao: {
    label: "Caminhões",
    icon: Truck,
    subtipos: ["CAMINHÃO BASCULANTE", "CAMINHÃO CARROCERIA", "CAMINHÃO COMBOIO", "CAMINHÃO ESPARGIDOR", "CAMINHÃO PIPA", "CAMINHÃO PLATAFORMA"],
  },
  carreta: {
    label: "Carretas",
    icon: Truck,
    subtipos: ["CARRETA", "CAVALO MECÂNICO", "PRANCHA"],
  },
  maquina: {
    label: "Máquinas",
    icon: Wrench,
    subtipos: ["FRESADORA", "BOBCAT", "ROLO CHAPA", "ROLO PNEU", "ROLO PÉ DE CARNEIRO", "VIBRO ACABADORA", "USINA MÓVEL", "RETROESCAVADEIRA", "COMPRESSOR", "GERADOR", "SERRA CLIPER", "ROMPEDOR ELÉTRICO", "ROMPEDOR PNEUMATICO", "PLACA VIBRATÓRIA", "SAPO COMPACTADOR", "MISTURADOR DE ARGAMASSA", "COMPACTADOR DE SOLO", "DENSIMETRO", "PMV MÓVEL", "BANHEIRO QUÍMICO", "CARRETINHA BANHEIRO"],
  },
  van: {
    label: "Vans / Micro-ônibus",
    icon: Car,
    subtipos: [],
  },
  outro: {
    label: "Outros",
    icon: Car,
    subtipos: [],
  },
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function GestaoFrotasHome() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);

  // Cascata
  const [step, setStep] = useState<"tipo" | "subtipo" | "lista" | "dashboard">("tipo");
  const [tipoSel, setTipoSel] = useState("");
  const [subtipoSel, setSubtipoSel] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => { buscarTodos(); }, []);

  async function buscarTodos() {
    setLoading(true);
    const { data } = await supabase.from("frotas_gestao").select("*").eq("status", "ativo").order("tipo_veiculo,codigo_custo");
    if (data) setTodos(data);
    setLoading(false);
  }

  function voltar() {
    if (step === "lista") { setStep(TIPOS_CONFIG[tipoSel]?.subtipos.length > 0 ? "subtipo" : "tipo"); setSubtipoSel(""); setBusca(""); }
    else if (step === "subtipo") { setStep("tipo"); setTipoSel(""); }
    else if (step === "dashboard") setStep("tipo");
  }

  // Filtrar veículos para a lista atual
  const listaFiltrada = todos.filter(v => {
    if (v.tipo_veiculo !== tipoSel) return false;
    if (subtipoSel) {
      const modeloUpper = (v.modelo || "").toUpperCase();
      if (!modeloUpper.includes(subtipoSel.toUpperCase())) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      return [v.placa, v.modelo, v.codigo_custo, v.condutor_atual, v.setor, v.locadora].some(f => f?.toLowerCase().includes(b));
    }
    return true;
  });

  // Dashboard de custos
  const terceiros = todos.filter(v => v.categoria === "locado" && v.valor_mensal > 0);
  const totalMensal = terceiros.reduce((s, v) => s + (v.valor_mensal || 0), 0);
  const porTipo = Object.entries(
    terceiros.reduce<Record<string, number>>((acc, v) => {
      const t = TIPOS_CONFIG[v.tipo_veiculo]?.label || v.tipo_veiculo;
      acc[t] = (acc[t] || 0) + (v.valor_mensal || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={step === "tipo" ? () => navigate("/") : voltar} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Gestão de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">
            {step === "tipo" && `${todos.length} equipamentos cadastrados`}
            {step === "subtipo" && TIPOS_CONFIG[tipoSel]?.label}
            {step === "lista" && `${subtipoSel || TIPOS_CONFIG[tipoSel]?.label} — ${listaFiltrada.length} itens`}
            {step === "dashboard" && "Custos com Terceiros"}
          </span>
        </div>
        {step === "tipo" && (
          <Button size="sm" onClick={() => navigate("/manutencao/documentos")} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 text-xs">
            <FileText className="w-3.5 h-3.5" /> Docs
          </Button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* PASSO 1: Tipo */}
        {step === "tipo" && (
          <>
            {/* Dashboard detalhado por equipe/tipo */}
            <button onClick={() => navigate("/gestao-frotas/dashboard")} className="w-full rdo-card border-l-4 border-l-blue-400 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Dashboard por Equipe / Tipo</p>
                <p className="text-xs text-muted-foreground">Visão detalhada com tabelas para apresentação</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>

        {/* Dashboard de custos */}
            <button onClick={() => setStep("dashboard")} className="w-full rdo-card border-l-4 border-l-orange-400 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Dashboard de Custos</p>
                <p className="text-xs text-muted-foreground">Total terceiros: <strong className="text-orange-600">{formatBRL(totalMensal)}/mês</strong></p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>

            <p className="text-xs text-muted-foreground font-semibold px-1 pt-2">Selecione o tipo:</p>
            {Object.entries(TIPOS_CONFIG).map(([key, cfg]) => {
              const count = todos.filter(v => v.tipo_veiculo === key).length;
              if (count === 0) return null;
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => {
                  setTipoSel(key);
                  if (cfg.subtipos.length > 0) setStep("subtipo");
                  else setStep("lista");
                }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{count} equipamento{count !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              );
            })}
          </>
        )}

        {/* PASSO 2: Subtipo */}
        {step === "subtipo" && tipoSel && (
          <>
            <p className="text-xs text-muted-foreground font-semibold px-1">Selecione o tipo de {TIPOS_CONFIG[tipoSel]?.label}:</p>
            {/* Ver todos */}
            <button onClick={() => { setSubtipoSel(""); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">📋</div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Todos</p>
                <p className="text-xs text-muted-foreground">{todos.filter(v => v.tipo_veiculo === tipoSel).length} equipamentos</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>
            {TIPOS_CONFIG[tipoSel]?.subtipos.map(sub => {
              const count = todos.filter(v => v.tipo_veiculo === tipoSel && (v.modelo || "").toUpperCase().includes(sub.toUpperCase())).length;
              if (count === 0) return null;
              return (
                <button key={sub} onClick={() => { setSubtipoSel(sub); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">{sub}</p>
                    <p className="text-xs text-muted-foreground">{count} equipamento{count !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              );
            })}
          </>
        )}

        {/* PASSO 3: Lista */}
        {step === "lista" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar placa, modelo, condutor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-10 rounded-xl" />
            </div>
            <p className="text-xs text-muted-foreground px-1">{listaFiltrada.length} resultado{listaFiltrada.length !== 1 ? "s" : ""}</p>
            {loading ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : listaFiltrada.map(v => (
              <button key={v.id} onClick={() => navigate(`/gestao-frotas/veiculo/${v.id}`)} className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.categoria === "locado" ? "bg-blue-50" : "bg-green-50"}`}>
                  <Car className={`w-5 h-5 ${v.categoria === "locado" ? "text-blue-600" : "text-green-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm">{v.codigo_custo || v.placa}</span>
                    {v.placa && v.placa !== v.codigo_custo && <span className="text-xs text-muted-foreground">{v.placa}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${v.categoria === "locado" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {v.categoria === "locado" ? `${v.locadora || "Locado"}` : "Próprio"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.modelo}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {v.setor && <span>🏢 {v.setor}</span>}
                    {v.condutor_atual && <span>👤 {v.condutor_atual}</span>}
                    {v.valor_mensal > 0 && <span className="text-orange-600 font-semibold">{formatBRL(v.valor_mensal)}/mês</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              </button>
            ))}
          </>
        )}

        {/* DASHBOARD DE CUSTOS */}
        {step === "dashboard" && (
          <>
            <div className="rdo-card border-l-4 border-l-orange-400 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Mensal com Terceiros</p>
              <p className="text-3xl font-display font-black text-orange-600">{formatBRL(totalMensal)}</p>
              <p className="text-xs text-muted-foreground mt-1">{terceiros.length} equipamentos terceirizados</p>
            </div>

            <div className="rdo-card space-y-2">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Por Tipo de Equipamento
              </h3>
              {porTipo.map(([tipo, valor]) => {
                const pct = Math.round((valor / totalMensal) * 100);
                return (
                  <div key={tipo} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{tipo}</span>
                      <span className="font-bold text-orange-600">{formatBRL(valor)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">{pct}% do total</p>
                  </div>
                );
              })}
            </div>

            <div className="rdo-card space-y-2">
              <h3 className="font-display font-bold text-sm">Por Fornecedor/Locadora</h3>
              {Object.entries(
                terceiros.reduce<Record<string, number>>((acc, v) => {
                  const loc = v.locadora || "Sem locadora";
                  acc[loc] = (acc[loc] || 0) + (v.valor_mensal || 0);
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([loc, val]) => (
                <div key={loc} className="flex items-center justify-between text-sm border-b border-border pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{loc}</span>
                  <span className="font-bold text-orange-600">{formatBRL(val)}/mês</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rdo-card">
                <p className="text-lg font-display font-bold text-orange-600">{formatBRL(totalMensal * 12)}</p>
                <p className="text-muted-foreground">Custo Anual</p>
              </div>
              <div className="rdo-card">
                <p className="text-lg font-display font-bold text-primary">{todos.filter(v => v.categoria === "proprio").length}</p>
                <p className="text-muted-foreground">Próprios</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
