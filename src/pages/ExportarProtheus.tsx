import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const EQUIPMENT_TYPES = [
  "Fresadora", "Bobcat", "Rolo", "Vibroacabadora",
  "Usina KMA", "Caminhões", "Comboio", "Veículo", "Retro", "Carreta",
];

const MONTHS = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1].map(y => String(y));

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ExportarProtheus() {
  const navigate = useNavigate();
  const [tipoEquip, setTipoEquip] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [total, setTotal] = useState<number | null>(null);

  const handleExportar = async () => {
    if (!tipoEquip || !mes || !ano) {
      setErro("Selecione o tipo de equipamento, mês e ano.");
      return;
    }
    setErro("");
    setLoading(true);
    setTotal(null);

    try {
      const dataInicio = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFim = `${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`;

      // Buscar diários do mês
      const { data: diarios, error: errDiarios } = await supabase
        .from("equipment_diaries")
        .select("*")
        .eq("equipment_type", tipoEquip)
        .gte("date", dataInicio)
        .lte("date", dataFim)
        .order("date", { ascending: true });

      if (errDiarios) throw errDiarios;
      if (!diarios || diarios.length === 0) {
        setErro(`Nenhum lançamento encontrado para ${tipoEquip} em ${mes}/${ano}.`);
        setLoading(false);
        return;
      }

      // Buscar apontamentos de horário de todos os diários
      const diaryIds = diarios.map(d => d.id);
      const { data: timeEntries } = await supabase
        .from("equipment_time_entries")
        .select("*")
        .in("diary_id", diaryIds);

      // Buscar bits
      const { data: bitsEntries } = await supabase
        .from("equipment_bits")
        .select("*")
        .in("diary_id", diaryIds);

      // Buscar produção (áreas)
      const { data: prodAreas } = await supabase
        .from("equipment_production_areas")
        .select("*")
        .in("diary_id", diaryIds);

      // Montar mapa por diary_id
      const timeMap: Record<string, any[]> = {};
      const bitsMap: Record<string, any[]> = {};
      const prodMap: Record<string, any[]> = {};

      (timeEntries ?? []).forEach(t => {
        if (!timeMap[t.diary_id]) timeMap[t.diary_id] = [];
        timeMap[t.diary_id].push(t);
      });
      (bitsEntries ?? []).forEach(b => {
        if (!bitsMap[b.diary_id]) bitsMap[b.diary_id] = [];
        bitsMap[b.diary_id].push(b);
      });
      (prodAreas ?? []).forEach(p => {
        if (!prodMap[p.diary_id]) prodMap[p.diary_id] = [];
        prodMap[p.diary_id].push(p);
      });

      // Calcular max apontamentos e produções para definir colunas
      const maxTime = Math.max(1, ...diarios.map(d => (timeMap[d.id] ?? []).length));
      const maxProd = Math.max(1, ...diarios.map(d => (prodMap[d.id] ?? []).length));
      const maxTime10 = Math.min(maxTime, 10);
      const maxProd10 = Math.min(maxProd, 10);

      // Montar cabeçalho dinâmico
      const header: string[] = [
        "DATA", "OPERADOR", "AUXILIAR", "FROTA", "TIPO EQUIPAMENTO",
        "OGS", "CLIENTE", "LOCAL", "STATUS", "PERÍODO",
        "HORÍMETRO INICIAL", "HORÍMETRO FINAL",
      ];

      for (let i = 1; i <= maxTime10; i++) {
        header.push(`INÍCIO ${String(i).padStart(2,"0")}`);
        header.push(`TÉRMINO ${String(i).padStart(2,"0")}`);
        header.push(`ITEM ${String(i).padStart(2,"0")}`);
        header.push(`OBS ITEM ${String(i).padStart(2,"0")}`);
      }

      header.push("TIPO COMBUSTÍVEL", "LITROS", "HORÍMETRO ABAST.", "FORNECEDOR COMBUST.");

      if (tipoEquip === "Fresadora") {
        header.push("TIPO FRESAGEM");
        for (let i = 1; i <= maxProd10; i++) {
          header.push(`COMP ${String(i).padStart(2,"0")} (m)`);
          header.push(`LARG ${String(i).padStart(2,"0")} (m)`);
          header.push(`ESP ${String(i).padStart(2,"0")} (cm)`);
        }
        header.push("APLICOU BITS", "STATUS BITS", "QTD NOVOS", "QTD MEIA VIDA", "HOR. BITS", "FORNECEDOR BITS");
      } else if (tipoEquip === "Usina KMA") {
        for (let i = 1; i <= maxProd10; i++) {
          header.push(`COMP ${String(i).padStart(2,"0")} (m)`);
          header.push(`LARG ${String(i).padStart(2,"0")} (m)`);
          header.push(`ESP ${String(i).padStart(2,"0")} (cm)`);
        }
      } else {
        for (let i = 1; i <= maxProd10; i++) {
          header.push(`COMP ${String(i).padStart(2,"0")} (m)`);
          header.push(`LARG ${String(i).padStart(2,"0")} (m)`);
          header.push(`ESP ${String(i).padStart(2,"0")} (cm)`);
        }
      }

      header.push("OBSERVAÇÕES");

      // Montar linhas
      const rows = diarios.map(d => {
        const times = (timeMap[d.id] ?? []).slice(0, maxTime10);
        const prods = (prodMap[d.id] ?? []).slice(0, maxProd10);
        const bits = (bitsMap[d.id] ?? [])[0];

        const row: any[] = [
          fmtDate(d.date),
          d.operator_name ?? "",
          d.operator_solo ?? "",
          d.equipment_fleet ?? "",
          d.equipment_type ?? "",
          d.ogs_number ?? "",
          d.client_name ?? "",
          d.location_address ?? "",
          d.work_status ?? "",
          d.period ?? "",
          d.meter_initial ?? "",
          d.meter_final ?? "",
        ];

        // Apontamentos
        for (let i = 0; i < maxTime10; i++) {
          const t = times[i];
          row.push(t?.start_time ?? "");
          row.push(t?.end_time ?? "");
          row.push(t?.activity ?? "");
          row.push(t?.description ?? "");
        }

        // Abastecimento
        row.push(d.fuel_type ?? "");
        row.push(d.fuel_liters ?? "");
        row.push(d.fuel_meter ?? "");
        row.push(""); // fornecedor combustível — não temos no schema ainda

        // Produção / bits por tipo
        if (tipoEquip === "Fresadora") {
          row.push(d.fresagem_type ?? "");
          for (let i = 0; i < maxProd10; i++) {
            const p = prods[i];
            row.push(p?.comprimento_m ?? "");
            row.push(p?.largura_m ?? "");
            row.push(p?.espessura_cm ?? "");
          }
          row.push(bits ? "Sim" : "Não");
          row.push(bits?.status ?? "");
          row.push(bits?.quantity ?? "");
          row.push(""); // meia vida — não temos campo separado
          row.push(bits?.meter_at_change ?? "");
          row.push(bits?.brand ?? "");
        } else {
          for (let i = 0; i < maxProd10; i++) {
            const p = prods[i];
            row.push(p?.comprimento_m ?? "");
            row.push(p?.largura_m ?? "");
            row.push(p?.espessura_cm ?? "");
          }
        }

        row.push(d.observations ?? "");
        return row;
      });

      // Gerar XLSX
      const wb = XLSX.utils.book_new();
      const wsData = [header, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Estilo do cabeçalho
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "0055CC" } },
            alignment: { horizontal: "center" },
          };
        }
      }

      // Largura automática
      ws["!cols"] = header.map(() => ({ wch: 18 }));

      const nomeAba = tipoEquip.replace(/\s/g, "_").toUpperCase();
      XLSX.utils.book_append_sheet(wb, ws, nomeAba);

      const nomeArquivo = `CI_Equipamentos_${tipoEquip.replace(/\s/g,"_")}_${mes}-${ano}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      setTotal(diarios.length);
    } catch (e: any) {
      setErro("Erro ao exportar: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/equipamentos")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Exportar para Protheus</span>
          <span className="block text-[11px] text-primary-foreground/80">CI Equipamentos</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-display font-bold text-base">Exportação Mensal</p>
              <p className="text-xs text-muted-foreground">Gera planilha pronta para importar no Protheus</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Equipamento</span>
            <Select value={tipoEquip} onValueChange={setTipoEquip}>
              <SelectTrigger className="h-12 bg-white border-border rounded-xl">
                <SelectValue placeholder="Selecione o equipamento" />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mês</span>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-12 bg-white border-border rounded-xl">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ano</span>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="h-12 bg-white border-border rounded-xl">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {total !== null && !erro && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 text-center">
              ✅ {total} registro{total !== 1 ? "s" : ""} exportado{total !== 1 ? "s" : ""} com sucesso!
            </div>
          )}

          <Button
            onClick={handleExportar}
            disabled={loading || !tipoEquip || !mes || !ano}
            className="w-full h-12 gap-2 text-base font-display font-bold rounded-xl"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Gerando planilha...</>
            ) : (
              <><Download className="w-5 h-5" /> Exportar XLSX</>
            )}
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">ℹ️ Como usar</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Selecione o tipo de equipamento</li>
            <li>Escolha o mês e ano a exportar</li>
            <li>Clique em Exportar XLSX</li>
            <li>Importe o arquivo gerado no Protheus</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
