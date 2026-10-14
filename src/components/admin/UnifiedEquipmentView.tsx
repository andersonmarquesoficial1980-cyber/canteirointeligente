// CRITICAL CORE: Visão Unificada por Equipamento — Painel de Controle
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { DEFAULT_COMPANY_ID } from "@/config/company";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarIcon, AlertTriangle, Fuel, Ruler, Download } from "lucide-react";
import * as XLSX from "xlsx";

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
  id: string;
  equipment_fleet: string | null;
  data: string | null;
  litros: number | null;
}

// Equipment type mapping for tabs
const EQUIPMENT_TABS = [
  { key: "fresadora", label: "Fresadoras", types: ["fresadora"] },
  { key: "vibroacabadora", label: "Vibroacabadoras", types: ["vibroacabadora", "vibro acabadora"] },
  { key: "rolo", label: "Rolos", types: ["rolo"] },
  { key: "bobcat", label: "Bobcats", types: ["bobcat"] },
  { key: "usina", label: "Usinas (KMA)", types: ["usina"] },
] as const;

interface ConsolidatedRow {
  diary: DiaryRow;
  totalM2: number;
  totalM3: number;
  dieselComboio: number;
  dieselReported: number; // informado no diário; pode repetir o lançamento do comboio
  meterMismatch: boolean; // horimeter audit
  previousFinal: number | null;
}

