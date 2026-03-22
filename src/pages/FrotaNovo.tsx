import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Truck, Search, Cog, FileText, Warehouse, Wrench, Activity, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const TIPOS = ["Pavimentação", "Compactação", "Fresagem", "Transporte", "Usina", "Apoio", "Outros"];
const STATUS_OPTIONS = [
  { value: "ativo", label: "Operando", color: "text-success" },
  { value: "parado", label: "Parado", color: "text-muted-foreground" },
  { value: "manutencao", label: "Manutenção", color: "text-accent" },
];

const BASE_VALUE = "BASE";

// 4-status fleet derivation
type FleetStatus = "em_obra" | "transporte" | "disponivel" | "manutencao";

interface FleetStatusInfo {
  label: string;
  color: string; // HSL for chart
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  icon: typeof Truck;
}

const FLEET_STATUS_MAP: Record<FleetStatus, FleetStatusInfo> = {
  em_obra:     { label: "Em Obra",     color: "hsl(142 70% 45%)", badgeVariant: "default",     icon: Activity },
  transporte:  { label: "Transporte",  color: "hsl(45 90% 50%)",  badgeVariant: "outline",     icon: Truck },
  disponivel:  { label: "Disponível",  color: "hsl(215 80% 55%)", badgeVariant: "secondary",   icon: Warehouse },
  manutencao:  { label: "Manutenção",  color: "hsl(0 70% 50%)",   badgeVariant: "destructive", icon: Wrench },
};

function deriveFleetStatus(
  equipStatus: string,
  lastEntry?: { destination?: string; returnReason?: string; activity?: string }
): FleetStatus {
  // If DB status is manutencao, honor it
  if (equipStatus === "manutencao") return "manutencao";

  if (!lastEntry) {
    return equipStatus === "ativo" ? "em_obra" : "disponivel";
  }

  const dest = (lastEntry.destination || "").toUpperCase();
  const isBase = dest.includes("BASE");

  if (isBase) {
    const reason = (lastEntry.returnReason || "").toLowerCase();
    if (reason.includes("manutenção") || reason.includes("manutencao") || reason.includes("oficina")) {
      return "manutencao";
    }
    return "disponivel";
  }

  const activity = (lastEntry.activity || "").toLowerCase();
  if (activity.includes("transporte") || activity.includes("deslocamento")) {
    return "transporte";
  }

  return "em_obra";
}

function statusBadge(fs: FleetStatus) {
  const info = FLEET_STATUS_MAP[fs];
  return (
    <Badge variant={info.badgeVariant} className="text-xs gap-1">
      <info.icon className="w-3 h-3" />
      {info.label}
    </Badge>
  );
}

