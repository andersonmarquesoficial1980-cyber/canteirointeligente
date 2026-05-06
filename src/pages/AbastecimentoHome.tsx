import { useState, useEffect } from "react";
import { fmtNum } from "@/lib/fmt";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Fuel, Droplets, Loader2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Abastecimento {
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
  fornecedor: string;
  lubrificado: boolean;
  lavado: boolean;
  ogs: string;
  observacao: string;
}

const FONTE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  comboio:  { label: "Comboio",  color: "bg-blue-50 text-blue-700 border-blue-200",   emoji: "🚛" },
  posto:    { label: "Posto",    color: "bg-green-50 text-green-700 border-green-200", emoji: "⛽" },
  shelbox:  { label: "Shelbox",  color: "bg-purple-50 text-purple-700 border-purple-200", emoji: "💳" },
  manual:   { label: "Manual",   color: "bg-gray-50 text-gray-600 border-gray-200",    emoji: "📝" },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function AbastecimentoHome() {
  const navigate = useNavigate();
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtroFonte, setFiltroFonte] = useState("todas");
  const [filtroFrota, setFiltroFrota] = useState("");
  const [form, setForm] = useState({
    equipment_fleet: "", equipment_type: "", data: new Date().toISOString().split("T")[0],
    hora: "", litros: "", horimetro: "", km_odometro: "",
    fonte: "posto", fornecedor: "", ogs: "", observacao: "",
    lubrificado: false, autorizado_por: "",
  });

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const { data } = await supabase
      .from("abastecimentos")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setAbastecimentos(data);
    setLoading(false);
  }

  async function salvar() {
    if (!form.equipment_fleet || !form.litros) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("abastecimentos").insert({
        equipment_fleet: form.equipment_fleet,
        equipment_type: form.equipment_type || null,
        data: form.data,
        hora: form.hora || null,
        litros: parseFloat(form.litros),
        horimetro: form.horimetro ? parseFloat(form.horimetro) : null,
        km_odometro: form.km_odometro ? parseFloat(form.km_odometro) : null,
        fonte: form.fonte,
        fornecedor: form.fornecedor || null,
        ogs: form.ogs || null,
        observacao: form.observacao || null,
        lubrificado: form.lubrificado,
        autorizado_por: form.autorizado_por || null,
        created_by: user?.id,
      });
      setModal(false);
      buscarDados();
    } catch (e: any) { console.error(e); }
    finally { setSalvando(false); }
  }

  const filtrados = abastecimentos.filter(a => {
    if (filtroFonte !== "todas" && a.fonte !== filtroFonte) return false;
    if (filtroFrota && !a.equipment_fleet.toLowerCase().includes(filtroFrota.toLowerCase())) return false;
    return true;
  });

  const totalLitros = filtrados.reduce((s, a) => s + (a.litros || 0), 0);

  // Agrupar por data
  const porData: Record<string, Abastecimento[]> = {};
  filtrados.forEach(a => {
    if (!porData[a.data]) porData[a.data] = [];
    porData[a.data].push(a);
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
        <Button size="sm" onClick={() => setModal(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
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
          <Input
            placeholder="Filtrar por frota..."
            value={filtroFrota}
            onChange={e => setFiltroFrota(e.target.value)}
            className="h-9 rounded-xl text-sm flex-1"
          />
          <Select value={filtroFonte} onValueChange={setFiltroFonte}>
            <SelectTrigger className="h-9 rounded-xl w-36 text-sm">
              <Filter className="w-3 h-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="comboio">Comboio</SelectItem>
              <SelectItem value="posto">Posto</SelectItem>
              <SelectItem value="shelbox">Shelbox</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
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
          Object.entries(porData).map(([data, items]) => (
            <div key={data}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1 mb-1">{fmtDate(data)}</p>
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
                          {a.fornecedor && <span>{a.fornecedor}</span>}
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

      {/* Modal lançamento manual */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Lançar Abastecimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Frota *</span><Input value={form.equipment_fleet} onChange={e => setForm(p => ({ ...p, equipment_fleet: e.target.value }))} placeholder="Ex: FA14" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Tipo Equip.</span><Input value={form.equipment_type} onChange={e => setForm(p => ({ ...p, equipment_type: e.target.value }))} placeholder="Fresadora" className="h-11 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Data</span><Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Hora</span><Input type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Fonte *</span>
              <Select value={form.fonte} onValueChange={v => setForm(p => ({ ...p, fonte: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="posto">⛽ Posto Conveniado</SelectItem>
                  <SelectItem value="shelbox">💳 Shelbox</SelectItem>
                  <SelectItem value="manual">📝 Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Litros *</span><Input type="number" value={form.litros} onChange={e => setForm(p => ({ ...p, litros: e.target.value }))} placeholder="0" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Horímetro/KM</span><Input type="number" value={form.horimetro} onChange={e => setForm(p => ({ ...p, horimetro: e.target.value }))} placeholder="0" className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5"><span className="rdo-label">Fornecedor</span><Input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} placeholder="Nome do posto" className="h-11 rounded-xl" /></div>
            {form.fonte === "shelbox" && (
              <div className="space-y-1.5"><span className="rdo-label">Autorizado por</span><Input value={form.autorizado_por} onChange={e => setForm(p => ({ ...p, autorizado_por: e.target.value }))} placeholder="Nome do autorizador" className="h-11 rounded-xl" /></div>
            )}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.lubrificado} onChange={e => setForm(p => ({ ...p, lubrificado: e.target.checked }))} className="w-4 h-4" />
                <span className="text-sm">Lubrificado</span>
              </label>
            </div>
            <div className="space-y-1.5"><span className="rdo-label">Observação</span><Input value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} className="h-11 rounded-xl" /></div>
            <Button onClick={salvar} disabled={salvando || !form.equipment_fleet || !form.litros} className="w-full h-11 rounded-xl font-display font-bold gap-2">
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Salvar Abastecimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
