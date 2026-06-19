import { useState, useEffect, useMemo } from "react";
import { fmtNum } from "@/lib/fmt";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Fuel, Loader2, Filter, Trash2, Clock, Truck, Droplets, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

// ── Tipos de equipamento com prefixos de frota ──
const EQUIPMENT_TYPE_OPTIONS = [
  { value: "Fresadora",        label: "Fresadora",          prefixes: ["FA"] },
  { value: "Vibroacabadora",   label: "Vibroacabadora",     prefixes: ["VA"] },
  { value: "Bobcat",           label: "Bobcat",             prefixes: ["BC"] },
  { value: "Rolo Chapa/Liso",  label: "Rolo Chapa/Liso",   prefixes: ["CH", "RD"] },
  { value: "Rolo Pneu",        label: "Rolo Pneu",          prefixes: ["PN"] },
  { value: "Rolo Pé de Carneiro", label: "Rolo Pé de Carneiro", prefixes: ["PC"] },
  { value: "Usina Móvel",      label: "Usina Móvel",        prefixes: ["KMA"] },
  { value: "Caminhão",         label: "Caminhão",           prefixes: ["CA", "CM", "CC", "CP", "CE", "CB"] },
  { value: "Apoio/Outros",     label: "Apoio/Outros",       prefixes: [] },
] as const;

const VEHICLE_PREFIXES = ["CM", "CC", "CP", "CE", "CB", "VT", "MCO"];
function isVehicleFleet(frota: string) {
  return VEHICLE_PREFIXES.some(p => frota.toUpperCase().startsWith(p));
}

interface EntradaAbastecimento {
  id: string;
  hora: string;
  tipoEquipamento: string;
  frota: string;
  medicao: string;
  litros: string;
  ogs: string;
  lubrificado: boolean;
  lavado: boolean;
}

function novaEntrada(): EntradaAbastecimento {
  return {
    id: crypto.randomUUID(),
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    tipoEquipamento: "",
    frota: "",
    medicao: "",
    litros: "",
    ogs: "",
    lubrificado: false,
    lavado: false,
  };
}

interface AbastecimentoRow {
  id: string;
  equipment_fleet: string;
  equipment_type: string;
  data: string;
  hora: string;
  litros: number;
  horimetro: number;
  km_odometro: number;
  fonte: string;
  comboio_fleet: string;
  motorista_comboio: string;
  lubrificador: string;
  fornecedor: string;
  lubrificado: boolean;
  lavado: boolean;
  ogs: string;
  observacao: string;
  saldo_inicial: number;
}

const FONTE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  comboio: { label: "Comboio",  color: "bg-blue-50 text-blue-700 border-blue-200",   emoji: "🚛" },
  posto:   { label: "Posto",    color: "bg-green-50 text-green-700 border-green-200", emoji: "⛽" },
  shelbox: { label: "Shelbox",  color: "bg-purple-50 text-purple-700 border-purple-200", emoji: "💳" },
  manual:  { label: "Manual",   color: "bg-gray-50 text-gray-600 border-gray-200",    emoji: "📝" },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function buildOgsOptions(ogsData: any[]) {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  // 000 primeiro, resto decrescente
  const sorted = [...ogsData].sort((a, b) => {
    if (a.ogs_number === "000") return -1;
    if (b.ogs_number === "000") return 1;
    return parseInt(b.ogs_number) - parseInt(a.ogs_number);
  });
  sorted.forEach((o: any) => {
    if (!o.ogs_number) return;
    const addrs = o.location_address
      ? o.location_address.split(";").map((s: string) => s.trim()).filter(Boolean)
      : [];
    if (addrs.length === 0) {
      const key = o.ogs_number;
      if (!seen.has(key)) { seen.add(key); options.push({ value: o.ogs_number, label: `${o.ogs_number} — ${o.client_name || ""}` }); }
    } else {
      addrs.forEach((addr: string) => {
        const key = `${o.ogs_number}|${addr}`;
        if (!seen.has(key)) { seen.add(key); options.push({ value: `${o.ogs_number} | ${addr}`, label: `${o.ogs_number} — ${o.client_name || ""} — ${addr}` }); }
      });
    }
  });
  return options;
}

