import { useState, useEffect, useMemo } from "react";
import { fmtNum } from "@/lib/fmt";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Fuel, Loader2, Filter, Trash2, Clock, Truck, Droplets } from "lucide-react";
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
  ogsData.forEach((o: any) => {
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

  // ── Modal de lançamento ──
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // ── Dados de suporte ──
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [fornecedoresDb, setFornecedoresDb] = useState<any[]>([]);
  const [ogsData, setOgsData] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

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

    const [abast, equips, funcs, forns, ogs] = await Promise.all([
      supabase.from("abastecimentos").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("equipamentos").select("id, frota, nome, tipo").in("status", ["ativo", "Operando"]).order("frota"),
      (supabase as any).from("employees").select("id, name, role").eq("status", "ativo").order("name"),
      (supabase as any).from("fornecedores").select("nome").order("nome"),
      (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address").eq("status", "ativa").order("ogs_number"),
    ]);

    if (abast.data) setAbastecimentos(abast.data as AbastecimentoRow[]);
    if (equips.data) setEquipamentos(equips.data);
    if (funcs.data) setFuncionarios(funcs.data);
    if (forns.data) setFornecedoresDb(forns.data.map((f: any) => f.nome));
    if (ogs.data) setOgsData(ogs.data);
    setLoading(false);
  }

  const ogsOptions = useMemo(() => buildOgsOptions(ogsData), [ogsData]);
  const fornecedoresList = fornecedoresDb.length > 0 ? fornecedoresDb : ["Posto Fremix", "Shell", "Rimacris", "Petrobrás"];

  // Funcionários com função de motorista/lubrificador
  const motoristas = funcionarios.filter((f: any) =>
    f.role?.toLowerCase().includes("motorista") || f.role?.toLowerCase().includes("operador")
  );
  const lubrificadores = funcionarios.filter((f: any) =>
    f.role?.toLowerCase().includes("lubrificador") || f.role?.toLowerCase().includes("auxiliar")
  );
  // fallback: se filtro vazio, usa todos
  const listMotoristas = motoristas.length > 0 ? motoristas : funcionarios;
  const listLubrificadores = lubrificadores.length > 0 ? lubrificadores : funcionarios;

  // Frotas de comboio
  const frotasComboio = equipamentos.filter((e: any) =>
    e.frota?.toUpperCase().startsWith("CO") || e.tipo?.toLowerCase().includes("comboio")
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
    return true;
  });
  const totalLitros = filtrados.reduce((s, a) => s + (a.litros || 0), 0);
  const porData: Record<string, AbastecimentoRow[]> = {};
  filtrados.forEach(a => { if (!porData[a.data]) porData[a.data] = []; porData[a.data].push(a); });

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
        <Button size="sm" onClick={() => { resetForm(); setModal(true); }} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          <Plus className="w-4 h-4" /> Lançar
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rdo-card text-center">
            <p className="text-xl font-display font-bold text-primary">{filtrados.length}</p>
            <p className="text-[10px] text-muted-foreground">Lançamentos</p>
          </div>
          <div className="rdo-card text-center col-span-2">
            <p className="text-xl font-display font-bold text-primary">{fmtNum(totalLitros, 0)} L</p>
            <p className="text-[10px] text-muted-foreground">Total de Diesel</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 items-center">
          <Input placeholder="Filtrar por frota..." value={filtroFrota} onChange={e => setFiltroFrota(e.target.value)} className="h-9 rounded-xl text-sm flex-1" />
          <Select value={filtroFonte} onValueChange={setFiltroFonte}>
            <SelectTrigger className="h-9 rounded-xl w-36 text-sm">
              <Filter className="w-3 h-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="comboio">🚛 Comboio</SelectItem>
              <SelectItem value="posto">⛽ Posto</SelectItem>
              <SelectItem value="shelbox">💳 Shelbox</SelectItem>
              <SelectItem value="manual">📝 Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-10">
            <Fuel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum abastecimento encontrado</p>
          </div>
        ) : (
          Object.entries(porData).map(([d, items]) => (
            <div key={d}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1 mb-1">{fmtDate(d)}</p>
              {items.map(a => {
                const cfg = FONTE_CONFIG[a.fonte] || FONTE_CONFIG.manual;
                return (
                  <div key={a.id} className="rdo-card mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-display font-bold text-sm">{a.equipment_fleet}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          {a.lubrificado && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">🔧 Lubrificado</span>}
                          {a.lavado && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">🚿 Lavado</span>}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="font-bold text-primary">{fmtNum(a.litros)} L</span>
                          {a.horimetro && <span>Hor: {a.horimetro}</span>}
                          {a.km_odometro && <span>KM: {a.km_odometro}</span>}
                          {a.comboio_fleet && <span>Comboio: {a.comboio_fleet}</span>}
                          {a.motorista_comboio && <span>Mot: {a.motorista_comboio}</span>}
                          {a.ogs && <span>OGS: {a.ogs}</span>}
                          {a.hora && <span>{a.hora}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* ── MODAL DE LANÇAMENTO ── */}
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
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {listMotoristas.map((f: any) => (
                          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Lubrificador</span>
                    <Select value={lubrificador} onValueChange={setLubrificador}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {listLubrificadores.map((f: any) => (
                          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                        ))}
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
                    const meterLabel = entry.frota && isVehicleFleet(entry.frota) ? "KM" : "H";
                    return (
                      <div key={entry.id} className="bg-card rounded-2xl border border-border/60 p-4 space-y-3 relative">
                        <div className="absolute -top-2.5 left-3 bg-primary text-primary-foreground text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow">
                          #{idx + 1}
                        </div>

                        {/* Hora + Tipo */}
                        <div className="grid grid-cols-[90px_1fr] gap-2 pt-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Hora
                            </span>
                            <Input type="time" value={entry.hora} onChange={e => updateEntrada(idx, "hora", e.target.value)} className="bg-secondary border-border h-9 text-xs font-semibold" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase">Tipo de Equipamento</span>
                            <Select value={entry.tipoEquipamento} onValueChange={v => updateEntrada(idx, "tipoEquipamento", v)}>
                              <SelectTrigger className="bg-secondary border-border h-9 text-xs"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                              <SelectContent>
                                {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Frota (filtrada pelo tipo) */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase">Frota</span>
                          <Select value={entry.frota} onValueChange={v => updateEntrada(idx, "frota", v)} disabled={!entry.tipoEquipamento}>
                            <SelectTrigger className={`bg-secondary border-border h-9 text-xs ${!entry.tipoEquipamento ? "opacity-50" : ""}`}>
                              <SelectValue placeholder={entry.tipoEquipamento ? "Selecione a frota..." : "Selecione o tipo primeiro"} />
                            </SelectTrigger>
                            <SelectContent>
                              {equipsDoTipo.map((eq: any) => (
                                <SelectItem key={eq.id} value={eq.frota}>{eq.frota} — {eq.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Litros + Medição */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase">Litros *</span>
                            <Input type="number" inputMode="decimal" value={entry.litros} onChange={e => updateEntrada(idx, "litros", e.target.value)} placeholder="0" className="bg-secondary border-border h-9 text-sm font-bold" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase">Medição ({meterLabel})</span>
                            <Input type="number" inputMode="decimal" value={entry.medicao} onChange={e => updateEntrada(idx, "medicao", e.target.value)} placeholder={meterLabel === "KM" ? "Odômetro" : "Horímetro"} className="bg-secondary border-border h-9 text-sm" />
                          </div>
                        </div>

                        {/* OGS */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-display font-extrabold text-muted-foreground uppercase">OGS — Local de Trabalho</span>
                          <Select value={entry.ogs} onValueChange={v => updateEntrada(idx, "ogs", v)}>
                            <SelectTrigger className="bg-secondary border-border h-10 text-xs w-full">
                              <SelectValue placeholder="Selecione a OGS e local..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ogsOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Lubrificação + Lavagem + Remover */}
                        <div className="flex items-center gap-6 pt-1 border-t border-border/40">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={entry.lubrificado} onCheckedChange={c => updateEntrada(idx, "lubrificado", !!c)} />
                            <span className="text-xs font-bold flex items-center gap-1"><Droplets className="w-3 h-3 text-amber-500" /> Lubrificação</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={entry.lavado} onCheckedChange={c => updateEntrada(idx, "lavado", !!c)} />
                            <span className="text-xs font-bold">💦 Lavagem</span>
                          </label>
                          {entradas.length > 1 && (
                            <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-destructive text-xs" onClick={() => setEntradas(entradas.filter((_, i) => i !== idx))}>
                              <Trash2 className="w-3 h-3 mr-1" /> Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <Button type="button" size="sm" className="w-full gap-2 text-sm font-extrabold py-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md" onClick={() => setEntradas([...entradas, novaEntrada()])}>
                    <Plus className="w-4 h-4" /> Adicionar Máquina
                  </Button>
                </div>

                {/* Resumo do Tanque */}
                {saldoInicial && (
                  <div className="bg-card border-2 border-primary/30 rounded-2xl p-4">
                    <h3 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide pb-2 flex items-center gap-2 border-b border-border mb-3">
                      <Fuel className="w-4 h-4" /> RESUMO DO TANQUE
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Inicial</p>
                        <p className="text-lg font-extrabold text-primary">{Number(saldoInicial).toLocaleString("pt-BR")}</p>
                        <p className="text-[10px] text-muted-foreground">litros</p>
                      </div>
                      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Abastecido</p>
                        <p className="text-lg font-extrabold text-destructive">{totalAbastecido.toLocaleString("pt-BR")}</p>
                        <p className="text-[10px] text-muted-foreground">litros</p>
                      </div>
                      <div className={`border rounded-xl p-3 text-center ${saldoAtual < 0 ? "bg-destructive/10 border-destructive/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Atual</p>
                        <p className={`text-lg font-extrabold ${saldoAtual < 0 ? "text-destructive" : "text-emerald-600"}`}>{saldoAtual.toLocaleString("pt-BR")}</p>
                        <p className="text-[10px] text-muted-foreground">litros</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observação */}
                <div className="space-y-1.5">
                  <span className="rdo-label">Observação</span>
                  <Input value={observacao} onChange={e => setObservacao(e.target.value)} className="h-11 rounded-xl" placeholder="Opcional..." />
                </div>
              </>
            )}

            {/* ══ POSTO / SHELBOX / MANUAL ══ */}
            {fonte !== "comboio" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Tipo de Equipamento</span>
                    <Select value={simpTipoEquip} onValueChange={v => { setSimpTipoEquip(v); setSimpFrota(""); }}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Frota *</span>
                    <Select value={simpFrota} onValueChange={setSimpFrota} disabled={!simpTipoEquip}>
                      <SelectTrigger className={`h-11 rounded-xl ${!simpTipoEquip ? "opacity-50" : ""}`}>
                        <SelectValue placeholder={simpTipoEquip ? "Selecione a frota..." : "Tipo primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getEquipsByTipo(simpTipoEquip).map((eq: any) => (
                          <SelectItem key={eq.id} value={eq.frota}>{eq.frota} — {eq.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Hora</span>
                    <Input type="time" value={simpHora} onChange={e => setSimpHora(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Litros *</span>
                    <Input type="number" value={simpLitros} onChange={e => setSimpLitros(e.target.value)} placeholder="0" className="h-11 rounded-xl font-bold" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="rdo-label">OGS — Local de Trabalho</span>
                  <Select value={simpOgs} onValueChange={setSimpOgs}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a OGS..." /></SelectTrigger>
                    <SelectContent>
                      {ogsOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Horímetro/KM</span>
                    <Input type="number" value={simpMedicao} onChange={e => setSimpMedicao(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Fornecedor</span>
                    <Input value={simpFornecedor} onChange={e => setSimpFornecedor(e.target.value)} placeholder="Nome do posto" className="h-11 rounded-xl" />
                  </div>
                </div>

                {fonte === "shelbox" && (
                  <div className="space-y-1.5">
                    <span className="rdo-label">Autorizado por</span>
                    <Input value={simpAutorizadoPor} onChange={e => setSimpAutorizadoPor(e.target.value)} placeholder="Nome do autorizador" className="h-11 rounded-xl" />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={simpLubrificado} onChange={e => setSimpLubrificado(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm font-medium">Lubrificado</span>
                </label>

                <div className="space-y-1.5">
                  <span className="rdo-label">Observação</span>
                  <Input value={observacao} onChange={e => setObservacao(e.target.value)} className="h-11 rounded-xl" placeholder="Opcional..." />
                </div>
              </>
            )}

            <Button
              onClick={salvar}
              disabled={salvando || (fonte === "comboio" ? !comboioFrota || entradas.every(e => !e.frota || !e.litros) : !simpFrota || !simpLitros)}
              className="w-full h-11 rounded-xl font-display font-bold gap-2"
            >
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Salvar Abastecimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
