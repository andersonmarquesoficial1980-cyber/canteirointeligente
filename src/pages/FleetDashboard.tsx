import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Warehouse, Wrench, Activity, AlertTriangle,
  Gauge, ArrowLeft, ChevronRight, X,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

// ── Status types ──────────────────────────────────────────────
type FleetStatus = "em_obra" | "transporte" | "disponivel" | "manutencao";

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  icon: typeof Truck;
}

const STATUS: Record<FleetStatus, StatusMeta> = {
  em_obra:    { label: "Produzindo",        color: "hsl(142 70% 45%)", bg: "hsl(142 70% 45% / 0.12)", icon: Activity },
  transporte: { label: "Em Trânsito",       color: "hsl(45 90% 50%)",  bg: "hsl(45 90% 50% / 0.12)",  icon: Truck },
  disponivel: { label: "Disponível (Base)", color: "hsl(215 80% 55%)", bg: "hsl(215 80% 55% / 0.12)", icon: Warehouse },
  manutencao: { label: "Manutenção",        color: "hsl(0 70% 50%)",   bg: "hsl(0 70% 50% / 0.12)",   icon: Wrench },
};

// ── Active shape for donut hover ─────────────────────────────
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.9} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} className="text-sm font-bold">{value}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(215 20% 50%)" className="text-[10px]">{payload.name}</text>
    </g>
  );
};

