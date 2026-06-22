import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Loader2, FileSpreadsheet, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const EQUIPMENT_TYPES = [
  "Fresadora", "Bobcat", "Rolo", "Vibroacabadora",
  "Usina KMA", "Caminhões", "Comboio", "Veículo", "Retro", "Carreta",
];

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtNum(val: any): string {
  if (val === null || val === undefined || val === "") return "";
  return String(val).replace(".", ",");
}

// Equipamentos com Auxiliar
const TEM_AUXILIAR = ["Fresadora", "Usina KMA"];
// Equipamentos com coluna de Produção (Comp/Larg/Esp)
const TEM_PRODUCAO = ["Fresadora", "Usina KMA"];

// ── Cabeçalho fixo ──────────────────────────────────────────────────────────
function buildHeader(tipoEquip: string): string[] {
  const comAuxiliar = TEM_AUXILIAR.includes(tipoEquip);
  const comProducao = TEM_PRODUCAO.includes(tipoEquip);

  const h: string[] = [
    "HORA DE CONCLUSÃO",
    "NOME COMPLETO DE QUEM ESTÁ PREENCHENDO",
    "DATA",
    "OPERADOR",
    ...(comAuxiliar ? ["AUXILIAR"] : []),
    "FROTA",
    "TIPO EQUIPAMENTO",
    "OGS",
    "CLIENTE",
    "LOCAL",
    "STATUS",
    "PERÍODO",
    tipoEquip === "Carreta" ? "ODÔMETRO INICIAL" : "HORÍMETRO INICIAL",
    tipoEquip === "Carreta" ? "ODÔMETRO FINAL" : "HORÍMETRO FINAL",
  ];

  // 10 blocos de apontamento fixos
  for (let i = 1; i <= 10; i++) {
    h.push(`INÍCIO ${pad(i)}`);
    h.push(`TÉRMINO ${pad(i)}`);
    h.push(`ITEM ${pad(i)}`);
    h.push(tipoEquip === "Carreta" ? `EQUIPAMENTOS TRANSPORTADOS ${pad(i)}` : `OBS ITEM ${pad(i)}`);
  }

  // Bits e Fresagem (somente Fresadora)
  if (tipoEquip === "Fresadora") {
    h.push("TIPO FRESAGEM");
    h.push("APLICOU BITS");
    h.push("STATUS BITS");
    h.push("QTD BITS NOVOS");
    h.push("QTD BITS MEIA VIDA");
    h.push("HORÍMETRO BITS");
    h.push("FORNECEDOR BITS");
  }

  // 25 blocos de produção fixos (só Fresadora e KMA)
  if (comProducao) {
    for (let i = 1; i <= 25; i++) {
      h.push(`COMPRIMENTO ${pad(i)} (m)`);
      h.push(`LARGURA ${pad(i)} (m)`);
      h.push(`ESPESSURA ${pad(i)} (cm)`);
    }
  }

  h.push("OBSERVAÇÕES GERAIS");

  return h;
}

