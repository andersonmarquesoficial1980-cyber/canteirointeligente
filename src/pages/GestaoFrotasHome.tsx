import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Car, Truck, Wrench, FileText, Search, ChevronRight, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
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
}

const TIPO_ICON: Record<string, any> = {
  veiculo_leve: Car,
  utilitario: Car,
  caminhao: Truck,
  carreta: Truck,
  maquina: Wrench,
  van: Car,
  outro: Car,
};

const TIPO_LABEL: Record<string, string> = {
  veiculo_leve: "Veículo Leve",
  utilitario: "Utilitário",
  caminhao: "Caminhão",
  carreta: "Carreta",
  maquina: "Máquina",
  van: "Van",
  outro: "Outro",
};

const SETORES = ["Manutenção", "Engenharia", "SSMA", "Diretoria", "Comercial", "Compras", "RH", "Operacional", "Outro"];
const TIPOS = ["veiculo_leve", "utilitario", "caminhao", "carreta", "maquina", "van", "outro"];

export default function GestaoFrotasHome() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    codigo_custo: "", placa: "", modelo: "", ano: "", setor: "",
    condutor_atual: "", tipo_veiculo: "veiculo_leve", categoria: "locado",
    locadora: "", frota_operacional: "", observacoes: "",
  });

  useEffect(() => { buscarVeiculos(); }, []);

  async function buscarVeiculos() {
    setLoading(true);

    // Fonte 1: veículos leves (frotas_gestao)
    const { data: veicLeves } = await supabase.from("frotas_gestao").select("*").eq("status", "ativo").order("codigo_custo");

    // Fonte 2: máquinas e caminhões (maquinas_frota) — que ainda não estão em frotas_gestao
    const { data: maquinas } = await supabase.from("maquinas_frota").select("*").order("tipo,frota");

    const frotasLevesIds = new Set((veicLeves || []).map(v => v.frota_operacional).filter(Boolean));

    // Converter maquinas para formato unificado (apenas as que não têm entrada em frotas_gestao)
    const maquinasUnificadas: Veiculo[] = (maquinas || [])
      .filter(m => !frotasLevesIds.has(m.frota))
      .map(m => ({
        id: m.id,
        codigo_custo: m.frota,
        placa: m.frota,
        modelo: m.nome || m.tipo,
        ano: "",
        setor: "",
        condutor_atual: "",
        tipo_veiculo: tipoMaquina(m.tipo),
        categoria: m.empresa === "PRÓPRIO" ? "proprio" : "locado",
        locadora: m.empresa !== "PRÓPRIO" ? m.empresa : "",
        frota_operacional: m.frota,
        status: m.status === "Operando" ? "ativo" : "inativo",
        observacoes: "",
      }));

    setVeiculos([...(veicLeves || []), ...maquinasUnificadas]);
    setLoading(false);
  }

  function tipoMaquina(tipo: string): string {
    const t = tipo?.toUpperCase() || "";
    if (t.includes("CAMINH")) return "caminhao";
    if (t.includes("CARRETA") || t.includes("CAVALO")) return "carreta";
    if (t.includes("VAN") || t.includes("MICRO")) return "van";
    if (t.includes("FRESADORA") || t.includes("BOBCAT") || t.includes("ROLO") || t.includes("VIBRO") || t.includes("USINA") || t.includes("RETRO") || t.includes("PÁ CARR") || t.includes("MOTO")) return "maquina";
    return "outro";
  }

  async function salvar() {
    if (!form.placa || !form.modelo) return;
    setSalvando(true);
    await supabase.from("frotas_gestao").insert({ ...form, status: "ativo" });
    setModal(false);
    setForm({ codigo_custo: "", placa: "", modelo: "", ano: "", setor: "", condutor_atual: "", tipo_veiculo: "veiculo_leve", categoria: "locado", locadora: "", frota_operacional: "", observacoes: "" });
    buscarVeiculos();
    setSalvando(false);
  }

  const filtrados = veiculos.filter(v => {
    const buscaOk = !busca || [v.placa, v.modelo, v.codigo_custo, v.condutor_atual, v.setor].some(f => f?.toLowerCase().includes(busca.toLowerCase()));
    const tipoOk = filtroTipo === "todos" || v.tipo_veiculo === filtroTipo;
    const setorOk = filtroSetor === "todos" || v.setor === filtroSetor;
    return buscaOk && tipoOk && setorOk;
  });

  const setores = [...new Set(veiculos.map(v => v.setor).filter(Boolean))].sort();

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Gestão de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">{veiculos.length} veículos/equipamentos</span>
        </div>
        <Button size="sm" onClick={() => setModal(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </header>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <button onClick={() => navigate("/manutencao/documentos")} className="flex items-center gap-2 p-3 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-semibold">
          <FileText className="w-4 h-4" /> Documentos & Vencimentos
        </button>
        <button onClick={() => navigate("/relatorios")} className="flex items-center gap-2 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold">
          <FileText className="w-4 h-4" /> Relatórios
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total", value: veiculos.length, color: "text-primary bg-primary/5" },
            { label: "Locados", value: veiculos.filter(v => v.categoria === "locado").length, color: "text-blue-700 bg-blue-50" },
            { label: "Próprios", value: veiculos.filter(v => v.categoria === "proprio").length, color: "text-green-700 bg-green-50" },
          ].map(i => (
            <div key={i.label} className={`rounded-xl p-2 ${i.color}`}>
              <p className="text-xl font-display font-bold">{i.value}</p>
              <p className="text-[10px] font-medium">{i.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar placa, modelo, condutor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-9 rounded-xl flex-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger className="h-9 rounded-xl flex-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground px-1">{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</p>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : (
          filtrados.map(v => {
            const Icon = TIPO_ICON[v.tipo_veiculo] || Car;
            return (
              <button key={v.id} onClick={() => navigate(`/gestao-frotas/veiculo/${v.id}`)} className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.categoria === "locado" ? "bg-blue-50" : "bg-green-50"}`}>
                  <Icon className={`w-5 h-5 ${v.categoria === "locado" ? "text-blue-600" : "text-green-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm">{v.placa}</span>
                    {v.codigo_custo && <span className="text-xs text-muted-foreground">{v.codigo_custo}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${v.categoria === "locado" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {v.categoria === "locado" ? `Locado${v.locadora ? ` · ${v.locadora}` : ""}` : "Próprio"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.modelo} {v.ano && `· ${v.ano}`}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    {v.setor && <span>🏢 {v.setor}</span>}
                    {v.condutor_atual && <span>👤 {v.condutor_atual}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {/* Modal novo veículo */}
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Novo Veículo / Equipamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Código de Custo</span><Input value={form.codigo_custo} onChange={e => setForm(p => ({ ...p, codigo_custo: e.target.value }))} placeholder="SV-011" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Placa *</span><Input value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC1D23" className="h-11 rounded-xl uppercase" /></div>
            </div>
            <div className="space-y-1.5"><span className="rdo-label">Modelo *</span><Input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} placeholder="VW/Saveiro CS" className="h-11 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Ano</span><Input value={form.ano} onChange={e => setForm(p => ({ ...p, ano: e.target.value }))} placeholder="2025" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5">
                <span className="rdo-label">Tipo</span>
                <Select value={form.tipo_veiculo} onValueChange={v => setForm(p => ({ ...p, tipo_veiculo: v }))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="rdo-label">Categoria</span>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="locado">Locado</SelectItem>
                    <SelectItem value="proprio">Próprio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.categoria === "locado" && (
                <div className="space-y-1.5"><span className="rdo-label">Locadora</span><Input value={form.locadora} onChange={e => setForm(p => ({ ...p, locadora: e.target.value }))} placeholder="Vocare" className="h-11 rounded-xl" /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="rdo-label">Setor</span>
                <Select value={form.setor} onValueChange={v => setForm(p => ({ ...p, setor: v }))}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><span className="rdo-label">Condutor</span><Input value={form.condutor_atual} onChange={e => setForm(p => ({ ...p, condutor_atual: e.target.value }))} placeholder="Nome" className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5"><span className="rdo-label">Frota Operacional (se máquina)</span><Input value={form.frota_operacional} onChange={e => setForm(p => ({ ...p, frota_operacional: e.target.value }))} placeholder="Ex: FA14, BC66" className="h-11 rounded-xl" /></div>
            <Button onClick={salvar} disabled={salvando || !form.placa || !form.modelo} className="w-full h-11 rounded-xl font-display font-bold gap-2">
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