// ══════════════════════════════════════════════════════════════
export default function FleetDashboard() {
  const navigate = useNavigate();
  const [activeSlice, setActiveSlice] = useState<FleetStatus | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);

  // ── Data fetching ────────────────────────────────────────────
  const { data: equipamentos = [] } = useQuery({
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

  // Use the v_frota_status_atual view for real-time status
  const { data: viewData = [] } = useQuery({
    queryKey: ["v_frota_status_atual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_frota_status_atual" as any)
        .select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Map view status_cor to FleetStatus ──────────────────────
  function mapStatusCor(cor: string): FleetStatus {
    const c = (cor || "").toLowerCase();
    if (c.includes("produzindo") || c.includes("obra")) return "em_obra";
    if (c.includes("trânsito") || c.includes("transporte") || c.includes("transito")) return "transporte";
    if (c.includes("disponível") || c.includes("disponivel") || c.includes("base")) return "disponivel";
    if (c.includes("manutenção") || c.includes("manutencao")) return "manutencao";
    return "em_obra";
  }

  // ── Compute statuses from view ─────────────────────────────
  const { statusMap, entryByFleet } = useMemo(() => {
    const sMap: Record<string, FleetStatus> = {};
    const eMap: Record<string, { destination: string; returnReason: string; activity: string }> = {};

    // Index view data by fleet
    const viewByFleet: Record<string, any> = {};
    for (const v of viewData) {
      viewByFleet[v.equipment_fleet] = v;
    }

    for (const eq of equipamentos) {
      const vRow = viewByFleet[eq.frota];
      if (vRow) {
        sMap[eq.id] = mapStatusCor(vRow.status_cor);
        eMap[eq.frota] = {
          destination: vRow.destination || "",
          returnReason: vRow.description || "",
          activity: vRow.activity || "",
        };
      } else {
        // Fallback: use DB status
        sMap[eq.id] = eq.status === "manutencao" ? "manutencao" : eq.status === "ativo" ? "em_obra" : "disponivel";
      }
    }
    return { statusMap: sMap, entryByFleet: eMap };
  }, [equipamentos, viewData]);

  const counts = useMemo(() => {
    const c: Record<FleetStatus, number> = { em_obra: 0, transporte: 0, disponivel: 0, manutencao: 0 };
    Object.values(statusMap).forEach((s) => c[s]++);
    return c;
  }, [statusMap]);

  const total = equipamentos.length;
  const availability = total > 0 ? Math.round(((counts.em_obra + counts.disponivel) / total) * 100) : 0;

  const chartData = [
    { name: "Em Obra", value: counts.em_obra, color: STATUS.em_obra.color, key: "em_obra" as FleetStatus },
    { name: "Transporte", value: counts.transporte, color: STATUS.transporte.color, key: "transporte" as FleetStatus },
    { name: "Disponível", value: counts.disponivel, color: STATUS.disponivel.color, key: "disponivel" as FleetStatus },
    { name: "Manutenção", value: counts.manutencao, color: STATUS.manutencao.color, key: "manutencao" as FleetStatus },
  ].filter((d) => d.value > 0);

  // ── Filtered list by active slice ───────────────────────────
  const filteredEquipments = useMemo(() => {
    if (!activeSlice) return [];
    return equipamentos.filter((eq: any) => statusMap[eq.id] === activeSlice);
  }, [activeSlice, equipamentos, statusMap]);

  const handleSliceClick = (_: any, index: number) => {
    const slice = chartData[index];
    if (slice) setActiveSlice(activeSlice === slice.key ? null : slice.key);
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/equipamentos/frota")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-extrabold text-[hsl(215_80%_22%)]">
                Dashboard — Status da Frota
              </h1>
              <p className="text-sm text-muted-foreground">Visão em tempo real dos equipamentos</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold gap-1">
            <Gauge className="w-3 h-3" /> {total} equipamentos
          </Badge>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* ── Top row: Donut + KPIs ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Donut Card */}
          <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl">
            <CardContent className="p-6 flex flex-col items-center">
              <h2 className="text-sm font-display font-extrabold text-[hsl(215_80%_22%)] mb-4 self-start">
                Status da Frota em Tempo Real
              </h2>
              <div className="w-[260px] h-[260px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      dataKey="value"
                      stroke="none"
                      activeIndex={hoverIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, i) => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(undefined)}
                      onClick={handleSliceClick}
                      style={{ cursor: "pointer" }}
                    >
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          opacity={activeSlice && activeSlice !== entry.key ? 0.3 : 1}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center KPI */}
                {hoverIndex === undefined && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-display font-extrabold text-[hsl(215_80%_22%)]">{availability}%</span>
                    <span className="text-xs text-muted-foreground font-semibold mt-0.5">Disponibilidade</span>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full">
                {Object.entries(STATUS).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSlice(activeSlice === key ? null : key as FleetStatus)}
                    className={`flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-all ${activeSlice === key ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                    <span className="text-xs font-extrabold text-[hsl(215_80%_22%)] ml-auto">
                      {counts[key as FleetStatus]}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 content-start">
            {/* Availability KPI */}
            <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl col-span-2">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(142 70% 45% / 0.15), hsl(215 80% 55% / 0.15))" }}>
                  <Gauge className="w-7 h-7 text-[hsl(215_80%_55%)]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-semibold">Taxa de Disponibilidade</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-display font-extrabold text-[hsl(215_80%_22%)]">{availability}%</span>
                    <span className="text-xs text-muted-foreground">(Em Obra + Disponível) / Total</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2.5 rounded-full bg-muted mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${availability}%`,
                        background: `linear-gradient(90deg, hsl(142 70% 45%), hsl(215 80% 55%))`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alert KPI */}
            <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: STATUS.manutencao.bg }}>
                  <AlertTriangle className="w-6 h-6" style={{ color: STATUS.manutencao.color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Alerta de Oficina</p>
                  <p className="text-3xl font-display font-extrabold text-[hsl(0_70%_50%)]">{counts.manutencao}</p>
                </div>
              </CardContent>
            </Card>

            {/* 4 mini status cards */}
            {(["em_obra", "transporte", "disponivel", "manutencao"] as FleetStatus[]).map((key) => {
              const meta = STATUS[key];
              const Icon = meta.icon;
              return (
                <Card
                  key={key}
                  onClick={() => setActiveSlice(activeSlice === key ? null : key)}
                  className={`bg-white border-border shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md ${activeSlice === key ? 'ring-2 ring-offset-1' : ''}`}
                  style={{ ...(activeSlice === key ? { borderColor: meta.color, '--tw-ring-color': meta.color } as any : {}) }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: meta.bg }}>
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-extrabold text-[hsl(215_80%_22%)]">{counts[key]}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">{meta.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── Drill-down list ─────────────────────────────────── */}
        {activeSlice && (
          <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS[activeSlice].color }} />
                  <h3 className="text-sm font-display font-extrabold text-[hsl(215_80%_22%)]">
                    {STATUS[activeSlice].label} — {filteredEquipments.length} equipamento(s)
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setActiveSlice(null)} className="h-7 w-7">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {filteredEquipments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum equipamento neste status.</p>
              ) : (
                <div className="space-y-2">
                  {filteredEquipments.map((eq: any) => {
                    const entry = entryByFleet[eq.frota];
                    const reason = entry?.returnReason || "";
                    const showReason = activeSlice === "manutencao" && reason;
                    return (
                      <div
                        key={eq.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: STATUS[activeSlice].bg }}>
                          {(() => { const Icon = STATUS[activeSlice].icon; return <Icon className="w-4 h-4" style={{ color: STATUS[activeSlice].color }} />; })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[hsl(215_80%_22%)] truncate">{eq.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Frota: <span className="font-medium text-foreground">{eq.frota}</span>
                            {eq.tipo && <> · {eq.tipo}</>}
                          </p>
                          {showReason && (
                            <p className="text-xs mt-1 text-[hsl(0_70%_50%)] font-medium flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              {reason}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