export default function UnifiedEquipmentView() {
  const { profile, loading: profileLoading } = useUserProfile();
  const companyId = profile?.company_id || (profile?.email?.toLowerCase() === "andersonmarquesoficial1980@gmail.com" ? DEFAULT_COMPANY_ID : null);
  const [diaries, setDiaries] = useState<DiaryRow[]>([]);
  const [productions, setProductions] = useState<ProductionArea[]>([]);
  const [comboioRefuelings, setComboioRefuelings] = useState<ComboioRefueling[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("fresadora");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedDiary, setSelectedDiary] = useState<ConsolidatedRow | null>(null);

  // Fontes isoladas por empresa, período e páginas estáveis (o PostgREST trunca respostas grandes).
  useEffect(() => {
    if (profileLoading) return;
    if (!companyId) {
      setLoadError("Empresa não identificada para consultar os equipamentos.");
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setSelectedDiary(null);
      try {
        const pageSize = 500;
        const diaryRows: DiaryRow[] = [];
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.from("equipment_diaries")
            .select("id, date, equipment_fleet, equipment_type, operator_name, ogs_number, meter_initial, meter_final, fuel_liters")
            .eq("company_id", companyId).gte("date", dateFrom).lte("date", dateTo)
            .order("date", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
          if (error) throw error;
          diaryRows.push(...(data ?? []));
          if ((data?.length ?? 0) < pageSize) break;
        }
        const fuelRows: ComboioRefueling[] = [];
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.from("abastecimentos")
            .select("id, equipment_fleet, data, litros")
            .eq("company_id", companyId).eq("fonte", "comboio")
            .gte("data", dateFrom).lte("data", dateTo)
            .order("data", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
          if (error) throw error;
          fuelRows.push(...(data ?? []));
          if ((data?.length ?? 0) < pageSize) break;
        }
        const productionRows: ProductionArea[] = [];
        for (let index = 0; index < diaryRows.length; index += 100) {
          const ids = diaryRows.slice(index, index + 100).map((row) => row.id);
          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase.from("equipment_production_areas")
              .select("diary_id, m2, m3").eq("company_id", companyId).in("diary_id", ids)
              .order("id").range(offset, offset + pageSize - 1);
            if (error) throw error;
            productionRows.push(...(data ?? []));
            if ((data?.length ?? 0) < pageSize) break;
          }
        }
        if (active) {
          setDiaries(diaryRows);
          setComboioRefuelings(fuelRows);
          setProductions(productionRows);
        }
      } catch (error) {
        console.error("Falha ao carregar visão unificada", error);
        if (active) setLoadError("Não foi possível carregar o período completo. Atualize a página e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [companyId, profileLoading, dateFrom, dateTo]);

  // Build consolidated rows per tab
  const consolidatedRows = useMemo(() => {
    const tab = EQUIPMENT_TABS.find(t => t.key === activeTab);
    if (!tab) return [];

    const filtered = diaries.filter(d => {
      const normalizedType = d.equipment_type?.toLowerCase().trim() || "";
      return tab.types.some(type => normalizedType.includes(type));
    });

    // Group productions by diary_id
    const prodByDiary = new Map<string, { m2: number; m3: number }>();
    productions.forEach(p => {
      if (!p.diary_id) return;
      const existing = prodByDiary.get(p.diary_id) || { m2: 0, m3: 0 };
      existing.m2 += p.m2 || 0;
      existing.m3 += p.m3 || 0;
      prodByDiary.set(p.diary_id, existing);
    });

    // O abastecimento guarda a frota abastecida e a data, não o ID do diário do equipamento.
    const comboioDieselMap = new Map<string, number>();
    comboioRefuelings.forEach(c => {
      if (!c.equipment_fleet || !c.data) return;
      const key = `${c.equipment_fleet}|${c.data}`;
      comboioDieselMap.set(key, (comboioDieselMap.get(key) || 0) + (c.litros || 0));
    });

    // A antiga fonte "fleet_refueling_logs" não existe no banco vinculado.
    // Não apresentar um valor numérico para a frota sem fonte de dados válida.

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
        const previousFinal = idx > 0 ? fleetDiaries[idx - 1].meter_final : null;
        const meterMismatch = previousFinal !== null && d.meter_initial !== null && Math.abs(d.meter_initial - previousFinal) > 0.5;

        rows.push({
          diary: d,
          totalM2: prod.m2,
          totalM3: prod.m3,
          dieselComboio,
          dieselReported: d.fuel_liters || 0,
          meterMismatch,
          previousFinal,
        });
      });
    });

    // Re-sort by date descending for display
    rows.sort((a, b) => (b.diary.date || "").localeCompare(a.diary.date || ""));
    return rows;
  }, [diaries, productions, comboioRefuelings, activeTab]);

  const comboioTotal = useMemo(() => {
    const byDay = new Map<string, number>();
    consolidatedRows.forEach((r) => {
      if (r.diary.equipment_fleet && r.diary.date) {
        byDay.set(`${r.diary.equipment_fleet}|${r.diary.date}`, r.dieselComboio);
      }
    });
    return Array.from(byDay.values()).reduce((sum, liters) => sum + liters, 0);
  }, [consolidatedRows]);

  const exportToExcel = useCallback(() => {
    const tab = EQUIPMENT_TABS.find(t => t.key === activeTab);
    if (!tab || consolidatedRows.length === 0) return;

    // Mantém a coluna legada do diário; o Comboio vai em coluna separada, uma vez por frota/dia.
    // Nunca somar fontes potencialmente repetidas num único número de exportação.
    const exportedDays = new Set<string>();
    const rows = consolidatedRows.map(r => {
      const key = `${r.diary.equipment_fleet}|${r.diary.date}`;
      const firstOfDay = !exportedDays.has(key);
      exportedDays.add(key);
      return {
        DATA: r.diary.date ? new Date(r.diary.date + "T12:00:00").toLocaleDateString("pt-BR") : "",
        PREFIXO: r.diary.equipment_fleet || "",
        OPERADOR: r.diary.operator_name || "",
        OGS: r.diary.ogs_number || "",
        HORIMETRO_INICIAL: r.diary.meter_initial ?? "",
        HORIMETRO_FINAL: r.diary.meter_final ?? "",
        PRODUCAO_M2: r.totalM2 > 0 ? Number(r.totalM2.toFixed(1)) : 0,
        COMBUSTIVEL_L: r.dieselReported > 0 ? Number(r.dieselReported.toFixed(0)) : 0,
        COMBOIO_L_DIA: firstOfDay && r.dieselComboio > 0 ? Number(r.dieselComboio.toFixed(1)) : "",
        CONCILIACAO: r.dieselComboio > 0 && r.dieselReported > 0 ? "A conferir: pode ser o mesmo abastecimento" : "Fontes separadas",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 12 }, // DATA
      { wch: 10 }, // PREFIXO
      { wch: 22 }, // OPERADOR
      { wch: 8 },  // OGS
      { wch: 18 }, // HORIMETRO_INICIAL
      { wch: 16 }, // HORIMETRO_FINAL
      { wch: 14 }, // PRODUCAO_M2
      { wch: 16 }, // COMBUSTIVEL_L (diário)
      { wch: 18 }, // COMBOIO_L_DIA
      { wch: 46 }, // CONCILIACAO
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.label);
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Export_Totvs_${tab.label}_${today}.xlsx`);
  }, [consolidatedRows, activeTab]);

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
            {loading || profileLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : loadError ? (
              <div role="alert" className="flex items-center justify-center py-12">
                <p className="text-sm text-destructive">{loadError}</p>
              </div>
            ) : consolidatedRows.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Nenhum diário encontrado para {tab.label} no período.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-bold text-primary">📊 {tab.label} — {consolidatedRows.length} registros</p>
                  <div className="flex items-center gap-2">
                    {consolidatedRows.some(r => r.meterMismatch) && (
                      <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-500 gap-1">
                        <AlertTriangle className="w-3 h-3" /> Divergências
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={exportToExcel} className="h-8 text-xs gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Exportar Totvs (Excel)
                    </Button>
                  </div>
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
                        <TableHead className="text-xs font-bold text-right">Diário (L)</TableHead>
                        <TableHead className="text-xs font-bold text-right">Comboio no dia (L)</TableHead>
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
                            <span className={`font-medium ${row.dieselReported > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                              {row.dieselReported > 0 ? row.dieselReported.toFixed(1) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {row.dieselComboio > 0 ? row.dieselComboio.toFixed(1) : "—"}
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
                    Diário: {consolidatedRows.reduce((s, r) => s + r.dieselReported, 0).toFixed(1)} L
                  </span>
                  <span className="text-foreground">Comboio: {comboioTotal.toFixed(1)} L</span>
                  <span className="text-muted-foreground font-normal">Fontes separadas; não somar sem conciliar.</span>
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
            <DialogDescription className="sr-only">
              Dados do diário {selectedDiary?.diary.equipment_fleet}, com abastecimento do Comboio e litros informados no diário em separado.
            </DialogDescription>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Comboio no dia:</span> <strong>{selectedDiary.dieselComboio > 0 ? `${selectedDiary.dieselComboio.toFixed(1)} L` : "—"}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Informado no Diário:</span> <strong>{selectedDiary.dieselReported > 0 ? `${selectedDiary.dieselReported.toFixed(1)} L` : "—"}</strong></div>
                  {selectedDiary.dieselComboio > 0 && selectedDiary.dieselReported > 0 && (
                    <p className="text-xs text-amber-700 border-t border-border pt-2 mt-2">A conciliar: o diário pode repetir o abastecimento do Comboio ou ser adicional. Não somamos os dois automaticamente.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