export default function ExportarProtheus() {
  const navigate = useNavigate();
  const [tipoEquip, setTipoEquip] = useState("");
  const [frota, setFrota] = useState("__todas__");
  const [frotas, setFrotas] = useState<string[]>([]);
  const [loadingFrotas, setLoadingFrotas] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [erro, setErro] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [previewHeader, setPreviewHeader] = useState<string[] | null>(null);
  const [previewRows, setPreviewRows] = useState<any[][] | null>(null);

  // ── Carrega frotas disponíveis ao escolher tipo de equipamento ──────────────
  useEffect(() => {
    if (!tipoEquip) { setFrotas([]); setFrota("__todas__"); return; }
    setLoadingFrotas(true);
    setFrota("__todas__");
    setPreviewHeader(null); setPreviewRows(null); setTotal(null);
    supabase
      .from("equipment_diaries")
      .select("equipment_fleet")
      .eq("equipment_type", tipoEquip)
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((d: any) => d.equipment_fleet).filter(Boolean))].sort();
        setFrotas(unique);
        setLoadingFrotas(false);
      });
  }, [tipoEquip]);

  const resetPreview = () => {
    setPreviewHeader(null); setPreviewRows(null); setTotal(null);
  };

  // ── Função central de busca ──────────────────────────────────────────────────
  const fetchData = async () => {
    let query = supabase
      .from("equipment_diaries")
      .select("*")
      .eq("equipment_type", tipoEquip)
      .gte("date", dataInicio)
      .lte("date", dataFim)
      .order("date", { ascending: true });

    if (frota && frota !== "__todas__") {
      query = query.eq("equipment_fleet", frota);
    }

    const { data: diarios, error: errDiarios } = await query;

    if (errDiarios) throw errDiarios;
    if (!diarios || diarios.length === 0) {
      const frotaLabel = frota && frota !== "__todas__" ? ` / Frota ${frota}` : "";
      throw new Error(`Nenhum lançamento encontrado para ${tipoEquip}${frotaLabel} no período selecionado.`);
    }

    const diaryIds = diarios.map((d: any) => d.id);

    const [
      { data: timeEntries },
      { data: bitsEntries },
      { data: prodAreas },
    ] = await Promise.all([
      supabase.from("equipment_time_entries").select("*").in("diary_id", diaryIds).order("start_time", { ascending: true }).limit(10000),
      supabase.from("bit_entries").select("*").in("diary_id", diaryIds).limit(10000),
      supabase.from("equipment_production_areas").select("*").in("diary_id", diaryIds).limit(10000),
    ]);

    const createdByIds = [...new Set((diarios ?? []).map((d: any) => d.created_by).filter(Boolean))];
    const profileMap: Record<string, string> = {};
    if (createdByIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", createdByIds);
      (profilesData || []).forEach((p: any) => {
        if (p.user_id) profileMap[p.user_id] = p.nome_completo || "";
      });
    }

    const timeMap: Record<string, any[]> = {};
    const bitsMap: Record<string, any[]> = {};
    const prodMap: Record<string, any[]> = {};

    function sortTimeEntries(entries: any[]): any[] {
      return [...entries].sort((a, b) => {
        const toMinutes = (t: string) => {
          if (!t) return 0;
          const parts = t.split(":");
          const h = parseInt(parts[0]) || 0;
          const m = parseInt(parts[1]) || 0;
          const mins = h * 60 + m;
          return mins < 7 * 60 ? mins + 24 * 60 : mins;
        };
        return toMinutes(a.start_time) - toMinutes(b.start_time);
      });
    }

    const periodMap: Record<string, string> = {};
    (diarios ?? []).forEach((d: any) => { periodMap[d.id] = d.period || ""; });

    (timeEntries ?? []).forEach((t: any) => {
      if (!timeMap[t.diary_id]) timeMap[t.diary_id] = [];
      timeMap[t.diary_id].push(t);
    });
    Object.keys(timeMap).forEach(diaryId => {
      timeMap[diaryId] = sortTimeEntries(timeMap[diaryId]);
    });
    (bitsEntries ?? []).forEach((b: any) => {
      if (!bitsMap[b.diary_id]) bitsMap[b.diary_id] = [];
      bitsMap[b.diary_id].push(b);
    });
    (prodAreas ?? []).forEach((p: any) => {
      if (!prodMap[p.diary_id]) prodMap[p.diary_id] = [];
      prodMap[p.diary_id].push(p);
    });

    function inferirTurno(times: any[], periodOriginal: string): string {
      const primeiro = times[0]?.start_time;
      if (!primeiro) return periodOriginal;
      const [h, m] = primeiro.split(":").map(Number);
      const mins = (h ?? 0) * 60 + (m ?? 0);
      if (mins >= 4 * 60 && mins < 18 * 60) return "diurno";
      return "noturno";
    }

    const comAuxiliar = TEM_AUXILIAR.includes(tipoEquip);
    const comProducao = TEM_PRODUCAO.includes(tipoEquip);
    const header = buildHeader(tipoEquip);

    const dataRows = diarios.map((d: any) => {
      const times  = (timeMap[d.id] ?? []).slice(0, 10);
      const bits   = (bitsMap[d.id] ?? [])[0];
      const prods  = (prodMap[d.id] ?? []).slice(0, 25);
      const turnoCorrigido = inferirTurno(timeMap[d.id] ?? [], d.period ?? "");

      const createdAtBR = d.created_at
        ? new Date(d.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";
      const preenchidoPor = profileMap[d.created_by] ?? "";

      const row: any[] = [
        createdAtBR,
        preenchidoPor,
        fmtDate(d.date),
        d.operator_name ?? "",
        ...(comAuxiliar ? [d.operator_solo ?? ""] : []),
        d.equipment_fleet ?? "",
        d.equipment_type ?? "",
        d.ogs_number ?? "",
        d.client_name ?? "",
        d.location_address ?? "",
        d.work_status ?? "",
        turnoCorrigido,
        tipoEquip === "Carreta" ? fmtNum(d.odometer_initial) : fmtNum(d.meter_initial),
        tipoEquip === "Carreta" ? fmtNum(d.odometer_final) : fmtNum(d.meter_final),
      ];

      for (let i = 0; i < 10; i++) {
        const t = times[i];
        row.push(t?.start_time ?? "");
        row.push(t?.end_time ?? "");
        row.push(t?.activity ?? "");
        row.push(t?.description ?? "");
      }

      if (tipoEquip === "Fresadora") {
        row.push(d.fresagem_type ?? "");
        row.push(bits ? "Sim" : "Não");
        row.push(bits?.status ?? "");
        row.push(fmtNum(bits?.quantity));
        row.push("");
        row.push(fmtNum(bits?.meter_at_change));
        row.push(bits?.brand ?? "");
      }

      if (comProducao) {
        for (let i = 0; i < 25; i++) {
          const p = prods[i];
          row.push(fmtNum(p?.length_m));
          row.push(fmtNum(p?.width_m));
          row.push(fmtNum(p?.thickness_cm));
        }
      }

      row.push(d.observations ?? "");
      return row;
    });

    return { header, rows: dataRows, total: diarios.length };
  };

  const isFormValid = tipoEquip && dataInicio && dataFim && dataInicio <= dataFim;

  // ── Pré-visualizar ────────────────────────────────────────────────────────
  const handlePrevisualizar = async () => {
    if (!isFormValid) {
      setErro("Selecione o tipo de equipamento e um período válido (data inicial ≤ data final).");
      return;
    }
    setErro("");
    setLoadingPreview(true);
    setPreviewHeader(null);
    setPreviewRows(null);
    setTotal(null);
    try {
      const { header, rows, total } = await fetchData();
      setPreviewHeader(header);
      setPreviewRows(rows);
      setTotal(total);
    } catch (e: any) {
      setErro(e?.message ?? String(e));
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Exportar XLSX ─────────────────────────────────────────────────────────
  const handleExportar = async () => {
    if (!isFormValid) {
      setErro("Selecione o tipo de equipamento e um período válido.");
      return;
    }
    setErro("");
    setLoading(true);
    setTotal(null);

    try {
      const { header, rows: dataRows, total } = await fetchData();

      const wb = XLSX.utils.book_new();
      const wsData = [header, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        const cell = ws[cellRef];
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "0055CC" } },
            alignment: { horizontal: "center", wrapText: true },
          };
        }
      }

      ws["!cols"] = header.map(() => ({ wch: 20 }));

      const nomeAba = tipoEquip.replace(/\s/g, "_").toUpperCase();
      XLSX.utils.book_append_sheet(wb, ws, nomeAba);

      const frotaLabel = frota && frota !== "__todas__" ? `_${frota.replace(/\s/g,"_")}` : "";
      const nomeArquivo = `WF_Protheus_${tipoEquip.replace(/\s/g,"_")}${frotaLabel}_${dataInicio}_a_${dataFim}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      setTotal(total);
    } catch (e: any) {
      setErro("Erro ao exportar: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const periodoLabel = dataInicio && dataFim ? `${fmtDate(dataInicio)} a ${fmtDate(dataFim)}` : "";

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/equipamentos")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Exportar para Protheus</span>
          <span className="block text-[11px] text-primary-foreground/80">WF Equipamentos</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-display font-bold text-base">Exportação por Período</p>
              <p className="text-xs text-muted-foreground">Gera planilha pronta para importar no Protheus</p>
            </div>
          </div>

          {/* Tipo de Equipamento */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Equipamento</span>
            <Select value={tipoEquip} onValueChange={v => { setTipoEquip(v); resetPreview(); }}>
              <SelectTrigger className="h-12 bg-white border-border rounded-xl">
                <SelectValue placeholder="Selecione o equipamento" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Frota — aparece só após escolher tipo */}
          {tipoEquip && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Frota</span>
              {loadingFrotas ? (
                <div className="h-12 rounded-xl border border-border flex items-center px-4 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando frotas...
                </div>
              ) : (
                <Select value={frota} onValueChange={v => { setFrota(v); resetPreview(); }}>
                  <SelectTrigger className="h-12 bg-white border-border rounded-xl">
                    <SelectValue placeholder="Todas as frotas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todas__">Todas as frotas</SelectItem>
                    {frotas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Período — Data Inicial e Data Final */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Inicial</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={e => { setDataInicio(e.target.value); resetPreview(); }}
                className="h-12 bg-white border-border rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Final</span>
              <Input
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={e => { setDataFim(e.target.value); resetPreview(); }}
                className="h-12 bg-white border-border rounded-xl"
              />
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{erro}</div>
          )}

          {total !== null && !erro && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">
              ✅ {total} registro{total !== 1 ? "s" : ""} exportado{total !== 1 ? "s" : ""} com sucesso!
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handlePrevisualizar}
              disabled={loadingPreview || loading || !isFormValid}
              variant="outline"
              className="flex-1 h-12 gap-2 text-base font-display font-bold rounded-xl border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              {loadingPreview ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Carregando...</>
              ) : (
                <><Eye className="w-5 h-5" /> Pré-visualizar</>
              )}
            </Button>
            <Button
              onClick={handleExportar}
              disabled={loading || loadingPreview || !isFormValid}
              className="flex-1 h-12 gap-2 text-base font-display font-bold rounded-xl"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</>
              ) : (
                <><Download className="w-5 h-5" /> Exportar XLSX</>
              )}
            </Button>
          </div>
        </div>

        {previewHeader && previewRows && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Header fixo */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white shadow-sm shrink-0">
              <div>
                <p className="font-display font-bold text-sm">
                  Pré-visualização — {tipoEquip}{frota && frota !== "__todas__" ? ` / Frota ${frota}` : ""} · {periodoLabel}
                </p>
                <p className="text-xs text-muted-foreground">{total} lançamento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""} · {previewHeader.length} colunas</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExportar}
                  disabled={loading}
                  size="sm"
                  className="gap-1.5 rounded-lg text-xs font-bold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar XLSX
                </Button>
                <Button
                  onClick={() => { setPreviewHeader(null); setPreviewRows(null); setTotal(null); }}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-lg text-xs font-bold"
                >
                  Fechar
                </Button>
              </div>
            </div>
            {/* Tabela scroll total */}
            <div className="flex-1 overflow-auto">
              <table className="text-xs border-collapse min-w-max">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {previewHeader.map((col, ci) => (
                      <th
                        key={ci}
                        className="bg-[#0055CC] text-white font-bold px-2 py-1.5 whitespace-nowrap border border-blue-700 text-left min-w-[100px]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1 border border-slate-200 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                          title={String(cell ?? "")}
                        >
                          {String(cell ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">ℹ️ Estrutura da planilha</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
            <li>Colunas base: Data, Operador{TEM_AUXILIAR.includes(tipoEquip) ? ", Auxiliar" : ""}, Frota, OGS, etc.</li>
            <li>10 blocos fixos de Apontamento de Horas (Início/Término/Item/OBS)</li>
            {tipoEquip === "Fresadora" && <li>Bits: Tipo Fresagem + Aplicou/Status/Qtd/Horímetro/Fornecedor</li>}
            {TEM_PRODUCAO.includes(tipoEquip) && <li>25 blocos fixos de Produção (Comprimento/Largura/Espessura)</li>}
            {!TEM_PRODUCAO.includes(tipoEquip) && tipoEquip && <li className="text-amber-600">Sem colunas de Produção para este equipamento</li>}
            <li>Observações Gerais</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