export default function FrotaNovo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [frota, setFrota] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [status, setStatus] = useState("ativo");

  // Fetch all equipment
  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ["maquinas_frota_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota" as any)
        .select("*")
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch latest time entries per diary to derive fleet status
  const { data: latestEntries = [] } = useQuery({
    queryKey: ["latest_fleet_entries"],
    queryFn: async () => {
      // Get recent diaries with their last time entry
      const { data: diaries, error: dErr } = await supabase
        .from("equipment_diaries")
        .select("id, equipment_fleet, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (dErr || !diaries?.length) return [];

      const diaryIds = diaries.map((d: any) => d.id);
      const { data: entries, error: eErr } = await supabase
        .from("equipment_time_entries")
        .select("diary_id, activity, destination, description")
        .in("diary_id", diaryIds);
      if (eErr) return [];

      // Build map: fleet -> latest entry info
      const fleetMap: Record<string, { destination: string; returnReason: string; activity: string; createdAt: string }> = {};
      for (const d of diaries as any[]) {
        const fleet = d.equipment_fleet;
        if (!fleet || fleetMap[fleet]) continue;
        const dEntries = (entries as any[]).filter((e: any) => e.diary_id === d.id);
        if (dEntries.length > 0) {
          const last = dEntries[dEntries.length - 1];
          // returnReason is stored in description field for transport entries
          fleetMap[fleet] = {
            destination: last.destination || "",
            returnReason: last.description || "",
            activity: last.activity || "",
            createdAt: d.created_at,
          };
        }
      }
      return Object.entries(fleetMap).map(([fleet, info]) => ({ fleet, ...info }));
    },
  });

  // Build status map for each equipment
  const statusMap = useMemo(() => {
    const map: Record<string, FleetStatus> = {};
    const entryByFleet: Record<string, any> = {};
    for (const e of latestEntries) {
      entryByFleet[e.fleet] = e;
    }
    for (const eq of equipamentos) {
      const lastEntry = entryByFleet[eq.frota];
      map[eq.id] = deriveFleetStatus(eq.status, lastEntry);
    }
    return map;
  }, [equipamentos, latestEntries]);

  // Counts
  const counts = useMemo(() => {
    const c: Record<FleetStatus, number> = { em_obra: 0, transporte: 0, disponivel: 0, manutencao: 0 };
    Object.values(statusMap).forEach((s) => { c[s]++; });
    return c;
  }, [statusMap]);

  const total = equipamentos.length;
  const availability = total > 0 ? Math.round(((counts.em_obra + counts.disponivel) / total) * 100) : 0;

  const chartData = [
    { name: "Em Obra", value: counts.em_obra, color: FLEET_STATUS_MAP.em_obra.color },
    { name: "Transporte", value: counts.transporte, color: FLEET_STATUS_MAP.transporte.color },
    { name: "Disponível", value: counts.disponivel, color: FLEET_STATUS_MAP.disponivel.color },
    { name: "Manutenção", value: counts.manutencao, color: FLEET_STATUS_MAP.manutencao.color },
  ].filter((d) => d.value > 0);

  const filtered = equipamentos.filter((eq: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      eq.nome?.toLowerCase().includes(s) ||
      eq.frota?.toLowerCase().includes(s) ||
      eq.tipo?.toLowerCase().includes(s) ||
      eq.empresa?.toLowerCase().includes(s)
    );
  });

  const resetForm = () => { setNome(""); setFrota(""); setTipo(""); setEmpresa(""); setStatus("ativo"); };

  const handleSave = async () => {
    if (!nome.trim() || !frota.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e o prefixo/frota.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("maquinas_frota" as any)
        .insert({ nome: nome.trim(), frota: frota.trim(), tipo: tipo || null, status, empresa: empresa.trim() || null } as any);
      if (error) throw error;
      toast({ title: "✅ Equipamento cadastrado!", description: `"${nome}" adicionado com sucesso.` });
      resetForm();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["maquinas_frota_all"] });
      queryClient.invalidateQueries({ queryKey: ["maquinas_frota"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-extrabold text-[hsl(215_80%_22%)] flex items-center gap-2">
            <Cog className="w-6 h-6 text-primary" />
            Gestão de Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro e controle da frota</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 font-semibold" onClick={() => navigate("/equipamentos/diario")}>
              <FileText className="w-4 h-4" /> Novo Diário
            </Button>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold">
                <Plus className="w-4 h-4" /> Novo Equipamento
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> Cadastrar Equipamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Fresadora Wirtgen W200" className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Prefixo / Frota *</Label>
                  <Input value={frota} onChange={(e) => setFrota(e.target.value)} placeholder="FR-001" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Empresa</Label>
                  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa" className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full font-bold mt-2">
                {saving ? "Salvando..." : "Salvar Equipamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard: Donut + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Donut Chart */}
        <Card className="border-border bg-white shadow-sm">
          <CardContent className="p-4 flex flex-col items-center">
            <div className="w-[160px] h-[160px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [`${v} equip.`, name]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-display font-extrabold text-[hsl(215_80%_22%)]">{availability}%</span>
                <span className="text-[10px] text-muted-foreground font-semibold">Disponível</span>
              </div>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[11px]">
              {Object.entries(FLEET_STATUS_MAP).map(([key, info]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                  <span className="text-muted-foreground">{info.label}</span>
                  <span className="font-bold text-foreground">{counts[key as FleetStatus]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "em_obra" as FleetStatus, label: "Em Obra", icon: Activity },
            { key: "transporte" as FleetStatus, label: "Transporte", icon: Truck },
            { key: "disponivel" as FleetStatus, label: "Disponível na Base", icon: Warehouse },
            { key: "manutencao" as FleetStatus, label: "Manutenção", icon: Wrench },
          ]).map((kpi) => (
            <Card key={kpi.key} className="border-border bg-white shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: FLEET_STATUS_MAP[kpi.key].color + "22" }}>
                  <kpi.icon className="w-5 h-5" style={{ color: FLEET_STATUS_MAP[kpi.key].color }} />
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold text-[hsl(215_80%_22%)]">{counts[kpi.key]}</p>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, frota, tipo..."
          className="pl-9 bg-secondary border-border"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando equipamentos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {search ? "Nenhum equipamento encontrado." : "Nenhum equipamento cadastrado ainda."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((eq: any) => {
            const fs = statusMap[eq.id] || "em_obra";
            return (
              <Card key={eq.id} className="border-border bg-white hover:border-primary/30 transition-colors shadow-sm">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[hsl(215_80%_22%)] truncate">{eq.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Frota: <span className="text-foreground font-medium">{eq.frota}</span>
                      {eq.tipo && <> · {eq.tipo}</>}
                      {eq.empresa && <> · {eq.empresa}</>}
                    </p>
                  </div>
                  {statusBadge(fs)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