export default function AbastecimentoHome() {
  const navigate = useNavigate();

  // ── Dados da tela principal ──
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFonte, setFiltroFonte] = useState("todas");
  const [filtroFrota, setFiltroFrota] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroTipoEquipamento, setFiltroTipoEquipamento] = useState("");
  const [filtroOgs, setFiltroOgs] = useState("");

  // ── Modal de lançamento ──
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // ── Dados de suporte ──
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [ogsData, setOgsData] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<string[]>([]);
  const [lubrificadores, setLubrificadores] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [abastConfig, setAbastConfig] = useState<{ motoristas: string[]; lubrificadores: string[]; fornecedores_diesel: string[] }>({ motoristas: [], lubrificadores: [], fornecedores_diesel: [] });

  // ── Estado do formulário de lançamento ──
  const [fonte, setFonte] = useState<"comboio" | "posto" | "shelbox" | "manual">("comboio");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [motoristaComboio, setMotoristaComboio] = useState("");
  const [lubrificador, setLubrificador] = useState("");
  const [comboioFrota, setComboioFrota] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [entradas, setEntradas] = useState<EntradaAbastecimento[]>([novaEntrada()]);

  // Para posto/shelbox/manual — lançamento simples
  const [simpFrota, setSimpFrota] = useState("");
  const [simpTipoEquip, setSimpTipoEquip] = useState("");
  const [simpHora, setSimpHora] = useState("");
  const [simpLitros, setSimpLitros] = useState("");
  const [simpMedicao, setSimpMedicao] = useState("");
  const [simpOgs, setSimpOgs] = useState("");
  const [simpFornecedor, setSimpFornecedor] = useState("");
  const [simpLubrificado, setSimpLubrificado] = useState(false);
  const [simpAutorizadoPor, setSimpAutorizadoPor] = useState("");

  useEffect(() => { buscarTudo(); }, []);

  async function buscarTudo() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
    const cid = (profile as any)?.company_id || null;
    setCompanyId(cid);

    const [abast, equips, ogsRes, cfgRes, opComboio, opLubri] = await Promise.all([
      supabase.from("abastecimentos").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("equipamentos").select("id, frota, nome, tipo").in("status", ["ativo", "Operando"]).order("frota"),
      (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address"),
      (supabase as any).from("abastecimento_config").select("*").eq("company_id", cid).maybeSingle(),
      // Habilitados para Comboio e Lubrificador (join manual via funcionario_id)
      (supabase as any).from("equipment_type_operators").select("funcionario_id").eq("equipment_type", "Comboio").eq("company_id", cid),
      (supabase as any).from("equipment_type_operators").select("funcionario_id").eq("equipment_type", "Lubrificador").eq("company_id", cid),
    ]);

    if (abast.data) setAbastecimentos(abast.data as AbastecimentoRow[]);
    if (equips.data) setEquipamentos(equips.data);
    if (ogsRes.data) setOgsData(ogsRes.data);
    if (cfgRes.data) setAbastConfig(cfgRes.data);

    // Buscar nomes dos funcionários habilitados
    const idsComboio = (opComboio.data || []).map((r: any) => r.funcionario_id).filter(Boolean);
    const idsLubri = (opLubri.data || []).map((r: any) => r.funcionario_id).filter(Boolean);

    if (idsComboio.length > 0) {
      const { data: nomes } = await (supabase as any).from("employees").select("name").in("id", idsComboio).order("name");
      if (nomes) setMotoristas(nomes.map((r: any) => r.name).filter(Boolean));
    }
    if (idsLubri.length > 0) {
      const { data: nomes } = await (supabase as any).from("employees").select("name").in("id", idsLubri).order("name");
      if (nomes) setLubrificadores(nomes.map((r: any) => r.name).filter(Boolean));
    }
    setLoading(false);
  }

  const ogsOptions = useMemo(() => buildOgsOptions(ogsData), [ogsData]);
  const fornecedoresList = abastConfig.fornecedores_diesel.length > 0 ? abastConfig.fornecedores_diesel : ["Posto Fremix", "Shell", "Rimacris", "Petrobrás"];
  const listMotoristas = motoristas;
  const listLubrificadores = lubrificadores;

  // Frotas de comboio — filtrar pelo tipo
  const frotasComboio = equipamentos.filter((e: any) =>
    e.tipo?.toLowerCase().includes("comboio")
  );

  function getEquipsByTipo(tipo: string) {
    const opt = EQUIPMENT_TYPE_OPTIONS.find(o => o.value === tipo);
    if (!opt) return [];
    if (opt.prefixes.length === 0) return equipamentos;
    return equipamentos.filter((eq: any) => opt.prefixes.some(p => eq.frota?.toUpperCase().startsWith(p)));
  }

  const totalAbastecido = useMemo(
    () => entradas.reduce((s, e) => s + (Number(e.litros) || 0), 0),
    [entradas]
  );
  const saldoAtual = (Number(saldoInicial) || 0) - totalAbastecido;

  function resetForm() {
    setFonte("comboio");
    setData(new Date().toISOString().split("T")[0]);
    setMotoristaComboio(""); setLubrificador(""); setComboioFrota("");
    // auto-select se só um comboio
    if (frotasComboio.length === 1) setComboioFrota(frotasComboio[0].frota);
    setSaldoInicial(""); setFornecedor(""); setObservacao("");
    setEntradas([novaEntrada()]);
    setSimpFrota(""); setSimpTipoEquip(""); setSimpHora(""); setSimpLitros("");
    setSimpMedicao(""); setSimpOgs(""); setSimpFornecedor("");
    setSimpLubrificado(false); setSimpAutorizadoPor("");
  }

  function updateEntrada(idx: number, field: keyof EntradaAbastecimento, value: any) {
    const updated = [...entradas];
    if (field === "tipoEquipamento") {
      updated[idx] = { ...updated[idx], tipoEquipamento: value, frota: "" };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setEntradas(updated);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const base = { data, created_by: user?.id, company_id: companyId, fonte };

      if (fonte === "comboio") {
        // Salva uma linha por entrada de abastecimento
        const rows = entradas
          .filter(e => e.frota && e.litros)
          .map(e => ({
            ...base,
            hora: e.hora || null,
            equipment_fleet: e.frota,
            equipment_type: e.tipoEquipamento || null,
            litros: parseFloat(String(e.litros).replace(",", ".")),
            horimetro: !isVehicleFleet(e.frota) && e.medicao ? parseFloat(String(e.medicao).replace(",", ".")) : null,
            km_odometro: isVehicleFleet(e.frota) && e.medicao ? parseFloat(String(e.medicao).replace(",", ".")) : null,
            ogs: e.ogs || null,
            lubrificado: e.lubrificado,
            lavado: e.lavado,
            comboio_fleet: comboioFrota || null,
            motorista_comboio: motoristaComboio || null,
            lubrificador: lubrificador || null,
            fornecedor: fornecedor || null,
            saldo_inicial: saldoInicial ? parseFloat(String(saldoInicial).replace(",", ".")) : null,
            observacao: observacao || null,
          }));
        if (rows.length > 0) await supabase.from("abastecimentos").insert(rows);
      } else {
        if (!simpFrota || !simpLitros) return;
        await supabase.from("abastecimentos").insert({
          ...base,
          hora: simpHora || null,
          equipment_fleet: simpFrota,
          equipment_type: simpTipoEquip || null,
          litros: parseFloat(String(simpLitros).replace(",", ".")),
          horimetro: simpMedicao ? parseFloat(String(simpMedicao).replace(",", ".")) : null,
          ogs: simpOgs || null,
          fornecedor: simpFornecedor || null,
          lubrificado: simpLubrificado,
          autorizado_por: fonte === "shelbox" ? (simpAutorizadoPor || null) : null,
          observacao: observacao || null,
        });
      }
      setModal(false);
      resetForm();
      buscarTudo();
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  }

  const filtrados = abastecimentos.filter(a => {
    if (filtroFonte !== "todas" && a.fonte !== filtroFonte) return false;
    if (filtroFrota && !a.equipment_fleet?.toLowerCase().includes(filtroFrota.toLowerCase())) return false;
    if (filtroDataInicio && a.data < filtroDataInicio) return false;
    if (filtroDataFim && a.data > filtroDataFim) return false;
    if (filtroTipoEquipamento && filtroTipoEquipamento !== "__todos__" && a.equipment_type !== filtroTipoEquipamento) return false;
    if (filtroOgs && !a.ogs?.toLowerCase().includes(filtroOgs.toLowerCase())) return false;
    return true;
  });
  
  const totalLitros = filtrados.reduce((s, a) => s + (a.litros || 0), 0);
  
  // Agrupar por equipamento_frota para o accordion
  const porEquipamento: Record<string, AbastecimentoRow[]> = {};
  filtrados.forEach(a => {
    const key = a.equipment_fleet || "Sem Frota";
    if (!porEquipamento[key]) porEquipamento[key] = [];
    porEquipamento[key].push(a);
  });

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Abastecimento</span>
          <span className="block text-[11px] text-primary-foreground/80">Comboio, Posto e Shelbox</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        
        {/* ── BOTÃO GRANDE "+ LANÇAR" ── */}
        <button
          onClick={() => { resetForm(); setModal(true); }}
          className="w-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all border border-primary/50"
        >
          <div className="flex items-center justify-center gap-3">
            <Plus className="w-8 h-8" />
            <span className="font-display font-bold text-lg">+ Lançar Abastecimento</span>
          </div>
        </button>

        {/* ── FILTROS: Data, Frota, Tipo, OGS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Data Inicial</label>
            <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Data Final</label>
            <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Frota</label>
            <Input placeholder="Ex: FA14" value={filtroFrota} onChange={e => setFiltroFrota(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
            <Select value={filtroTipoEquipamento} onValueChange={setFiltroTipoEquipamento}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Segunda LINHA de filtros ── */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">OGS</label>
          <Input placeholder="Filtrar por OGS..." value={filtroOgs} onChange={e => setFiltroOgs(e.target.value)} className="h-10 rounded-xl text-sm" />
        </div>

        {/* ── LISTA COM ACORDEÃO ── */}
        {loading ? (
          <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Fuel className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum abastecimento encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(porEquipamento).map(([equipment, items]) => (
              <Collapsible key={equipment} defaultOpen={false}>
                <CollapsibleTrigger className="w-full rdo-card p-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors text-left">
                  <div className="flex items-center gap-3 flex-1">
                    <Truck className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-display font-bold text-base">{equipment}</p>
                      <p className="text-xs text-muted-foreground">{items.length} lançamentos</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {items.map(a => {
                    const cfg = FONTE_CONFIG[a.fonte] || FONTE_CONFIG.manual;
                    return (
                      <div key={a.id} className="rdo-card p-3 ml-2 border-l-4 border-primary/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                                {cfg.emoji} {cfg.label}
                              </span>
                              {a.lubrificado && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">🔧 Lubr.</span>}
                              {a.lavado && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">🚿 Lav.</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <span><Clock className="w-3 h-3 inline mr-1" />{fmtDate(a.data)} {a.hora}</span>
                              <span className="font-bold text-primary"><Droplets className="w-3 h-3 inline mr-1" />{fmtNum(a.litros)} L</span>
                              {a.horimetro && <span>Hor: {a.horimetro}</span>}
                              {a.km_odometro && <span>KM: {a.km_odometro}</span>}
                              {a.comboio_fleet && <span>Comboio: {a.comboio_fleet}</span>}
                              {a.motorista_comboio && <span>Mot: {a.motorista_comboio}</span>}
                              {a.ogs && <span>OGS: {a.ogs}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Espaço pra rodapé */}
        <div className="h-24" />
      </div>

      {/* ── RODAPÉ STICKY COM RESUMO ── */}
      {filtrados.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-primary/20 shadow-lg p-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-2">
              <div className="rdo-card text-center">
                <p className="text-lg font-display font-bold text-primary">{filtrados.length}</p>
                <p className="text-xs text-muted-foreground">Lançamentos</p>
              </div>
              <div className="rdo-card text-center">
                <p className="text-lg font-display font-bold text-primary">{fmtNum(totalLitros, 0)}</p>
                <p className="text-xs text-muted-foreground">L Total</p>
              </div>
              <div className="rdo-card text-center">
                <p className="text-lg font-display font-bold text-primary">{fmtNum(totalLitros / filtrados.length, 1)}</p>
                <p className="text-xs text-muted-foreground">L Médio</p>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* ── MODAL DE LANÇAMENTO (idêntico ao original) ── */}
      <Dialog open={modal} onOpenChange={v => { if (!v) resetForm(); setModal(v); }}>
        <DialogContent className="max-w-lg mx-2 rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Lançar Abastecimento</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Fonte */}
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Lançamento *</span>
              <div className="grid grid-cols-2 gap-2">
                {(["comboio", "posto", "shelbox", "manual"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFonte(f)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${fonte === f ? "bg-primary text-white border-primary" : "bg-secondary border-border text-foreground hover:border-primary/50"}`}
                  >
                    {FONTE_CONFIG[f].emoji} {FONTE_CONFIG[f].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <span className="rdo-label">Data *</span>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-11 rounded-xl" />
            </div>

            {/* ══ COMBOIO ══ */}
            {fonte === "comboio" && (
              <>
                {/* Frota do Comboio */}
                <div className="space-y-1.5">
                  <span className="rdo-label">Frota do Comboio *</span>
                  <Select value={comboioFrota} onValueChange={setComboioFrota}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o comboio..." /></SelectTrigger>
                    <SelectContent>
                      {frotasComboio.map((e: any) => (
                        <SelectItem key={e.id} value={e.frota}>{e.frota} — {e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Motorista + Lubrificador */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Motorista do Comboio</span>
                    <Select value={motoristaComboio} onValueChange={setMotoristaComboio}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={listMotoristas.length === 0 ? "Configure no Painel" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        {listMotoristas.map((nome: string) => (
                          <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                        ))}
                        {listMotoristas.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre em Painel → WF Abastecimento</div>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Lubrificador</span>
                    <Select value={lubrificador} onValueChange={setLubrificador}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={listLubrificadores.length === 0 ? "Configure no Painel" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        {listLubrificadores.map((nome: string) => (
                          <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                        ))}
                        {listLubrificadores.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre em Painel → WF Abastecimento</div>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Saldo Inicial + Fornecedor da Carga */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border pb-2">
                    <Fuel className="w-4 h-4" /> CONTROLE DE CARGA
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="rdo-label">Saldo Inicial (Litros)</span>
                      <Input type="number" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} placeholder="0" className="h-11 rounded-xl font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="rdo-label">Fornecedor da Carga</span>
                      <Select value={fornecedor} onValueChange={setFornecedor}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {fornecedoresList.map((f: string) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Abastecimentos de Frota */}
                <div className="space-y-3">
                  <h3 className="text-sm font-display font-extrabold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> ABASTECIMENTO DE FROTA
                  </h3>

                  {entradas.map((entry, idx) => {
                    const equipsDoTipo = getEquipsByTipo(entry.tipoEquipamento);
                    return (
                      <div key={entry.id} className="bg-card border border-border rounded-2xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={entry.tipoEquipamento} onValueChange={v => updateEntrada(idx, "tipoEquipamento", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Tipo *" /></SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={entry.frota} onValueChange={v => updateEntrada(idx, "frota", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Frota *" /></SelectTrigger>
                            <SelectContent>
                              {equipsDoTipo.map((e: any) => (
                                <SelectItem key={e.id} value={e.frota}>{e.frota}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="time" value={entry.hora} onChange={e => updateEntrada(idx, "hora", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="Hora" />
                          <Input type="number" value={entry.litros} onChange={e => updateEntrada(idx, "litros", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="Litros" />
                          <Input type="number" value={entry.medicao} onChange={e => updateEntrada(idx, "medicao", e.target.value)} className="h-9 rounded-lg text-xs" placeholder="Medição" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={entry.ogs} onValueChange={v => updateEntrada(idx, "ogs", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="OGS" /></SelectTrigger>
                            <SelectContent>
                              {ogsOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={entry.lubrificado} onCheckedChange={v => updateEntrada(idx, "lubrificado", v)} />
                            <label className="text-xs">Lubrificado</label>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={entry.lavado} onCheckedChange={v => updateEntrada(idx, "lavado", v)} />
                          <label className="text-xs">Lavado</label>
                        </div>
                        {entradas.length > 1 && (
                          <button onClick={() => setEntradas(entradas.filter((_, i) => i !== idx))} className="text-xs text-red-600 hover:underline">
                            Remover
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <Button variant="outline" onClick={() => setEntradas([...entradas, novaEntrada()])} className="w-full h-9 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar Entrada
                  </Button>
                </div>
              </>
            )}

            {/* ══ POSTO / SHELBOX / MANUAL ══ */}
            {fonte !== "comboio" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Frota *</span>
                    <Select value={simpFrota} onValueChange={setSimpFrota}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {equipamentos.map((e: any) => (
                          <SelectItem key={e.id} value={e.frota}>{e.frota}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Tipo</span>
                    <Select value={simpTipoEquip} onValueChange={setSimpTipoEquip}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" value={simpHora} onChange={e => setSimpHora(e.target.value)} className="h-11 rounded-xl" placeholder="Hora" />
                  <Input type="number" value={simpLitros} onChange={e => setSimpLitros(e.target.value)} className="h-11 rounded-xl" placeholder="Litros *" />
                </div>
                <Input type="number" value={simpMedicao} onChange={e => setSimpMedicao(e.target.value)} className="h-11 rounded-xl" placeholder="Medição (Hor/KM)" />
                <Select value={simpOgs} onValueChange={setSimpOgs}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="OGS" /></SelectTrigger>
                  <SelectContent>
                    {ogsOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={simpFornecedor} onValueChange={setSimpFornecedor}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                  <SelectContent>
                    {fornecedoresList.map((f: string) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox checked={simpLubrificado} onCheckedChange={v => setSimpLubrificado(v === true)} />
                  <label className="text-sm">Lubrificado</label>
                </div>
                {fonte === "shelbox" && (
                  <Input value={simpAutorizadoPor} onChange={e => setSimpAutorizadoPor(e.target.value)} className="h-11 rounded-xl" placeholder="Autorizado Por" />
                )}
              </>
            )}

            {/* Observação */}
            <div className="space-y-1.5">
              <span className="rdo-label">Observação</span>
              <Input value={observacao} onChange={e => setObservacao(e.target.value)} className="h-11 rounded-xl" placeholder="Adicione observações..." />
            </div>

            <Button onClick={salvar} disabled={salvando} className="w-full h-11 gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {salvando ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
