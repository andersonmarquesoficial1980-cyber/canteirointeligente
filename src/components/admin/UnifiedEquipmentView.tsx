// CRITICAL CORE: Visão Unificada por Equipamento — Painel de Controle
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, AlertTriangle, Fuel, Ruler } from "lucide-react";

interface DiaryRow {
  id: string;
  date: string | null;
  equipment_fleet: string | null;
  equipment_type: string | null;
  operator_name: string | null;
  ogs_number: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  fuel_liters: number | null;
}

interface ProductionArea {
  diary_id: string | null;
  m2: number | null;
  m3: number | null;
}

interface ComboioRefueling {
  equipment_fleet_fueled: string | null;
  liters_fueled: number | null;
  diary_id: string | null;
}

interface FleetRefueling {
  target_equipment_fleet: string | null;
  liters_refueled: number | null;
  diary_id: string | null;
}

// Equipment type mapping for tabs
const EQUIPMENT_TABS = [
  { key: "fresadora", label: "Fresadoras", types: ["fresadora"] },
  { key: "vibroacabadora", label: "Vibroacabadoras", types: ["vibroacabadora"] },
  { key: "rolo", label: "Rolos", types: ["rolo"] },
  { key: "bobcat", label: "Bobcats", types: ["bobcat"] },
  { key: "usina", label: "Usinas (KMA)", types: ["usina"] },
] as const;

interface ConsolidatedRow {
  diary: DiaryRow;
  totalM2: number;
  totalM3: number;
  dieselComboio: number;
  dieselFleet: number;
  dieselTotal: number;
  meterMismatch: boolean; // horimeter audit
  previousFinal: number | null;
}

