/**
 * RelatorioTransportes — Relatório de Transportes de Carreta por período
 * Rota: /relatorios/transportes?ini=...&fim=...&frota=...
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Printer, Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";
import { buildCarretaEmailReport } from "@/lib/buildEquipmentEmailReport";
import logoCi from "@/assets/logo-workflux.png";
import { Button } from "@/components/ui/button";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// description salva equipamentos como texto: "CP05" ou "PN49, CH33" ou "VAZIO"
function parseEquipamentos(desc: string | null): [string, string, string] {
  if (!desc || desc.toUpperCase() === "VAZIO") return ["", "", ""];
  const parts = desc.split(",").map(s => s.trim()).filter(Boolean);
  return [parts[0] || "", parts[1] || "", parts[2] || ""];
}

function mapEntry(row: any) {
  const [eq1, eq2, eq3] = parseEquipamentos(row.description);
  return {
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    activity: row.activity || "",
    isParada: false,
    origin: row.origin || "",
    destination: row.destination || "",
    transportOgs: row.ogs_destination || "",
    transportEquip1: eq1,
    transportEquip1Custom: "",
    transportEquip2: eq2,
    transportEquip2Custom: "",
    transportEquip3: eq3,
    transportEquip3Custom: "",
    transportObs: "",
    returnReason: "",
    returnDetails: "",
    transportInternalDetails: "",
    maintenanceDetails: "",
  };
}

export default function RelatorioTransportes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: ogsData = [] } = useOgsReference();

  const frotaParam = searchParams.get("frota") || "";
  const today = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [ini, setIni] = useState(searchParams.get("ini") || firstDay);
  const [fim, setFim] = useState(searchParams.get("fim") || today);
  const [loading, setLoading] = useState(false);
  const [diarios, setDiarios] = useState<any[]>([]);
  const [entriesByDiary, setEntriesByDiary] = useState<Record<string, any[]>>({});
  const [buscado, setBuscado] = useState(false);

  const buscar = async () => {
    setLoading(true);
    setBuscado(true);

    let query = (supabase as any)
      .from("equipment_diaries")
      .select("*")
      .eq("equipment_type", "Carreta")
      .gte("date", ini)
      .lte("date", fim)
      .order("date", { ascending: true })
      .order("equipment_fleet", { ascending: true });

    if (frotaParam && frotaParam !== "TODAS") {
      query = query.ilike("equipment_fleet", frotaParam);
    }

    const { data } = await query;
    const rows = data || [];
    setDiarios(rows);

    if (rows.length > 0) {
      const ids = rows.map((d: any) => d.id);
      const { data: entries } = await supabase
        .from("equipment_time_entries")
        .select("*")
        .in("diary_id", ids)
        .order("start_time");

      const map: Record<string, any[]> = {};
      (entries || []).forEach((e: any) => {
        if (!map[e.diary_id]) map[e.diary_id] = [];
        map[e.diary_id].push(e);
      });
      setEntriesByDiary(map);
    } else {
      setEntriesByDiary({});
    }

    setLoading(false);
  };

  // Busca automática se vier com parâmetros da URL
  useEffect(() => {
    if (searchParams.get("ini") && searchParams.get("fim")) buscar();
  }, []);

  const exportarExcel = () => {
    const linhas: string[][] = [
      ["Data", "Cavalo Mecânico", "Prancha", "Operador", "Turno",
       "KM Inicial", "KM Final", "KM Percorrido",
       "Equip. 01", "Equip. 02", "Equip. 03",
       "OGS Origem", "Endereço Origem", "OGS Destino", "Endereço Destino",
       "Horário Início", "Horário Fim", "Atividade", "Observações"]
    ];

    // Extrai número e endereço do campo raw (formato: "2534 | AV GENERAL..." ou "BASE / PÁTIO CENTRAL")
    const resolveAddr = (raw: string) => {
      if (!raw) return "";
      if (raw.toUpperCase().includes("BASE")) return "PÁTIO CENTRAL / OFICINA";
      if (raw.includes("|")) return raw.split("|").slice(1).join("|").trim(); // usa endereço já embutido
      return raw;
    };
    const resolveNum = (raw: string) => {
      if (!raw) return "";
      if (raw.toUpperCase().includes("BASE")) return "BASE";
      if (raw.includes("|")) return raw.split("|")[0].trim();
      return raw.split(" ")[0];
    };

    diarios.forEach((d: any) => {
      const entries = entriesByDiary[d.id] || [];
      const kmIni = Number(d.odometer_initial) || 0;
      const kmFin = Number(d.odometer_final) || 0;
      const kmPerc = kmFin - kmIni;
      const prancha = d.attachment_type || "";

      if (entries.length === 0) {
        linhas.push([fmtDate(d.date), d.equipment_fleet, prancha, d.operator_name, d.period,
          kmIni > 0 ? String(kmIni) : "", kmFin > 0 ? String(kmFin) : "", kmPerc > 0 ? String(kmPerc) : "",
          "", "", "", "", "", "", "", "", "", "", d.observations || ""]);
      } else {
        entries.forEach((e: any) => {
          const [eq1, eq2, eq3] = parseEquipamentos(e.description);
          const obs = "";
          linhas.push([fmtDate(d.date), d.equipment_fleet, prancha, d.operator_name, d.period,
            kmIni > 0 ? String(kmIni) : "", kmFin > 0 ? String(kmFin) : "", kmPerc > 0 ? String(kmPerc) : "",
            eq1, eq2, eq3,
            resolveNum(e.origin), resolveAddr(e.origin),
            resolveNum(e.destination), resolveAddr(e.destination),
            e.start_time || "", e.end_time || "", e.activity || "", obs]);
        });
      }
    });

    const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transportes_${ini}_a_${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPdf = (diario: any) => {
    const html = buildCarretaEmailReport({
      fleet: diario.equipment_fleet || "",
      prancha: diario.attachment_type || "",
      date: diario.date || "",
      operator: diario.operator_name || "",
      turno: diario.period || "",
      odometerInitial: String(diario.odometer_initial || ""),
      odometerFinal: String(diario.odometer_final || ""),
      timeEntries: (entriesByDiary[diario.id] || []).map(mapEntry),
      observations: diario.observations || "",
      ogsData: ogsData as any[],
    });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const frotaLabel = frotaParam && frotaParam !== "TODAS" ? frotaParam : "Todas as Carretas";

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório de Transportes</span>
          <span className="block text-[11px] text-primary-foreground/80">{frotaLabel} • {fmtDate(ini)} a {fmtDate(fim)}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          <p className="text-sm font-semibold text-foreground">Período e Frota</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Data Inicial</label>
              <input type="date" value={ini} onChange={e => setIni(e.target.value)}
                className="w-full h-10 text-sm bg-background border border-border rounded-xl px-3" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Data Final</label>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)}
                className="w-full h-10 text-sm bg-background border border-border rounded-xl px-3" />
            </div>
          </div>
          <Button onClick={buscar} disabled={loading} className="w-full h-11 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            {loading ? "Buscando..." : "Gerar Relatório"}
          </Button>
        </div>

        {/* Resultados */}
        {buscado && !loading && (
          <>
            {diarios.length === 0 ? (
              <div className="rdo-card py-8 text-center text-sm text-muted-foreground">
                Nenhum transporte encontrado no período.
              </div>
            ) : (
              <>
                {/* Botão Excel do período completo */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{diarios.length} diário{diarios.length !== 1 ? "s" : ""} encontrado{diarios.length !== 1 ? "s" : ""}</p>
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportarExcel}>
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel do Período
                  </Button>
                </div>

                {/* Lista de diários */}
                {diarios.map((d: any) => {
                  const entries = entriesByDiary[d.id] || [];
                  const kmIni = Number(d.odometer_initial) || 0;
                  const kmFin = Number(d.odometer_final) || 0;
                  return (
                    <div key={d.id} className="rdo-card space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-display font-bold text-primary">{fmtDate(d.date)} — {d.equipment_fleet}</p>
                          <p className="text-xs text-muted-foreground">{d.operator_name} • Prancha: {d.attachment_type || "—"} • Turno: {d.period}</p>
                          {(kmIni > 0 || kmFin > 0) && (
                            <p className="text-xs text-muted-foreground">
                              KM: {kmIni} → {kmFin} <span className="text-primary font-semibold">({kmFin - kmIni} km)</span>
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => exportarPdf(d)}>
                          <Printer className="w-3.5 h-3.5" /> PDF
                        </Button>
                      </div>

                      {entries.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-1.5 px-2">Atividade</th>
                                <th className="text-left py-1.5 px-2">Origem</th>
                                <th className="text-left py-1.5 px-2">Destino</th>
                                <th className="text-left py-1.5 px-2">Horário</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((e: any) => (
                                <tr key={e.id} className="border-b border-border/60 last:border-0">
                                  <td className="py-1.5 px-2">{e.activity || "—"}</td>
                                  <td className="py-1.5 px-2">{e.origin === "BASE / PÁTIO CENTRAL" ? "BASE" : (e.origin || "—")}</td>
                                  <td className="py-1.5 px-2">{e.destination === "BASE / PÁTIO CENTRAL" ? "BASE" : (e.destination || "—")}</td>
                                  <td className="py-1.5 px-2 whitespace-nowrap">{e.start_time} — {e.end_time}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
