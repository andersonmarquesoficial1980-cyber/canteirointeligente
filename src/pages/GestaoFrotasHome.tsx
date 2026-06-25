import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Car, Truck, Wrench, FileText, Fuel, Search, ChevronRight, BarChart3, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Veiculo {
  id: string;
  frota: string;       // código da frota (CM001, FRS01 etc)
  placa: string;
  nome: string;        // nome curto
  modelo_completo: string; // descrição completa
  ano: string;
  setor: string;
  condutor_atual: string;
  tipo_veiculo: string;
  categoria: string;
  locadora: string;
  empresa_proprietaria: string;
  status: string;
  observacoes: string;
  valor_mensal: number;
  condicao?: string;
  tipo: string;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface DocVencendo {
  equipment_fleet: string;
  tipo_documento: string;
  data_vencimento: string;
  dias_restantes: number;
}

interface MedidorInfo {
  valor: number;
  tipo: "horímetro" | "odômetro";
  data: string;
}

// Tipos principais e seus subtipos
// Mapeamento do campo `tipo` do banco para ícone e grupo
const TIPO_ICONE: Record<string, any> = {
  "FRESADORA": Wrench, "BOBCAT": Wrench, "RETROESCAVADEIRA": Wrench,
  "ROLO CHAPA": Wrench, "ROLO PNEU": Wrench, "ROLO PÉ DE CARNEIRO": Wrench,
  "VIBRO ACABADORA": Wrench, "USINA MÓVEL": Wrench, "COMPRESSOR": Wrench,
  "GERADOR": Wrench, "SERRA CLIPER": Wrench, "ROMPEDOR ELÉTRICO": Wrench,
  "ROMPEDOR PNEUMATICO": Wrench, "PLACA VIBRATÓRIA": Wrench,
  "MISTURADOR DE ARGAMASSA": Wrench, "PA CARREGADEIRA": Wrench,
  "CAMINHÃO BASCULANTE": Truck, "CAMINHÃO CARROCERIA": Truck,
  "CAMINHÃO COMBOIO": Truck, "CAMINHÃO ESPARGIDOR": Truck,
  "CAMINHÃO PIPA": Truck, "CAMINHÃO PLATAFORMA": Truck,
  "CARRETA CM": Truck, "CAVALO MECANICO": Truck,
  "VAN": Car, "MICROONIBUS": Car,
};

// Grupos agrupados (caminhões, carretas, vans) — o resto vira categoria própria
const GRUPOS_AGRUPADOS: Record<string, { label: string; icon: any; tipos: string[] }> = {
  caminhao: {
    label: "Caminhões",
    icon: Truck,
    tipos: ["CAMINHÃO BASCULANTE", "CAMINHÃO CARROCERIA", "CAMINHÃO COMBOIO",
            "CAMINHÃO ESPARGIDOR", "CAMINHÃO PIPA", "CAMINHÃO PLATAFORMA"],
  },
  carreta: {
    label: "Carretas",
    icon: Truck,
    tipos: ["CARRETA CM", "CAVALO MECANICO"],
  },
  van: {
    label: "Vans / Micro-ônibus",
    icon: Car,
    tipos: ["VAN", "MICROONIBUS"],
  },
};

// Tipos que ficam individualmente (não entram em grupo)
const TIPOS_INDIVIDUAIS = [
  "FRESADORA", "BOBCAT", "RETROESCAVADEIRA",
  "ROLO CHAPA", "ROLO PNEU", "ROLO PÉ DE CARNEIRO",
  "VIBRO ACABADORA", "USINA MÓVEL", "COMPRESSOR",
  "GERADOR", "SERRA CLIPER", "ROMPEDOR ELÉTRICO",
  "ROMPEDOR PNEUMATICO", "PLACA VIBRATÓRIA",
  "MISTURADOR DE ARGAMASSA", "PA CARREGADEIRA",
  "BANHEIRO QUÍMICO", "CARRETINHA BANHEIRO",
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function GestaoFrotasHome() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [todos, setTodos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [medidoresMap, setMedidoresMap] = useState<Record<string, MedidorInfo>>({});
  const [aba, setAba] = useState<"frotas" | "documentos" | "consumo">("frotas");
  const [docsVencendo, setDocsVencendo] = useState<DocVencendo[]>([]);

  // Cascata
  const [step, setStep] = useState<"tipo" | "subtipo" | "lista" | "dashboard">("tipo");
  const [tipoSel, setTipoSel] = useState("");
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
      // Buscar últimos horímetros/odômetros dos diários em paralelo
      buscarMedidores(data);
    }
    setLoading(false);
  }

  async function buscarMedidores(veiculos: Veiculo[]) {
    if (!veiculos.length) return;
    // Busca sem filtro por frota para evitar limite de URL do Supabase com 140+ frotas
    // Filtra no JS depois
    const frotasSet = new Set(veiculos.map(v => v.frota || v.placa).filter(Boolean));
    const [{ data: diarios }, { data: abastecs }] = await Promise.all([
      (supabase as any)
        .from("equipment_diaries")
        .select("equipment_fleet,equipment_type,meter_final,odometer_final,date")
        .order("date", { ascending: false })
        .limit(3000),
      (supabase as any)
        .from("abastecimentos")
        .select("equipment_fleet,horimetro,km_odometro,data")
        .order("data", { ascending: false })
        .limit(3000),
    ]);

    const map: Record<string, MedidorInfo> = {};

    // Processar diários — pega o mais recente por frota
    (diarios || []).forEach((d: any) => {
      const frota = d.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const usaOdometro = ["Carreta", "Caminhões", "Veículo", "Comboio"].includes(d.equipment_type || "");
      const valor = usaOdometro ? d.odometer_final : d.meter_final;
      if (valor == null) return;
      if (!map[frota] || d.date > map[frota].data) {
        map[frota] = { valor: Number(valor), tipo: usaOdometro ? "odômetro" : "horímetro", data: d.date };
      }
    });

    // Processar abastecimentos — substitui se mais recente
    (abastecs || []).forEach((a: any) => {
      const frota = a.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const temKm = a.km_odometro != null;
      const valor = temKm ? a.km_odometro : a.horimetro;
      if (valor == null) return;
      if (!map[frota] || a.data > map[frota].data) {
        map[frota] = { valor: Number(valor), tipo: temKm ? "odômetro" : "horímetro", data: a.data };
      }
    });

    setMedidoresMap(map);
  }

  // Resolve o rótulo do tipoSel atual
  const tipoSelLabel = GRUPOS_AGRUPADOS[tipoSel]?.label ?? tipoSel;

  // Verifica se tipoSel é um grupo agrupado
  const isGrupo = !!GRUPOS_AGRUPADOS[tipoSel];

  function voltar() {
    if (step === "lista") {
      if (isGrupo) { setStep("subtipo"); setBusca(""); }
      else { setStep("tipo"); setTipoSel(""); setBusca(""); }
    } else if (step === "subtipo") { setStep("tipo"); setTipoSel(""); }
    else if (step === "dashboard") setStep("tipo");
  }

  // Filtrar veículos para a lista atual
  const listaFiltrada = todos.filter(v => {
    const tipoEquip = (v.tipo || "").toUpperCase();
    // Se for grupo agrupado, filtra pelo subtipo selecionado ou todos do grupo
    if (isGrupo) {
      const tiposDoGrupo = GRUPOS_AGRUPADOS[tipoSel].tipos.map(t => t.toUpperCase());
      if (!tiposDoGrupo.includes(tipoEquip)) return false;
      if (subtipoSel && tipoEquip !== subtipoSel.toUpperCase()) return false;
    } else {
      // Tipo individual — filtra direto pelo campo tipo
      if (tipoEquip !== tipoSel.toUpperCase()) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      return [v.placa, v.frota, v.nome, v.modelo_completo, v.condutor_atual, v.setor, v.locadora, v.empresa_proprietaria].some(f => f?.toLowerCase().includes(b));
    }
    return true;
  });

  // Monta lista de categorias dinâmicas a partir dos dados reais
  const categoriasDinamicas = (() => {
    const tiposNoGrupo = Object.values(GRUPOS_AGRUPADOS).flatMap(g => g.tipos.map(t => t.toUpperCase()));
    const result: { key: string; label: string; icon: any; count: number; isGrupo: boolean }[] = [];

    // Grupos agrupados
    Object.entries(GRUPOS_AGRUPADOS).forEach(([key, cfg]) => {
      const count = todos.filter(v => cfg.tipos.map(t => t.toUpperCase()).includes((v.tipo || "").toUpperCase())).length;
      if (count > 0) result.push({ key, label: cfg.label, icon: cfg.icon, count, isGrupo: true });
    });

    // Tipos individuais
    TIPOS_INDIVIDUAIS.forEach(tipo => {
      const count = todos.filter(v => (v.tipo || "").toUpperCase() === tipo.toUpperCase()).length;
      if (count > 0) result.push({ key: tipo, label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), icon: TIPO_ICONE[tipo] || Wrench, count, isGrupo: false });
    });

    // Outros (não catalogados)
    const outrosCount = todos.filter(v => {
      const t = (v.tipo || "").toUpperCase();
      return !tiposNoGrupo.includes(t) && !TIPOS_INDIVIDUAIS.map(x => x.toUpperCase()).includes(t);
    }).length;
    if (outrosCount > 0) result.push({ key: "__outros", label: "Outros", icon: Wrench, count: outrosCount, isGrupo: false });

    return result;
  })();

  // Dashboard de custos
  const terceiros = todos.filter(v => v.categoria === "locado" && v.valor_mensal > 0);
  const totalMensal = terceiros.reduce((s, v) => s + (v.valor_mensal || 0), 0);
  const porTipo = Object.entries(
    terceiros.reduce<Record<string, number>>((acc, v) => {
      const t = (v.tipo || v.tipo_veiculo || "Outros");
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
            {step === "subtipo" && tipoSelLabel}
            {step === "lista" && `${subtipoSel || tipoSelLabel} — ${listaFiltrada.length} itens`}
            {step === "dashboard" && "Custos com Terceiros"}
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

            {/* Medições de Terceiros */}
            <button onClick={() => navigate("/gestao-frotas/medicoes")} className="w-full rdo-card border-l-4 border-l-violet-400 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Medições de Terceiros</p>
                <p className="text-xs text-muted-foreground">Gerar medição por frota e período</p>
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

            <p className="text-xs text-muted-foreground font-semibold px-1 pt-2">Selecione o tipo de equipamento:</p>
            {categoriasDinamicas.map(cat => {
              const Icon = cat.icon;
              return (
                <button key={cat.key} onClick={() => {
                  setTipoSel(cat.key);
                  setSubtipoSel(""); // limpa subtipo anterior
                  setBusca("");
                  if (cat.isGrupo) setStep("subtipo");
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

        {/* PASSO 2: Subtipo (apenas para grupos agrupados: Caminhões, Carretas, Vans) */}
        {step === "subtipo" && tipoSel && isGrupo && (
          <>
            <p className="text-xs text-muted-foreground font-semibold px-1">Selecione o tipo de {tipoSelLabel}:</p>
            {/* Ver todos do grupo */}
            <button onClick={() => { setSubtipoSel(""); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">📋</div>
              <div className="flex-1 text-left">
                <p className="font-display font-bold text-sm">Todos</p>
                <p className="text-xs text-muted-foreground">
                  {todos.filter(v => GRUPOS_AGRUPADOS[tipoSel].tipos.map(t => t.toUpperCase()).includes((v.tipo || "").toUpperCase())).length} equipamentos
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
            </button>
            {GRUPOS_AGRUPADOS[tipoSel].tipos.map(sub => {
              const count = todos.filter(v => (v.tipo || "").toUpperCase() === sub.toUpperCase()).length;
              if (count === 0) return null;
              const Icon = TIPO_ICONE[sub] || Truck;
              return (
                <button key={sub} onClick={() => { setSubtipoSel(sub); setStep("lista"); }} className="w-full rdo-card hover:shadow-md transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-display font-bold text-sm">{sub.charAt(0) + sub.slice(1).toLowerCase()}</p>
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
                <p className="text-lg font-display font-bold text-primary">{todos.filter(v => (v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'PROPRIO').length}</p>
                <p className="text-muted-foreground">Próprios</p>
              </div>
            </div>
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
