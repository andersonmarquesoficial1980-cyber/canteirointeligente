import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

type Diario = {
  id: string;
  date: string | null;
  operator_name: string | null;
  operator_solo: string | null;
  equipment_type: string | null;
  equipment_fleet: string | null;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  work_status: string | null;
  period: string | null;
  fresagem_type: string | null;
  fuel_type: string | null;
  fuel_liters: number | null;
  fuel_meter: number | null;
  observations: string | null;
  created_at: string | null;
  status: string | null;
  user_id?: string | null;
  created_by?: string | null;
};

type TimeEntry = {
  id: string;
  diary_id: string | null;
  start_time: string | null;
  end_time: string | null;
  activity: string | null;
  description: string | null;
  origin: string | null;
  destination: string | null;
};

type ProductionArea = {
  id: string;
  diary_id: string | null;
  length_m: number | null;
  width_m: number | null;
  thickness_cm: number | null;
  m2: number | null;
  m3: number | null;
};

type BitEntry = {
  id: string;
  diary_id: string;
  quantity: number;
  brand: string;
  horimeter: string | null;
  status: string;
};

const MONTHS = [
  { v: "01", l: "Janeiro" },
  { v: "02", l: "Fevereiro" },
  { v: "03", l: "Março" },
  { v: "04", l: "Abril" },
  { v: "05", l: "Maio" },
  { v: "06", l: "Junho" },
  { v: "07", l: "Julho" },
  { v: "08", l: "Agosto" },
  { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" },
  { v: "11", l: "Novembro" },
  { v: "12", l: "Dezembro" },
];

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function fmtDateTime(d?: string | null) {
  if (!d) return "-";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleString("pt-BR");
}

function toNum(v?: number | null) {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

function getMonthRange(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    ini: `${year}-${month}-01`,
    fim: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function getHoras(diario: Diario) {
  const meterIni = diario.meter_initial;
  const meterFim = diario.meter_final;
  if (typeof meterIni === "number" && typeof meterFim === "number" && meterFim >= meterIni) {
    return meterFim - meterIni;
  }

  const odoIni = diario.odometer_initial;
  const odoFim = diario.odometer_final;
  if (typeof odoIni === "number" && typeof odoFim === "number" && odoFim >= odoIni) {
    return odoFim - odoIni;
  }

  return 0;
}

function getMarcador(diario: Diario) {
  const hasMeter = typeof diario.meter_initial === "number" || typeof diario.meter_final === "number";
  if (hasMeter) {
    return {
      label: "Horímetro",
      ini: diario.meter_initial,
      fim: diario.meter_final,
    };
  }

  return {
    label: "Odômetro",
    ini: diario.odometer_initial,
    fim: diario.odometer_final,
  };
}

export default function RelatorioEquipamento() {
  const navigate = useNavigate();
  const { fleet, frota } = useParams<{ fleet?: string; frota?: string }>();
  const fleetParam = (frota || fleet || "").trim();
  const [searchParams] = useSearchParams();

  const now = new Date();
  const monthNow = String(now.getMonth() + 1).padStart(2, "0");
  const yearNow = String(now.getFullYear());

  const urlIni = searchParams.get("ini");
  const urlMes = searchParams.get("mes") || (urlIni ? urlIni.split("-")[1] : null);
  const urlAno = searchParams.get("ano") || (urlIni ? urlIni.split("-")[0] : null);

  const [mes, setMes] = useState(urlMes || monthNow);
  const [ano, setAno] = useState(urlAno || yearNow);
  const [loading, setLoading] = useState(false);
  const [diarios, setDiarios] = useState<Diario[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [areasMap, setAreasMap] = useState<Record<string, { m2: number; m3: number }>>({});
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);
  const [timeEntriesMap, setTimeEntriesMap] = useState<Record<string, TimeEntry[]>>({});
  const [areasDetailMap, setAreasDetailMap] = useState<Record<string, ProductionArea[]>>({});
  const [bitsMap, setBitsMap] = useState<Record<string, BitEntry[]>>({});

  const fetchPeriodo = useCallback(async () => {
    if (!fleetParam) return;
    setLoading(true);

    const { ini, fim } = getMonthRange(ano, mes);

    const { data: diariosRows, error: diariosError } = await supabase
      .from("equipment_diaries")
      .select("*")
      .ilike("equipment_fleet", fleetParam)
      .gte("date", ini)
      .lte("date", fim)
      .order("date", { ascending: false });

    if (diariosError) {
      console.error("Erro ao buscar diários:", diariosError);
      setDiarios([]);
      setAreasMap({});
      setProfilesMap({});
      setTimeEntriesMap({});
      setAreasDetailMap({});
      setBitsMap({});
      setSelectedDiaryId(null);
      setLoading(false);
      return;
    }

    const rows = (diariosRows || []) as Diario[];
    setDiarios(rows);

    if (rows.length === 0) {
      setAreasMap({});
      setProfilesMap({});
      setTimeEntriesMap({});
      setAreasDetailMap({});
      setBitsMap({});
      setSelectedDiaryId(null);
      setLoading(false);
      return;
    }

    const diaryIds = rows.map((d) => d.id);
    const userIds = Array.from(new Set(rows.map((d) => d.user_id).filter(Boolean))) as string[];

    const [areasRes, profilesRes] = await Promise.all([
      supabase
        .from("equipment_production_areas")
        .select("diary_id,m2,m3")
        .in("diary_id", diaryIds),
      userIds.length > 0
        ? supabase.from("profiles").select("user_id,nome_completo").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (areasRes.error) {
      console.error("Erro ao buscar áreas:", areasRes.error);
    }

    if (profilesRes.error) {
      console.error("Erro ao buscar perfis:", profilesRes.error);
    }

    const groupedAreas: Record<string, { m2: number; m3: number }> = {};
    (areasRes.data || []).forEach((a: any) => {
      if (!a?.diary_id) return;
      if (!groupedAreas[a.diary_id]) groupedAreas[a.diary_id] = { m2: 0, m3: 0 };
      groupedAreas[a.diary_id].m2 += toNum(a.m2);
      groupedAreas[a.diary_id].m3 += toNum(a.m3);
    });

    const profileByUser: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => {
      if (p?.user_id) profileByUser[p.user_id] = p.nome_completo || "-";
    });

    setAreasMap(groupedAreas);
    setProfilesMap(profileByUser);

    setSelectedDiaryId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id || null;
    });

    setLoading(false);
  }, [ano, fleetParam, mes]);

  const loadDiaryDetails = useCallback(async (diaryId: string) => {
    const hasTimes = Boolean(timeEntriesMap[diaryId]);
    const hasAreas = Boolean(areasDetailMap[diaryId]);
    const hasBits = Boolean(bitsMap[diaryId]);
    if (hasTimes && hasAreas && hasBits) return;

    const [timeRes, prodRes, bitsRes] = await Promise.all([
      supabase
        .from("equipment_time_entries")
        .select("id,diary_id,start_time,end_time,activity,description,origin,destination")
        .eq("diary_id", diaryId)
        .order("start_time", { ascending: true }),
      supabase
        .from("equipment_production_areas")
        .select("id,diary_id,length_m,width_m,thickness_cm,m2,m3")
        .eq("diary_id", diaryId),
      supabase
        .from("bit_entries")
        .select("id,diary_id,quantity,brand,horimeter,status")
        .eq("diary_id", diaryId),
    ]);

    if (timeRes.error) console.error("Erro ao buscar apontamentos:", timeRes.error);
    if (prodRes.error) console.error("Erro ao buscar áreas de produção:", prodRes.error);
    if (bitsRes.error) console.error("Erro ao buscar bits:", bitsRes.error);

    setTimeEntriesMap((prev) => ({
      ...prev,
      [diaryId]: (timeRes.data || []) as TimeEntry[],
    }));
    setAreasDetailMap((prev) => ({
      ...prev,
      [diaryId]: (prodRes.data || []) as ProductionArea[],
    }));
    setBitsMap((prev) => ({
      ...prev,
      [diaryId]: (bitsRes.data || []) as BitEntry[],
    }));
  }, [areasDetailMap, bitsMap, timeEntriesMap]);

  useEffect(() => {
    fetchPeriodo();
  }, [fetchPeriodo]);

  useEffect(() => {
    if (selectedDiaryId) {
      loadDiaryDetails(selectedDiaryId);
    }
  }, [loadDiaryDetails, selectedDiaryId]);

  const selectedDiary = useMemo(() => diarios.find((d) => d.id === selectedDiaryId) || null, [diarios, selectedDiaryId]);
  const selectedTimeEntries = selectedDiaryId ? (timeEntriesMap[selectedDiaryId] || []) : [];
  const selectedAreas = selectedDiaryId ? (areasDetailMap[selectedDiaryId] || []) : [];
  const selectedBits = selectedDiaryId ? (bitsMap[selectedDiaryId] || []) : [];

  const mesLabel = MONTHS.find((m) => m.v === mes)?.l || mes;

  function onChangeMes(novoMes: string) {
    setMes(novoMes);
    navigate(`/relatorio-equipamento/${encodeURIComponent(fleetParam)}?mes=${novoMes}&ano=${ano}`, { replace: true });
  }

  function onChangeAno(novoAno: string) {
    setAno(novoAno);
    navigate(`/relatorio-equipamento/${encodeURIComponent(fleetParam)}?mes=${mes}&ano=${novoAno}`, { replace: true });
  }

  function abrirDetalhe(diaryId: string) {
    setSelectedDiaryId((prev) => (prev === diaryId ? null : diaryId));
    if (selectedDiaryId !== diaryId) {
      loadDiaryDetails(diaryId);
    }
  }

  function fmtNum(val: any): string {
    if (val === null || val === undefined || val === "") return "-";
    return String(val).replace(".", ",");
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new();

    const rows = [
      ["Data", "Frota", "Operador", "Auxiliar", "OGS", "Status", "Hor. Inicial", "Hor. Final", "Horas", "Área m²", "Diesel (L)", "Lançado por"],
      ...diarios.map((d) => {
        const marcador = getMarcador(d);
        const lancadoPor = (d.user_id && profilesMap[d.user_id]) || d.created_by || "-";
        return [
          fmtDate(d.date),
          d.equipment_fleet || "-",
          d.operator_name || "-",
          d.operator_solo || "-",
          d.ogs_number || "-",
          d.work_status || d.status || "-",
          fmtNum(marcador.ini),
          fmtNum(marcador.fim),
          fmtNum(getHoras(d).toFixed(2)),
          fmtNum((areasMap[d.id]?.m2 || 0).toFixed(2)),
          fmtNum(toNum(d.fuel_liters).toFixed(2)),
          lancadoPor,
        ];
      }),
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Relatório");
    XLSX.writeFile(wb, `Relatorio_Equipamento_${fleetParam}_${mes}-${ano}.xlsx`);
  }

  function imprimirPDF() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)] print:bg-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg print:hidden">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório de Equipamento</span>
          <span className="block text-[11px] text-primary-foreground/80">{fleetParam} • {mesLabel}/{ano}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={exportarExcel} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" onClick={imprimirPDF} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
            <Printer className="w-4 h-4" /> PDF
          </Button>
        </div>
      </header>

      <div className="px-4 py-3 flex gap-2 print:hidden">
        <Select value={mes} onValueChange={onChangeMes}>
          <SelectTrigger className="h-9 rounded-xl w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ano} onValueChange={onChangeAno}>
          <SelectTrigger className="h-9 rounded-xl w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-primary self-center" />}
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-8 space-y-4 print:px-8 print:pt-4">
        <section className="rdo-card">
          <h3 className="font-display font-bold text-sm mb-3">Relatório por Período</h3>
          {diarios.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum diário encontrado para a frota no mês selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Data</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Frota</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Operador</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Auxiliar</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">OGS</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Hor. Inicial</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Hor. Final</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Área m²</th>
                    <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Diesel (L)</th>
                    <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Lançado por</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {diarios.map((d) => {
                    const marcador = getMarcador(d);
                    const lancadoPor = (d.user_id && profilesMap[d.user_id]) || d.created_by || "-";
                    const aberto = selectedDiaryId === d.id;

                    return (
                      <tr
                        key={d.id}
                        className={`border-b border-border/50 hover:bg-muted/40 cursor-pointer ${aberto ? "bg-muted/40" : ""}`}
                        onClick={() => abrirDetalhe(d.id)}
                      >
                        <td className="py-2 pr-3">{fmtDate(d.date)}</td>
                        <td className="py-2 pr-3 font-medium">{d.equipment_fleet || "-"}</td>
                        <td className="py-2 pr-3">{d.operator_name || "-"}</td>
                        <td className="py-2 pr-3">{d.operator_solo || "-"}</td>
                        <td className="py-2 pr-3">{d.ogs_number || "-"}</td>
                        <td className="py-2 pr-3">{d.work_status || d.status || "-"}</td>
                        <td className="py-2 pr-3 text-right">{marcador.ini ?? "-"}</td>
                        <td className="py-2 pr-3 text-right">{marcador.fim ?? "-"}</td>
                        <td className="py-2 pr-3 text-right font-medium">{getHoras(d).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right">{(areasMap[d.id]?.m2 || 0).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right">{toNum(d.fuel_liters).toFixed(2)}</td>
                        <td className="py-2 pr-3">{lancadoPor}</td>
                        <td className="py-2 text-right">{aberto ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedDiary && (
          <section className="rdo-card space-y-4">
            <h3 className="font-display font-bold text-sm">Detalhe do Diário • {fmtDate(selectedDiary.date)}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <p><strong>Frota:</strong> {selectedDiary.equipment_fleet || "-"}</p>
              <p><strong>Tipo de Equipamento:</strong> {selectedDiary.equipment_type || "-"}</p>
              <p><strong>Data:</strong> {fmtDate(selectedDiary.date)}</p>
              <p><strong>Turno:</strong> {selectedDiary.period || "-"}</p>
              <p><strong>Operador:</strong> {selectedDiary.operator_name || "-"}</p>
              <p><strong>Auxiliar/Solo:</strong> {selectedDiary.operator_solo || "-"}</p>
              <p><strong>OGS:</strong> {selectedDiary.ogs_number || "-"}</p>
              <p><strong>Cliente:</strong> {selectedDiary.client_name || "-"}</p>
              <p className="md:col-span-2"><strong>Local/Endereço:</strong> {selectedDiary.location_address || "-"}</p>
              <p>
                <strong>{getMarcador(selectedDiary).label} Inicial:</strong> {getMarcador(selectedDiary).ini ?? "-"} <strong>→ Final:</strong> {getMarcador(selectedDiary).fim ?? "-"}
              </p>
              <p><strong>Status:</strong> {selectedDiary.work_status || selectedDiary.status || "-"}</p>
              <p className="md:col-span-2"><strong>Observações:</strong> {selectedDiary.observations || "-"}</p>
              <p className="md:col-span-2 rounded-lg bg-muted/40 p-2">
                <strong>Lançado por:</strong> {(selectedDiary.user_id && profilesMap[selectedDiary.user_id]) || selectedDiary.created_by || "-"} em {fmtDateTime(selectedDiary.created_at)}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Apontamento de Horas</h4>
              {selectedTimeEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum apontamento registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3">Início</th>
                        <th className="text-left py-2 pr-3">Término</th>
                        <th className="text-left py-2 pr-3">Atividade</th>
                        <th className="text-left py-2 pr-3">Descrição</th>
                        <th className="text-left py-2 pr-3">Origem</th>
                        <th className="text-left py-2">Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTimeEntries.map((item) => (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{item.start_time || "-"}</td>
                          <td className="py-2 pr-3">{item.end_time || "-"}</td>
                          <td className="py-2 pr-3">{item.activity || "-"}</td>
                          <td className="py-2 pr-3">{item.description || "-"}</td>
                          <td className="py-2 pr-3">{item.origin || "-"}</td>
                          <td className="py-2">{item.destination || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Produção / Fresagem</h4>
              {selectedAreas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma área registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3">#</th>
                        <th className="text-right py-2 pr-3">Comprimento (m)</th>
                        <th className="text-right py-2 pr-3">Largura (m)</th>
                        <th className="text-right py-2 pr-3">Espessura (cm)</th>
                        <th className="text-right py-2 pr-3">Área (m²)</th>
                        <th className="text-right py-2">Volume (m³)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAreas.map((item, idx) => (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{idx + 1}</td>
                          <td className="py-2 pr-3 text-right">{toNum(item.length_m).toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right">{toNum(item.width_m).toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right">{toNum(item.thickness_cm).toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right">{toNum(item.m2).toFixed(2)}</td>
                          <td className="py-2 text-right">{toNum(item.m3).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border font-semibold">
                        <td className="py-2 pr-3" colSpan={4}>Totais</td>
                        <td className="py-2 pr-3 text-right">{selectedAreas.reduce((acc, item) => acc + toNum(item.m2), 0).toFixed(2)}</td>
                        <td className="py-2 text-right">{selectedAreas.reduce((acc, item) => acc + toNum(item.m3), 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Bits Lançados</h4>
              {selectedBits.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum bit registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right py-2 pr-3">Quantidade</th>
                        <th className="text-left py-2 pr-3">Marca</th>
                        <th className="text-left py-2 pr-3">Horímetro</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBits.map((item) => (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="py-2 pr-3 text-right">{item.quantity ?? 0}</td>
                          <td className="py-2 pr-3">{item.brand || "-"}</td>
                          <td className="py-2 pr-3">{item.horimeter || "-"}</td>
                          <td className="py-2">{item.status || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Abastecimento</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <p><strong>Tipo combustível:</strong> {selectedDiary.fuel_type || "-"}</p>
                <p><strong>Litros:</strong> {toNum(selectedDiary.fuel_liters).toFixed(2)}</p>
                <p><strong>Horímetro abastecimento:</strong> {selectedDiary.fuel_meter ?? "-"}</p>
              </div>
            </div>
          </section>
        )}
      </main>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .rdo-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
