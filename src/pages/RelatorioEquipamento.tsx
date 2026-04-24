import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileSpreadsheet, Printer, Loader2, Fuel, Wrench, ClipboardList, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface DiarioItem {
  id: string;
  date: string;
  operator_name: string;
  ogs_number: string;
  client_name: string;
  location_address: string;
  work_status: string;
  period: string;
  meter_initial: number;
  meter_final: number;
  fuel_liters: number;
  observations: string;
}

interface AbastItem {
  data: string;
  litros: number;
  fonte: string;
  comboio_fleet: string;
  horimetro: number;
  lubrificado: boolean;
}

interface OSItem {
  numero_os: number;
  titulo: string;
  tipo: string;
  status: string;
  data_abertura: string;
  data_conclusao: string;
  mecanico_nome: string;
  servico_realizado: string;
}

interface PecaItem {
  nome_peca: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  horimetro_troca: number;
  os_numero: number;
}

interface ChecklistNC {
  date: string;
  item_name: string;
  observation: string;
}

const MONTHS = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function calcHoras(ini: number, fin: number): number {
  if (!ini || !fin || fin <= ini) return 0;
  return fin - ini;
}

export default function RelatorioEquipamento() {
  const { fleet } = useParams<{ fleet: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ano = String(new Date().getFullYear());
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");

  // Pegar datas da URL (vindas do RelatoriosHome)
  const urlIni = searchParams.get("ini");
  const urlFim = searchParams.get("fim");

  const [mes, setMes] = useState(urlIni ? urlIni.split("-")[1] : mesAtual);
  const [anoSel, setAnoSel] = useState(urlIni ? urlIni.split("-")[0] : ano);
  const [dataIni, setDataIni] = useState(urlIni || "");
  const [dataFim, setDataFim] = useState(urlFim || "");
  const [modoPeriodo] = useState(!!(urlIni && urlFim && urlIni !== urlFim));
  const [loading, setLoading] = useState(false);
  const [diarios, setDiarios] = useState<DiarioItem[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<AbastItem[]>([]);
  const [ordens, setOrdens] = useState<OSItem[]>([]);
  const [pecas, setPecas] = useState<PecaItem[]>([]);
  const [ncs, setNcs] = useState<ChecklistNC[]>([]);

  async function buscar() {
    if (!fleet) return;
    setLoading(true);
    const fleetKey = fleet.trim();
    const ini = modoPeriodo && dataIni ? dataIni : `${anoSel}-${mes}-01`;
    const fim = modoPeriodo && dataFim ? dataFim : `${anoSel}-${mes}-${new Date(parseInt(anoSel), parseInt(mes), 0).getDate()}`;

    const [{ data: d }, { data: ab }, { data: os }] = await Promise.all([
      supabase.from("equipment_diaries").select("*").ilike("equipment_fleet", fleetKey).gte("date", ini).lte("date", fim).order("date"),
      supabase.from("abastecimentos").select("*").ilike("equipment_fleet", fleetKey).gte("data", ini).lte("data", fim).order("data"),
      supabase.from("manutencao_os").select("*").ilike("equipment_fleet", fleetKey).or(`data_abertura.gte.${ini},data_conclusao.gte.${ini}`).order("data_abertura"),
    ]);

    const diaryIds = (d || []).map((x: any) => x.id);
    const { data: ck } = diaryIds.length > 0
      ? await supabase
          .from("checklist_entries")
          .select("*, checklist_items_standard(item_name)")
          .in("diary_id", diaryIds)
          .eq("status", "nao_ok")
      : { data: [] as any[] };

    console.info("[RelatorioEquipamento] busca", {
      fleet: fleetKey,
      periodo: { ini, fim },
      diarios: d?.length || 0,
      abastecimentos: ab?.length || 0,
      os: os?.length || 0,
    });

    setDiarios(d || []);
    setAbastecimentos(ab || []);
    setOrdens(os || []);

    // Buscar peças das OS
    if (os && os.length > 0) {
      const { data: pc } = await supabase
        .from("manutencao_pecas")
        .select("*, manutencao_os(numero_os)")
        .in("os_id", os.map((o: any) => o.id));
      setPecas((pc || []).map((p: any) => ({ ...p, os_numero: p.manutencao_os?.numero_os })));
    } else {
      setPecas([]);
    }

    // Processar NCs de checklist
    if (ck && d) {
      const diaryMap: Record<string, string> = {};
      (d || []).forEach((x: any) => { diaryMap[x.id] = x.date; });
      setNcs((ck || []).map((c: any) => ({
        date: diaryMap[c.diary_id] || "",
        item_name: c.checklist_items_standard?.item_name || c.item_name || "",
        observation: c.observation || "",
      })));
    }

    setLoading(false);
  }

  useEffect(() => { buscar(); }, [fleet, mes, anoSel]);

  // Cálculos
  const totalHoras = diarios.reduce((s, d) => s + calcHoras(d.meter_initial, d.meter_final), 0);
  const totalLitrosAbast = abastecimentos.reduce((s, a) => s + (a.litros || 0), 0);
  const totalLitrosDiario = diarios.reduce((s, d) => s + (d.fuel_liters || 0), 0);
  const totalLitros = totalLitrosAbast > 0 ? totalLitrosAbast : totalLitrosDiario;
  const consumoMedio = totalHoras > 0 && totalLitros > 0 ? (totalLitros / totalHoras).toFixed(2) : "—";
  const diasTrabalhados = diarios.filter(d => d.work_status === "Trabalhando").length;
  const diasFolga = diarios.filter(d => d.work_status === "Folga").length;
  const diasInoperante = diarios.filter(d => d.work_status === "Inoperante").length;

  function exportarExcel() {
    const wb = XLSX.utils.book_new();

    // Aba Diários
    const diarioRows = [
      ["Data", "Operador", "OGS", "Cliente", "Local", "Status", "Período", "Hor. Inicial", "Hor. Final", "Horas", "Litros", "Observações"],
      ...diarios.map(d => [
        fmtDate(d.date), d.operator_name, d.ogs_number, d.client_name, d.location_address,
        d.work_status, d.period, d.meter_initial, d.meter_final,
        calcHoras(d.meter_initial, d.meter_final), d.fuel_liters, d.observations,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(diarioRows), "Diários");

    // Aba Abastecimento
    const abastRows = [
      ["Data", "Litros", "Fonte", "Comboio", "Horímetro", "Lubrificado"],
      ...abastecimentos.map(a => [fmtDate(a.data), a.litros, a.fonte, a.comboio_fleet || "", a.horimetro || "", a.lubrificado ? "Sim" : "Não"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abastRows), "Abastecimento");

    // Aba OS
    const osRows = [
      ["OS#", "Título", "Tipo", "Status", "Abertura", "Conclusão", "Mecânico", "Serviço Realizado"],
      ...ordens.map(o => [o.numero_os, o.titulo, o.tipo, o.status, fmtDate(o.data_abertura), fmtDate(o.data_conclusao), o.mecanico_nome, o.servico_realizado]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(osRows), "Manutenção");

    // Aba Peças
    const pecaRows = [
      ["OS#", "Peça", "Categoria", "Quantidade", "Unidade", "Horímetro Troca"],
      ...pecas.map(p => [p.os_numero, p.nome_peca, p.categoria, p.quantidade, p.unidade, p.horimetro_troca]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pecaRows), "Peças Trocadas");

    // Aba Resumo
    const resumoRows = [
      ["RELATÓRIO DE EQUIPAMENTO — " + fleet],
      ["Período", `${MONTHS.find(m => m.v === mes)?.l} / ${anoSel}`],
      [""],
      ["Dias Trabalhados", diasTrabalhados],
      ["Dias de Folga", diasFolga],
      ["Dias Inoperante", diasInoperante],
      ["Total de Horas", totalHoras.toFixed(1)],
      ["Total de Litros", totalLitros.toFixed(1)],
      ["Consumo Médio (L/h)", consumoMedio],
      ["OS Abertas", ordens.filter(o => o.status !== "concluida").length],
      ["OS Concluídas", ordens.filter(o => o.status === "concluida").length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");

    XLSX.writeFile(wb, `Relatorio_${fleet}_${mes}-${anoSel}.xlsx`);
  }

  function imprimirPDF() {
    window.print();
  }

  const mesLabel = MONTHS.find(m => m.v === mes)?.l;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)] print:bg-white">
      {/* Header — oculto no print */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg print:hidden">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório — {fleet}</span>
          <span className="block text-[11px] text-primary-foreground/80">{mesLabel} / {anoSel}</span>
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

      {/* Filtros */}
      <div className="px-4 py-3 flex gap-2 print:hidden">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="h-9 rounded-xl w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={anoSel} onValueChange={setAnoSel}>
          <SelectTrigger className="h-9 rounded-xl w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-primary self-center" />}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4 print:px-8 print:pt-4">

        {/* Título para impressão */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-bold">Relatório de Equipamento — {fleet}</h1>
          <p className="text-gray-500">{mesLabel} / {anoSel}</p>
        </div>

        {/* Resumo */}
        <div className="rdo-card">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Resumo do Mês
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-blue-700">{diasTrabalhados}</p>
              <p className="text-[10px] text-blue-600">Dias Trabalhados</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-gray-600">{diasFolga}</p>
              <p className="text-[10px] text-gray-500">Dias Folga</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-red-600">{diasInoperante}</p>
              <p className="text-[10px] text-red-500">Dias Inoperante</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-3">
            <div className="bg-primary/5 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-primary">{totalHoras.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Total Horas</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-orange-600">{totalLitros.toFixed(1)} L</p>
              <p className="text-[10px] text-orange-500">Total Diesel</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xl font-display font-bold text-green-700">{consumoMedio}</p>
              <p className="text-[10px] text-green-600">L/hora</p>
            </div>
          </div>
        </div>

        {/* Histórico de Diários */}
        <div className="rdo-card">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Histórico de Diários ({diarios.length})
          </h3>
          {diarios.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum diário no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Data</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Operador</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">OGS</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-right py-1.5 pr-3 font-semibold text-muted-foreground">Horas</th>
                    <th className="text-right py-1.5 font-semibold text-muted-foreground">Litros</th>
                  </tr>
                </thead>
                <tbody>
                  {diarios.map((d, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 pr-3">{fmtDate(d.date)}</td>
                      <td className="py-1.5 pr-3 truncate max-w-[120px]">{d.operator_name}</td>
                      <td className="py-1.5 pr-3">{d.ogs_number}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.work_status === "Trabalhando" ? "bg-green-100 text-green-700" : d.work_status === "Inoperante" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {d.work_status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-medium">{calcHoras(d.meter_initial, d.meter_final) > 0 ? calcHoras(d.meter_initial, d.meter_final).toFixed(1) : "—"}</td>
                      <td className="py-1.5 text-right">{d.fuel_liters || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Abastecimentos */}
        <div className="rdo-card">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-orange-500" /> Abastecimentos ({abastecimentos.length})
          </h3>
          {abastecimentos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum abastecimento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Data</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Litros</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Fonte</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Horímetro</th>
                    <th className="text-left py-1.5 font-semibold text-muted-foreground">Lubrif.</th>
                  </tr>
                </thead>
                <tbody>
                  {abastecimentos.map((a, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 pr-3">{fmtDate(a.data)}</td>
                      <td className="py-1.5 pr-3 font-bold text-orange-600">{a.litros.toFixed(1)} L</td>
                      <td className="py-1.5 pr-3 capitalize">{a.fonte}{a.comboio_fleet ? ` (${a.comboio_fleet})` : ""}</td>
                      <td className="py-1.5 pr-3">{a.horimetro || "—"}</td>
                      <td className="py-1.5">{a.lubrificado ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td className="py-1.5 font-bold">Total</td>
                    <td className="py-1.5 font-bold text-orange-600">{totalLitros.toFixed(1)} L</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Manutenções */}
        <div className="rdo-card">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-500" /> Manutenções ({ordens.length})
          </h3>
          {ordens.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma OS no período.</p>
          ) : (
            <div className="space-y-2">
              {ordens.map((o, i) => (
                <div key={i} className={`border rounded-xl p-3 text-xs ${o.status === "concluida" ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">OS #{o.numero_os} — {o.titulo}</span>
                    <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${o.status === "concluida" ? "bg-green-200 text-green-800" : "bg-orange-200 text-orange-800"}`}>{o.status}</span>
                  </div>
                  <div className="text-muted-foreground space-y-0.5">
                    <p>Tipo: {o.tipo} | Abertura: {fmtDate(o.data_abertura)}{o.data_conclusao ? ` | Conclusão: ${fmtDate(o.data_conclusao)}` : ""}</p>
                    {o.mecanico_nome && <p>Mecânico: {o.mecanico_nome}</p>}
                    {o.servico_realizado && <p>Serviço: {o.servico_realizado}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Peças trocadas */}
        {pecas.length > 0 && (
          <div className="rdo-card">
            <h3 className="font-display font-bold text-sm mb-3">🔩 Peças Trocadas ({pecas.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">OS#</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Peça</th>
                    <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Categoria</th>
                    <th className="text-right py-1.5 font-semibold text-muted-foreground">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((p, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 pr-3">#{p.os_numero}</td>
                      <td className="py-1.5 pr-3">{p.nome_peca}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{p.categoria}</td>
                      <td className="py-1.5 text-right font-medium">{p.quantidade} {p.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Checklist NCs */}
        {ncs.length > 0 && (
          <div className="rdo-card border-l-4 border-l-red-400">
            <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Itens NC no Checklist ({ncs.length})
            </h3>
            <div className="space-y-1.5">
              {ncs.map((nc, i) => (
                <div key={i} className="text-xs bg-red-50 border border-red-100 rounded-lg p-2">
                  <span className="font-bold text-red-700">{fmtDate(nc.date)}</span>
                  <span className="text-red-600"> — {nc.item_name}</span>
                  {nc.observation && <p className="text-red-500 mt-0.5">{nc.observation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .rdo-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
