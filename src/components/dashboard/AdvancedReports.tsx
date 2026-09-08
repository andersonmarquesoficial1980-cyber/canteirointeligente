import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileSpreadsheet, Loader2, Truck, Fuel, Download } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type OgsLookupMap = Record<string, string[]>;

const BASE_OGS = { num: "BASE", addr: "PÁTIO CENTRAL / OFICINA" };
const EMPTY_OGS = { num: "—", addr: "—" };
const CARRETA_TYPE_OR_FILTER = "equipment_type.ilike.%carreta%,equipment_type.ilike.%cavalo%mec%";

const normalizeType = (value: string | null | undefined): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isCarretaTipo = (value: string | null | undefined): boolean => {
  const normalized = normalizeType(value);
  return normalized.includes("carreta") || (normalized.includes("cavalo") && normalized.includes("mecan"));
};

const getLocationAddresses = (locationAddress: string | null | undefined): string[] =>
  (locationAddress || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

const extractDigitsToken = (text: string): string => {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\b\d{3,6}\b/);
  return match?.[0] || "";
};

const extractOgsNumber = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const normalized = raw.trim();
  if (!normalized || normalized === "—") return "";

  if (normalized.includes("|")) {
    return extractDigitsToken(normalized.split("|")[0] || "");
  }

  const sep = normalized.indexOf(" — ");
  if (sep > -1) return extractDigitsToken(normalized.substring(0, sep));

  return extractDigitsToken(normalized);
};

const extractAddressFromRaw = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const normalized = raw.trim();
  if (!normalized || normalized === "—") return "";

  if (normalized.toUpperCase().includes("BASE")) return BASE_OGS.addr;

  if (normalized.includes("|")) {
    const parts = normalized.split("|");
    const right = parts.slice(1).join("|").trim();
    return right || "";
  }

  const sep = normalized.indexOf(" — ");
  if (sep > -1) return normalized.substring(sep + 3).trim();

  return extractDigitsToken(normalized) ? "" : normalized;
};

const buildOgsLookupMap = (rows: Array<{ ogs_number: string | null; location_address: string | null }>): OgsLookupMap => {
  const map: OgsLookupMap = {};

  rows.forEach((row) => {
    const num = row.ogs_number?.trim();
    if (!num) return;

    const addresses = getLocationAddresses(row.location_address);
    if (!map[num]) map[num] = [];

    addresses.forEach((address) => {
      if (!map[num].includes(address)) map[num].push(address);
    });
  });

  return map;
};

const resolveOgs = (raw: string | null | undefined, ogsLookup: OgsLookupMap): { num: string; addr: string } => {
  const num = extractOgsNumber(raw);
  const addressFromRaw = extractAddressFromRaw(raw);

  if (!num) {
    if (addressFromRaw) return { num: "—", addr: addressFromRaw };
    return EMPTY_OGS;
  }

  if (addressFromRaw) return { num, addr: addressFromRaw };

  const addresses = ogsLookup[num] || [];
  return {
    num,
    addr: addresses[0] || "—",
  };
};

const fetchOgsLookup = async (rawValues: Array<string | null | undefined>): Promise<OgsLookupMap> => {
  const ogsNumbers = Array.from(
    new Set(rawValues.map(extractOgsNumber).filter((num) => Boolean(num)))
  );

  if (ogsNumbers.length === 0) return {};

  const { data, error } = await supabase
    .from("ogs_reference")
    .select("ogs_number, location_address")
    .in("ogs_number", ogsNumbers);

  if (error) throw error;

  return buildOgsLookupMap(data || []);
};