export default function UnifiedEquipmentView() {
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [productions, setProductions] = useState<ProductionArea[]>([]);
  const [comboioRefuelings, setComboioRefuelings] = useState<ComboioRefueling[]>([]);
  const [fleetRefuelings, setFleetRefuelings] = useState<FleetRefueling[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("fresadora");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedDiary, setSelectedDiary] = useState<ConsolidatedRow | null>(null);

  // Load all data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [dRes, pRes, cRes, fRes] = await Promise.all([
        supabase
          .from("equipment_diaries")
          .select("id, date, equipment_fleet, equipment_type, operator_name, ogs_number, meter_initial, meter_final, fuel_liters")
          .gte("date", dateFrom)
          .lte("date", dateTo)
          .order("date", { ascending: false }),
        supabase
          .from("equipment_production_areas")
          .select("diary_id, m2, m3"),
        supabase
          .from("comboio_equipment_refueling")
          .select("equipment_fleet_fueled, liters_fueled, diary_id"),
        supabase
          .from("fleet_refueling_logs")
          .select("target_equipment_fleet, liters_refueled, diary_id"),
      ]);

      if (dRes.data) setDiaries(dRes.data);
      if (pRes.data) setProductions(pRes.data);
      if (cRes.data) setComboioRefuelings(cRes.data);
      if (fRes.data) setFleetRefuelings(fRes.data);
      setLoading(false);
    };
    load();
  }, [dateFrom, dateTo]);

  // Get diary dates for comboio lookup
  const diaryDateMap = useMemo(() => {
    const map = new Map<string, string>(); // diary_id -> date
    diaries.forEach(d => { if (d.date) map.set(d.id, d.date); });
    return map;
  }, [diaries]);

  // Build consolidated rows per tab
  const consolidatedRows = useMemo(() => {
    const tab = EQUIPMENT_TABS.find(t => t.key === activeTab);
    if (!tab) return [];

    const filtered = diaries.filter(d =>
      d.equipment_type && (tab.types as readonly string[]).includes(d.equipment_type.toLowerCase())
    );

    // Group productions by diary_id
    const prodByDiary = new Map<string, { m2: number; m3: number }>();
    productions.forEach(p => {
      if (!p.diary_id) return;
      const existing = prodByDiary.get(p.diary_id) || { m2: 0, m3: 0 };
      existing.m2 += p.m2 || 0;
      existing.m3 += p.m3 || 0;
      prodByDiary.set(p.diary_id, existing);
    });

    // Build diesel lookup: fleet + date -> total liters from comboio
    const comboioDieselMap = new Map<string, number>(); // "fleet|date" -> liters
    comboioRefuelings.forEach(c => {
      if (!c.equipment_fleet_fueled || !c.diary_id) return;
      const date = diaryDateMap.get(c.diary_id);
      if (!date) return;
      const key = `${c.equipment_fleet_fueled}|${date}`;
      comboioDieselMap.set(key, (comboioDieselMap.get(key) || 0) + (c.liters_fueled || 0));
    });

    // Fleet refueling lookup
    const fleetDieselMap = new Map<string, number>();
    fleetRefuelings.forEach(f => {
      if (!f.target_equipment_fleet || !f.diary_id) return;
      const date = diaryDateMap.get(f.diary_id);
      if (!date) return;
      const key = `${f.target_equipment_fleet}|${date}`;
      fleetDieselMap.set(key, (fleetDieselMap.get(key) || 0) + (f.liters_refueled || 0));
    });

    // Sort by fleet + date for horimeter audit
    const sorted = [...filtered].sort((a, b) => {
      const fa = a.equipment_fleet || "";
      const fb = b.equipment_fleet || "";
      if (fa !== fb) return fa.localeCompare(fb);
      return (a.date || "").localeCompare(b.date || "");
    });

    // Build rows with horimeter mismatch detection
    const rows: ConsolidatedRow[] = [];
    let prevByFleet = new Map<string, number>(); // fleet -> previous meter_final

    // First pass: collect all previous finals
    const allByFleet = new Map<string, DiaryRow[]>();
    sorted.forEach(d => {
      const fleet = d.equipment_fleet || "?";
      if (!allByFleet.has(fleet)) allByFleet.set(fleet, []);
      allByFleet.get(fleet)!.push(d);
    });

    allByFleet.forEach((fleetDiaries) => {
      fleetDiaries.forEach((d, idx) => {
        const prod = prodByDiary.get(d.id) || { m2: 0, m3: 0 };
        const fleet = d.equipment_fleet || "?";
        const dateKey = `${fleet}|${d.date}`;
        const dieselComboio = comboioDieselMap.get(dateKey) || 0;
        const dieselFleet = fleetDieselMap.get(dateKey) || 0;
        const previousFinal = idx > 0 ? fleetDiaries[idx - 1].meter_final : null;
        const meterMismatch = previousFinal !== null && d.meter_initial !== null && Math.abs(d.meter_initial - previousFinal) > 0.5;

        rows.push({
          diary: d,
          totalM2: prod.m2,
          totalM3: prod.m3,
          dieselComboio,
          dieselFleet,
          dieselTotal: dieselComboio + dieselFleet + (d.fuel_liters || 0),
          meterMismatch,
          previousFinal,
        });
      });
    });

    // Re-sort by date descending for display
    rows.sort((a, b) => (b.diary.date || "").localeCompare(a.diary.date || ""));
    return rows;
  }, [diaries, productions, comboioRefuelings, fleetRefuelings, diaryDateMap, activeTab]);

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Período de Consulta</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 bg-secondary border-border text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 bg-secondary border-border text-sm" />
          </div>
        </div>
      </div>

      {/* Equipment tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex justify-start bg-secondary/50 h-auto p-1">
          {EQUIPMENT_TABS.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs px-3 py-2 whitespace-nowrap">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {EQUIPMENT_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : consolidatedRows.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Nenhum diário encontrado para {tab.label} no período.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-bold text-primary">📊 {tab.label} — {consolidatedRows.length} registros</p>
                  {consolidatedRows.some(r => r.meterMismatch) && (
                    <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Divergências
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="text-xs font-bold">Data</TableHead>
                        <TableHead className="text-xs font-bold">Prefixo</TableHead>
                        <TableHead className="text-xs font-bold">Operador</TableHead>
                        <TableHead className="text-xs font-bold">OGS</TableHead>
                        <TableHead className="text-xs font-bold text-right">H. Inicial</TableHead>
                        <TableHead className="text-xs font-bold text-right">H. Final</TableHead>
                        <TableHead className="text-xs font-bold text-right">Prod. (m²)</TableHead>
                        <TableHead className="text-xs font-bold text-right">Prod. (m³)</TableHead>
                        <TableHead className="text-xs font-bold text-right">Diesel (L)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedRows.map((row) => (
                        <TableRow
                          key={row.diary.id}
                          onClick={() => setSelectedDiary(row)}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            row.meterMismatch ? "bg-orange-500/10 hover:bg-orange-500/20" : ""
                          }`}
                        >
                          <TableCell className="text-xs font-medium">
                            {row.diary.date ? new Date(row.diary.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-primary">{row.diary.equipment_fleet || "—"}</TableCell>
                          <TableCell className="text-xs">{row.diary.operator_name || "—"}</TableCell>
                          <TableCell className="text-xs">{row.diary.ogs_number || "—"}</TableCell>
                          <TableCell className="text-xs text-right">
                            <span className="inline-flex items-center gap-1">
                              {row.meterMismatch && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                              {row.diary.meter_initial ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right">{row.diary.meter_final ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{row.totalM2 > 0 ? row.totalM2.toFixed(1) : "—"}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{row.totalM3 > 0 ? row.totalM3.toFixed(2) : "—"}</TableCell>
                          <TableCell className="text-xs text-right">
                            <span className={`font-medium ${row.dieselTotal > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                              {row.dieselTotal > 0 ? row.dieselTotal.toFixed(0) : "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals row */}
                <div className="px-4 py-3 border-t border-border bg-secondary/30 flex flex-wrap gap-4 text-xs font-bold">
                  <span className="text-muted-foreground">Totais:</span>
                  <span className="text-foreground">
                    <Ruler className="w-3 h-3 inline mr-1" />
                    {consolidatedRows.reduce((s, r) => s + r.totalM2, 0).toFixed(1)} m²
                  </span>
                  <span className="text-foreground">
                    {consolidatedRows.reduce((s, r) => s + r.totalM3, 0).toFixed(2)} m³
                  </span>
                  <span className="text-foreground">
                    <Fuel className="w-3 h-3 inline mr-1" />
                    {consolidatedRows.reduce((s, r) => s + r.dieselTotal, 0).toFixed(0)} L
                  </span>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selectedDiary} onOpenChange={open => !open && setSelectedDiary(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📋 Detalhes — {selectedDiary?.diary.equipment_fleet}
              {selectedDiary?.meterMismatch && (
                <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500 gap-1">
                  <AlertTriangle className="w-3 h-3" /> Horímetro Divergente
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedDiary && (
            <div className="space-y-4">
              {/* General info */}
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-primary uppercase">Informações Gerais</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Data:</span> <strong>{selectedDiary.diary.date ? new Date(selectedDiary.diary.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</strong></div>
                  <div><span className="text-muted-foreground">Prefixo:</span> <strong>{selectedDiary.diary.equipment_fleet}</strong></div>
                  <div><span className="text-muted-foreground">Operador:</span> <strong>{selectedDiary.diary.operator_name || "—"}</strong></div>
                  <div><span className="text-muted-foreground">OGS:</span> <strong>{selectedDiary.diary.ogs_number || "—"}</strong></div>
                </div>
              </div>

              {/* Horimeter */}
              <div className={`rounded-lg p-3 space-y-2 ${selectedDiary.meterMismatch ? "bg-orange-500/10 border border-orange-500/30" : "bg-secondary/50"}`}>
                <p className="text-xs font-bold text-primary uppercase">Horímetro</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Inicial:</span> <strong>{selectedDiary.diary.meter_initial ?? "—"}</strong></div>
                  <div><span className="text-muted-foreground">Final:</span> <strong>{selectedDiary.diary.meter_final ?? "—"}</strong></div>
                </div>
                {selectedDiary.meterMismatch && selectedDiary.previousFinal !== null && (
                  <p className="text-xs text-orange-600 font-medium mt-1">
                    ⚠️ Final anterior: {selectedDiary.previousFinal} → Inicial atual: {selectedDiary.diary.meter_initial}
                    (diferença de {Math.abs((selectedDiary.diary.meter_initial || 0) - selectedDiary.previousFinal).toFixed(1)}h)
                  </p>
                )}
              </div>

              {/* Production */}
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-primary uppercase">Produção</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Área:</span> <strong>{selectedDiary.totalM2.toFixed(1)} m²</strong></div>
                  <div><span className="text-muted-foreground">Volume:</span> <strong>{selectedDiary.totalM3.toFixed(2)} m³</strong></div>
                </div>
              </div>

              {/* Diesel */}
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-primary uppercase flex items-center gap-1"><Fuel className="w-3.5 h-3.5" /> Abastecimento</p>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Comboio:</span> <strong>{selectedDiary.dieselComboio > 0 ? `${selectedDiary.dieselComboio.toFixed(0)} L` : "—"}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Abastecimento Frota:</span> <strong>{selectedDiary.dieselFleet > 0 ? `${selectedDiary.dieselFleet.toFixed(0)} L` : "—"}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lançado pelo Operador:</span> <strong>{selectedDiary.diary.fuel_liters ? `${selectedDiary.diary.fuel_liters} L` : "—"}</strong></div>
                  <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold">Total:</span> <strong className="text-primary">{selectedDiary.dieselTotal.toFixed(0)} L</strong></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
