import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Car, Truck, Wrench, FileText, Fuel, Search, ChevronRight, BarChart3, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useEquipamentoTipos, EquipCategoria } from "@/hooks/useEquipamentoTipos";

// Categorias que agrupam múltiplos tipos (exibem subtipo ao clicar)
const CATEGORIAS_GRUPO = ["CAMINHOES", "CARRETAS", "VEICULOS"];

// Ícone por categoria
function iconePorCategoria(cat: string): any {
  if (cat === "CAMINHOES" || cat === "CARRETAS") return Truck;
  if (cat === "VEICULOS") return Car;
  return Wrench;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function GestaoFrotasHome() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { categorias, loading: loadingTipos } = useEquipamentoTipos();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [medidoresMap, setMedidoresMap] = useState<Record<string, any>>({});
  const [aba, setAba] = useState<"frotas" | "documentos" | "consumo">("frotas");
  const [docsVencendo, setDocsVencendo] = useState<any[]>([]);

  // Cascata: categoria → subtipo → lista
  const [step, setStep] = useState<"tipo" | "subtipo" | "lista">("tipo");
  const [catSel, setCatSel] = useState<EquipCategoria | null>(null);
  const [subtipoSel, setSubtipoSel] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => { buscarTodos(); }, []);

  useEffect(() => {
    (supabase as any).from("manutencao_documentos")
      .select("*").not("data_vencimento", "is", null)
      .then(({ data }: any) => {
        if (!data) return;
        const agora = new Date();
        const vencendo = data
          .map((d: any) => ({
            ...d,
            dias_restantes: Math.ceil((new Date(d.data_vencimento).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)),
          }))
          .filter((d: any) => d.dias_restantes <= 30)
          .sort((a: any, b: any) => a.dias_restantes - b.dias_restantes);
        setDocsVencendo(vencendo);
      });
  }, []);

  async function buscarTodos() {
    setLoading(true);
    const { data } = await (supabase as any).from("equipamentos").select("*").eq("status", "ativo").order("tipo,frota");
    if (data) {
      setTodos(data);
      buscarMedidores(data);
    }
    setLoading(false);
  }

  async function buscarMedidores(veiculos: any[]) {
    if (!veiculos.length) return;
    const frotasSet = new Set(veiculos.map((v: any) => v.frota || v.placa).filter(Boolean));
    const [{ data: diarios }, { data: abastecs }] = await Promise.all([
      (supabase as any).from("equipment_diaries").select("equipment_fleet,equipment_type,meter_final,odometer_final,date").order("date", { ascending: false }).limit(3000),
      (supabase as any).from("abastecimentos").select("equipment_fleet,horimetro,km_odometro,data").order("data", { ascending: false }).limit(3000),
    ]);
    const map: Record<string, any> = {};
    (diarios || []).forEach((d: any) => {
      const frota = d.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const usaOdometro = ["Carreta", "Caminhões", "Veículo", "Comboio"].includes(d.equipment_type || "");
      const valor = usaOdometro ? d.odometer_final : d.meter_final;
      if (valor == null) return;
      if (!map[frota] || d.date > map[frota].data) map[frota] = { valor: Number(valor), tipo: usaOdometro ? "odômetro" : "horímetro", data: d.date };
    });
    (abastecs || []).forEach((a: any) => {
      const frota = a.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const temKm = a.km_odometro != null;
      const valor = temKm ? a.km_odometro : a.horimetro;
      if (valor == null) return;
      if (!map[frota] || a.data > map[frota].data) map[frota] = { valor: Number(valor), tipo: temKm ? "odômetro" : "horímetro", data: a.data };
    });
    setMedidoresMap(map);
  }

  const isGrupo = catSel ? CATEGORIAS_GRUPO.includes(catSel.key) : false;

  function voltar() {
    if (step === "lista") {
      if (isGrupo) { setStep("subtipo"); setBusca(""); }
      else { setStep("tipo"); setCatSel(null); setBusca(""); }
    } else if (step === "subtipo") { setStep("tipo"); setCatSel(null); }
  }

  // Lista de equipamentos filtrada
  const listaFiltrada = useMemo(() => {
    if (!catSel) return [];
    return todos.filter(v => {
      const tipoEquip = (v.tipo || "").toUpperCase();
      const tiposNaCat = catSel.tipos.map(t => t.tipoValor.toUpperCase());
      if (!tiposNaCat.includes(tipoEquip)) return false;
      if (subtipoSel && tipoEquip !== subtipoSel.toUpperCase()) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return [v.placa, v.frota, v.nome, v.modelo_completo, v.condutor_atual, v.setor, v.locadora, v.empresa_proprietaria].some((f: any) => f?.toLowerCase().includes(b));
      }
      return true;
    });
  }, [todos, catSel, subtipoSel, busca]);

  // Categorias com contagem real
  const categoriasComCount = useMemo(() => {
    return categorias.map(cat => {
      const tiposNaCat = cat.tipos.map(t => t.tipoValor.toUpperCase());
      const count = todos.filter(v => tiposNaCat.includes((v.tipo || "").toUpperCase())).length;
      return { ...cat, count };
    }).filter(c => c.count > 0);
  }, [categorias, todos]);

  const catSelLabel = catSel?.label ?? "";

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
            {step === "subtipo" && catSelLabel}
            {step === "lista" && `${subtipoSel || catSelLabel} — ${listaFiltrada.length} itens`}
          </span>
        </div>
      </header>

      {/* Abas */}
      <div className="flex border-b border-border bg-white">
        <button
          onClick={() => setAba("frotas")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "frotas" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          <Wrench className="w-4 h-4" /> Frotas
        </button>
        <button
          onClick={() => setAba("documentos")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "documentos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          <FileText className="w-4 h-4" /> Documentos
          {docsVencendo.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {docsVencendo.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAba("consumo")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "consumo" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          <Fuel className="w-4 h-4" /> Consumo de Diesel
        </button>
      </div>

      {aba === "frotas" && (
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Programações do dia */}
        {step === "tipo" && <ProgramacoesDoDia />}

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

            {/* Dashboard de localização via RDO */}
            <button onClick={() => navigate("/gestao-frotas/dashboard-rdo")} className="w-full rdo-card border-l-4 border-l-green-400 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Localização das Frotas (RDO)</p>
                <p className="text-xs text-muted-foreground">Onde cada equipamento estava — via apontamento</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>

            <p className="text-xs text-muted-foreground font-semibold px-1 pt-2">Selecione o tipo de equipamento:</p>
            {(loading || loadingTipos) ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
            ) : categoriasComCount.map(cat => {
              const Icon = iconePorCategoria(cat.key);
              const ehGrupo = CATEGORIAS_GRUPO.includes(cat.key);
              return (
                <button key={cat.key} onClick={() => {
                  setCatSel(cat);
                  setSubtipoSel("");
                  setBusca("");
                  if (ehGrupo) setStep("subtipo");
                  else setStep("lista");
                }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.count} equipamento{cat.count !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              );
            })}
          </>
        )}

        {/* PASSO 2: Subtipo (apenas para categorias agrupadas: Caminhões, Carretas, Veículos) */}
        {step === "subtipo" && catSel && isGrupo && (
          <>
            <p className="text-xs text-muted-foreground font-semibold px-1">Selecione o tipo de {catSelLabel}:</p>
            {/* Ver todos do grupo */}
            <button onClick={() => { setSubtipoSel(""); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">📋</div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Todos</p>
                <p className="text-xs text-muted-foreground">
                  {todos.filter(v => catSel.tipos.map(t => t.tipoValor.toUpperCase()).includes((v.tipo || "").toUpperCase())).length} equipamentos
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>
            {catSel.tipos.map(sub => {
              const count = todos.filter(v => (v.tipo || "").toUpperCase() === sub.tipoValor.toUpperCase()).length;
              if (count === 0) return null;
              const Icon = iconePorCategoria(catSel.key);
              return (
                <button key={sub.subtipo} onClick={() => { setSubtipoSel(sub.tipoValor); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {sub.icone ? <span className="text-lg">{sub.icone}</span> : <Icon className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">{sub.label}</p>
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'bg-blue-50' : 'bg-green-50'}`}>
                  <Car className={`w-5 h-5 ${(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'text-blue-600' : 'text-green-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm">{v.frota || v.placa}</span>
                    {v.placa && v.placa !== v.frota && <span className="text-xs text-muted-foreground">{v.placa}</span>}
                    {/* Tag Condição: PRÓPRIO ou TERCEIRO */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      (v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'Terceiro' : 'Próprio'}
                    </span>
                    {/* Tag Empresa */}
                    {v.locadora && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {v.locadora}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.nome || v.modelo_completo}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {v.setor && <span>🏢 {v.setor}</span>}
                    {v.condutor_atual && <span>👤 {v.condutor_atual}</span>}
                    {v.valor_mensal > 0 && <span className="text-orange-600 font-semibold">{formatBRL(v.valor_mensal)}/mês</span>}
                  </div>
                  {/* Horímetro / Odômetro */}
                  {(() => {
                    const frotaBase = v.frota || v.placa;
                    const med = medidoresMap[frotaBase];
                    if (!med) return null;
                    return (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {med.tipo === "odômetro" ? "📍" : "⏱"} {med.tipo === "odômetro" ? `${med.valor.toLocaleString("pt-BR")} km` : `${med.valor.toLocaleString("pt-BR")} h`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">em {fmtDate(med.data)}</span>
                      </div>
                    );
                  })()}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              </button>
            ))}
          </>
        )}
      </div>
      )}

      {/* ABA DOCUMENTOS */}
      {aba === "documentos" && (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {docsVencendo.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-sm font-bold text-orange-700 mb-2">⚠️ {docsVencendo.length} documento{docsVencendo.length !== 1 ? "s" : ""} vencendo em breve</p>
              {docsVencendo.slice(0, 3).map((d, i) => (
                <p key={i} className="text-xs text-orange-600">
                  {d.equipment_fleet} — {d.tipo_documento}: {d.dias_restantes <= 0 ? "⛔ VENCIDO" : `${d.dias_restantes} dias`}
                </p>
              ))}
            </div>
          )}
          {isAdmin && (
            <Button onClick={() => navigate("/manutencao/documentos")} className="w-full h-11 gap-2 rounded-xl font-display font-bold">
              <Plus className="w-4 h-4" /> Adicionar Documento
            </Button>
          )}
          <Button onClick={() => navigate("/manutencao/documentos")} variant="outline" className="w-full h-11 gap-2 rounded-xl font-semibold">
            <FileText className="w-4 h-4" /> Ver Todos os Documentos
          </Button>
        </div>
      )}

      {/* ABA CONSUMO DE DIESEL */}
      {aba === "consumo" && (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <Button onClick={() => navigate("/manutencao/consumo")} className="w-full h-11 gap-2 rounded-xl font-display font-bold">
            <Fuel className="w-4 h-4" /> Consumo de Diesel
          </Button>
        </div>
      )}
    </div>
  );
}