export default function AdvancedReports() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [loadingTransport, setLoadingTransport] = useState(false);
  const [loadingRefuel, setLoadingRefuel] = useState(false);
  const [loadingConsolidado, setLoadingConsolidado] = useState(false);

  const getRange = () => {
    if (!dateFrom || !dateTo) return null;
    return {
      from: format(startOfDay(dateFrom), "yyyy-MM-dd"),
      to: format(endOfDay(dateTo), "yyyy-MM-dd"),
    };
  };

  const fmtDate = (d: string) => {
    if (!d) return "—";
    try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
  };

  const parseDateCell = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const [y, m, d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0);
  };

  const parseTimeCell = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const parts = String(value).split(":").map(Number);
    if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return (h * 3600 + m * 60 + s) / 86400;
  };

  const extractTaggedValue = (text: string | null | undefined, tag: string): string => {
    if (!text) return "";
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*([^|]+)`, "i"));
    return match?.[1]?.trim() || "";
  };

  const parseDirection = (value: string): string => {
    const normalized = (value || "").toLowerCase();
    if (normalized.includes("leste")) return "Leste";
    if (normalized.includes("oeste")) return "Oeste";
    if (normalized.includes("norte")) return "Norte";
    if (normalized.includes("sul")) return "Sul";
    return "";
  };

  const parseTrechoKm = (value: string): { km: number | null; sentido: string; texto: string } => {
    const raw = (value || "").trim();
    if (!raw) return { km: null, sentido: "", texto: "" };

    const onlyNum = raw.replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(onlyNum)) {
      return { km: Number(onlyNum), sentido: "", texto: raw };
    }

    const kmMatch = raw.match(/(\d+[\.,]?\d*)/);
    const km = kmMatch ? Number(kmMatch[1].replace(",", ".")) : null;
    return { km: Number.isFinite(km as number) ? km : null, sentido: parseDirection(raw), texto: raw };
  };

  const parseTransportDescription = (description: string | null | undefined) => {
    const desc = (description || "").trim();
    const parts = desc.split("|").map((s) => s.trim()).filter(Boolean);
    const firstPart = parts[0] || "";

    const isVazio = parts.some((p) => p.toUpperCase() === "VAZIO") || firstPart.toUpperCase() === "VAZIO";

    const blockedHead = /^(TRECHO:|KM ORIGEM:|KM DESTINO:|RETORNO:|DETALHE:)/i.test(firstPart);
    const equipHead = !isVazio && firstPart && !blockedHead ? firstPart : "";
    const equips = equipHead.split(",").map((s) => s.trim()).filter(Boolean);

    const trechoRaw = parts.find((p) => /^TRECHO:/i.test(p)) || "";
    const trecho = trechoRaw.replace(/^TRECHO:\s*/i, "").trim();

    const kmOrigemRaw = extractTaggedValue(desc, "KM Origem:");
    const kmDestinoRaw = extractTaggedValue(desc, "KM Destino:");
    const kmOrigem = parseTrechoKm(kmOrigemRaw);
    const kmDestino = parseTrechoKm(kmDestinoRaw);

    return {
      eq1: equips[0] || "",
      eq2: equips[1] || "",
      eq3: equips[2] || "",
      vazio: isVazio ? "SIM" : "NÃO",
      trecho,
      kmOrigem,
      kmDestino,
      observacoes: desc,
    };
  };

  const up = (value: string | null | undefined): string => (value || "").trim().toLocaleUpperCase("pt-BR");

  const kmToToken = (km: number | null): string => {
    if (km == null || Number.isNaN(km)) return "";
    return Number.isInteger(km) ? `KM${km}` : `KM${String(km).replace(".", ",")}`;
  };

  const composeAddressWithKm = (address: string, kmInfo: { km: number | null; sentido: string }): string => {
    const parts = [up(address), kmToToken(kmInfo.km), up(kmInfo.sentido)].filter(Boolean);
    return parts.join(" | ");
  };

  /* ── Exportar Transportes (Carreta) ── */
  const exportTransportes = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingTransport(true);
    try {
      const { data: diaries, error: diariesError } = await supabase
        .from("equipment_diaries")
        .select("id, date, equipment_fleet, equipment_type, attachment_type, odometer_initial, odometer_final")
        .or(CARRETA_TYPE_OR_FILTER)
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true })
        .order("equipment_fleet", { ascending: true });

      if (diariesError) throw diariesError;

      const diaryRows = diaries || [];
      if (diaryRows.length === 0) {
        toast.info("Nenhum transporte de Carreta encontrado no período.");
        return;
      }

      const diaryIds = diaryRows.map((d: any) => d.id);
      const byDiaryId: Record<string, any> = {};
      diaryRows.forEach((d: any) => { byDiaryId[d.id] = d; });

      const CHUNK = 200;
      const allEntries: any[] = [];
      for (let i = 0; i < diaryIds.length; i += CHUNK) {
        const chunk = diaryIds.slice(i, i + CHUNK);
        const { data: chunkEntries, error: entriesError } = await supabase
          .from("equipment_time_entries")
          .select("*")
          .in("diary_id", chunk)
          .order("start_time", { ascending: true });
        if (entriesError) throw entriesError;
        allEntries.push(...(chunkEntries || []));
      }

      const transportRows = allEntries.filter((r: any) => byDiaryId[r.diary_id]);
      const ogsLookup = await fetchOgsLookup(transportRows.flatMap((r: any) => [r.origin, r.destination]));

      const dataRows = transportRows
        .sort((a: any, b: any) => {
          const da = byDiaryId[a.diary_id]?.date || "";
          const db = byDiaryId[b.diary_id]?.date || "";
          if (da !== db) return da.localeCompare(db);
          return String(a.start_time || "").localeCompare(String(b.start_time || ""));
        })
        .map((r: any) => {
          const d = byDiaryId[r.diary_id];
          const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
          const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
          const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
          const parsed = parseTransportDescription(r.description);
          const orig = resolveOgs(r.origin, ogsLookup);
          const dest = resolveOgs(r.destination, ogsLookup);
          const origemEndereco = composeAddressWithKm(orig.addr === "—" ? "" : orig.addr, parsed.kmOrigem);
          const destinoEndereco = composeAddressWithKm(dest.addr === "—" ? "" : dest.addr, parsed.kmDestino);
          const equipamentosAgrupados = [parsed.eq1, parsed.eq2, parsed.eq3]
            .map((value) => up(value))
            .filter(Boolean)
            .join(" / ");

          return [
            parseDateCell(d?.date),
            up(d?.equipment_fleet || ""),
            kmIni,
            kmFin,
            kmRodado,
            up(parsed.eq1),
            up(parsed.eq2),
            up(parsed.eq3),
            parsed.vazio,
            orig.num === "—" ? "" : orig.num,
            origemEndereco,
            dest.num === "—" ? "" : dest.num,
            destinoEndereco,
            parseTimeCell(r.start_time),
            parseTimeCell(r.end_time),
            up(r.activity || ""),
            up(parsed.trecho),
            equipamentosAgrupados,
          ];
        });

      if (dataRows.length === 0) {
        toast.info("Nenhum transporte de Carreta encontrado no período.");
        return;
      }

      const header = [[
        "Data", "Prefixo", "KM Inicial", "KM Final", "KM Percorrido",
        "Equipamento 01", "Equipamento 02", "Equipamento 03", "Vazio (sem equipamento)",
        "Nº OGS (Origem)", "Endereço (Origem)",
        "Nº OGS (Destino)", "Endereço (Destino)",
        "Horário Início", "Horário Fim", "Atividade", "Trecho", "Equipamentos (agrupado)",
      ]];

      const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows], { cellDates: true });
      ws["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 42 },
        { wch: 12 }, { wch: 42 },
        { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 30 },
      ];

      const totalRows = dataRows.length + 1;
      for (let r = 2; r <= totalRows; r++) {
        const dateCell = ws[`A${r}`];
        if (dateCell && dateCell.v) {
          dateCell.t = "d";
          dateCell.z = "dd/mm/yyyy";
        }

        ["C", "D", "E"].forEach((col) => {
          const cell = ws[`${col}${r}`];
          if (cell && typeof cell.v === "number") {
            cell.t = "n";
            cell.z = "0";
          }
        });

        ["N", "O"].forEach((col) => {
          const cell = ws[`${col}${r}`];
          if (cell && typeof cell.v === "number") {
            cell.t = "n";
            cell.z = "hh:mm:ss";
          }
        });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transportes Carreta");
      XLSX.writeFile(wb, `Relatorio_Transporte_Periodo_Fremix.xlsx`, { cellDates: true });
      toast.success(`${dataRows.length} registros exportados em .xlsx tipado (data/número/hora)!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingTransport(false);
    }
  };

  /* ── Exportar Abastecimentos (Comboio) ── */
  const exportAbastecimentos = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingRefuel(true);
    try {
      const { data, error } = await supabase
        .from("abastecimentos")
        .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, odometer_initial, odometer_final)")
        .eq("fonte", "comboio")
        .gte("equipment_diaries.date", range.from)
        .lte("equipment_diaries.date", range.to);

      if (error) throw error;

      const ogsLookup = await fetchOgsLookup((data || []).map((r: any) => r.ogs));

      const rows = (data || []).map((r: any) => {
        const d = r.equipment_diaries;
        const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
        const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
        const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
        const ogsP = resolveOgs(r.ogs, ogsLookup);
        const services: string[] = [];
        if (r.lubrificado) services.push("Lubrificação");
        if (r.lavado) services.push("Lavagem");
        return {
          "Data": fmtDate(d?.date),
          "Prefixo Comboio": d?.equipment_fleet || "—",
          "KM Inicial": kmIni != null ? kmIni : "—",
          "KM Final": kmFin != null ? kmFin : "—",
          "KM Percorrido": kmRodado != null ? kmRodado : "—",
          "Equipamento Abastecido": r.equipment_fleet || "—",
          "Litros": r.litros ?? "—",
          "Medição (H/KM)": r.horimetro ?? r.km_odometro ?? "—",
          "Nº OGS": ogsP.num,
          "Endereço / Local": ogsP.addr,
          "Serviços Adicionais": services.length > 0 ? services.join(", ") : "—",
        };
      });

      if (rows.length === 0) {
        toast.info("Nenhum abastecimento de Comboio encontrado no período.");
        return;
      }

      const byEquip: Record<string, number> = {};
      const byOgs: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const eq = r.equipment_fleet || "—";
        const ogsP = resolveOgs(r.ogs, ogsLookup);
        const liters = Number(r.litros) || 0;
        byEquip[eq] = (byEquip[eq] || 0) + liters;
        if (ogsP.num !== "—") byOgs[`${ogsP.num} — ${ogsP.addr}`] = (byOgs[`${ogsP.num} — ${ogsP.addr}`] || 0) + liters;
      });

      const summaryEquip = Object.entries(byEquip).sort((a, b) => b[1] - a[1]).map(([eq, l]) => ({ "Equipamento": eq, "Total Litros": l }));
      const summaryOgs = Object.entries(byOgs).sort((a, b) => b[1] - a[1]).map(([ogs, l]) => ({ "OGS / Local": ogs, "Total Litros": l }));

      const wb = XLSX.utils.book_new();
      const wsData = XLSX.utils.json_to_sheet(rows);
      wsData["!cols"] = [
        { wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 32 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsData, "Abastecimentos");

      const wsEquip = XLSX.utils.json_to_sheet(summaryEquip);
      wsEquip["!cols"] = [{ wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsEquip, "Resumo por Equipamento");

      const wsOgs = XLSX.utils.json_to_sheet(summaryOgs);
      wsOgs["!cols"] = [{ wch: 36 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsOgs, "Resumo por OGS");

      XLSX.writeFile(wb, `Relatorio_Abastecimento_Periodo_Fremix.xlsx`);
      toast.success(`${rows.length} registros exportados em 3 abas!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingRefuel(false);
    }
  };

  /* ── Exportar Consolidado ── */
  const exportConsolidado = async () => {
    const range = getRange();
    if (!range) { toast.error("Selecione o período inicial e final."); return; }
    setLoadingConsolidado(true);
    try {
      const [transportRes, refuelRes] = await Promise.all([
        supabase
          .from("equipment_time_entries")
          .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, attachment_type, odometer_initial, odometer_final)")
          .gte("equipment_diaries.date", range.from)
          .lte("equipment_diaries.date", range.to),
        supabase
          .from("abastecimentos")
          .select("*, equipment_diaries!inner(date, equipment_fleet, equipment_type, odometer_initial, odometer_final)")
          .eq("fonte", "comboio")
          .gte("equipment_diaries.date", range.from)
          .lte("equipment_diaries.date", range.to),
      ]);

      if (transportRes.error) throw transportRes.error;
      if (refuelRes.error) throw refuelRes.error;

      const transportRows = (transportRes.data || []).filter((r: any) => isCarretaTipo(r.equipment_diaries?.equipment_type));
      const refuelRows = refuelRes.data || [];
      const ogsLookup = await fetchOgsLookup([
        ...transportRows.flatMap((r: any) => [r.origin, r.destination]),
        ...refuelRows.map((r: any) => r.ogs),
      ]);

      const allRows: any[] = [];

      transportRows
        .forEach((r: any) => {
          const d = r.equipment_diaries;
          const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
          const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
          const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
          const descParts = (r.description || "").split(",").map((s: string) => s.trim());
          const orig = resolveOgs(r.origin, ogsLookup);
          const dest = resolveOgs(r.destination, ogsLookup);

          allRows.push({
            "Tipo": "Carreta",
            "Data": fmtDate(d?.date),
            "Prefixo": d?.equipment_fleet || "—",
            "KM Inicial": kmIni ?? "—",
            "KM Final": kmFin ?? "—",
            "KM Percorrido": kmRodado ?? "—",
            "Equipamento 01": descParts[0] || "—",
            "Equipamento 02": descParts[1] || "—",
            "Equipamento 03": descParts[2] || "—",
            "Nº OGS (Origem)": orig.num,
            "Endereço (Origem)": orig.addr,
            "Nº OGS (Destino)": dest.num,
            "Endereço (Destino)": dest.addr,
            "Horário Início": r.start_time || "—",
            "Horário Fim": r.end_time || "—",
            "Observações": r.ogs_destination || r.activity || "—",
          });
        });

      refuelRows.forEach((r: any) => {
        const d = r.equipment_diaries;
        const kmIni = d?.odometer_initial != null ? Number(d.odometer_initial) : null;
        const kmFin = d?.odometer_final != null ? Number(d.odometer_final) : null;
        const kmRodado = kmIni != null && kmFin != null ? kmFin - kmIni : null;
        const ogsP = resolveOgs(r.ogs, ogsLookup);
        const services: string[] = [];
        if (r.lubrificado) services.push("Lubrificação");
        if (r.lavado) services.push("Lavagem");
        allRows.push({
          "Tipo": "Comboio",
          "Data": fmtDate(d?.date),
          "Prefixo": d?.equipment_fleet || "—",
          "KM Inicial": kmIni ?? "—",
          "KM Final": kmFin ?? "—",
          "KM Percorrido": kmRodado ?? "—",
          "Equipamento 01": r.equipment_fleet || "—",
          "Equipamento 02": "—",
          "Equipamento 03": "—",
          "Nº OGS (Origem)": "Comboio",
          "Endereço (Origem)": "—",
          "Nº OGS (Destino)": ogsP.num,
          "Endereço (Destino)": ogsP.addr,
          "Horário Início": `${r.litros ?? 0} L`,
          "Horário Fim": `Med: ${r.horimetro ?? r.km_odometro ?? "—"}`,
          "Observações": services.length > 0 ? services.join(", ") : "Abastecimento",
        });
      });

      allRows.sort((a, b) => (a["Data"] || "").localeCompare(b["Data"] || ""));

      if (allRows.length === 0) {
        toast.info("Nenhum registro encontrado no período.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(allRows);
      ws["!cols"] = [
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
        { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 12 }, { wch: 32 }, { wch: 12 }, { wch: 32 },
        { wch: 10 }, { wch: 10 }, { wch: 36 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
      XLSX.writeFile(wb, `Relatorio_Transporte_Periodo_Fremix.xlsx`);
      toast.success(`${allRows.length} registros consolidados e exportados!`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + (err?.message || "desconhecido"));
    } finally {
      setLoadingConsolidado(false);
    }
  };

  const hasRange = dateFrom && dateTo;

  return (
    <Card className="bg-white border-border shadow-[0_4px_24px_-4px_hsl(215_20%_50%/0.1)] rounded-2xl">
      <CardContent className="p-5 space-y-5">
        <h2 className="text-sm font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Relatórios Avançados (Excel)
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">Data Inicial</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm font-medium", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-display font-extrabold text-[hsl(215_80%_22%)] uppercase tracking-wide">Data Final</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left text-sm font-medium", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {hasRange && (
            <span className="text-xs text-muted-foreground font-medium pb-2">
              {format(dateFrom!, "dd/MM")} — {format(dateTo!, "dd/MM/yyyy")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button onClick={exportTransportes} disabled={!hasRange || loadingTransport} className="gap-2 font-extrabold py-5 rounded-xl bg-[hsl(215_80%_35%)] hover:bg-[hsl(215_80%_28%)] text-white shadow-md">
            {loadingTransport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Transportes (Carreta)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
