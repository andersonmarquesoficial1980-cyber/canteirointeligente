import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, AlertTriangle, Clock, FileWarning, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSmartBack } from "@/hooks/useSmartBack";
import { toLocalISODate } from "@/lib/date-local";
import { StorageLink } from "@/components/StorageMedia";

// Regra de "no prazo" (checklist é feito ANTES de operar; nunca bloqueia o diário):
// diurno  -> enviado no próprio dia até DIURNO_LIMITE_HORA
// noturno -> enviado no próprio dia a partir de NOTURNO_INICIO_HORA (até 23:59)
const DIURNO_LIMITE_HORA = 8;
const NOTURNO_INICIO_HORA = 16;
const TZ = "America/Sao_Paulo";

type Cl = {
  id: string; equipment_fleet: string; equipment_type: string; date: string; period: string;
  operator_name: string | null; submitted_at: string; diary_id: string | null;
};
type Dy = {
  id: string; equipment_fleet: string | null; equipment_type: string | null; date: string; period: string | null;
  operator_name: string | null; work_status: string | null; preop_checklist_id: string | null;
  checklist_submitted_at: string | null; status: string | null;
};
type Nok = { preop_checklist_id: string; item_id: string; observation: string | null; photo_url: string | null };

const spParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24, hm: `${g("hour")}:${g("minute")}` };
};
const fmtDate = (d: string) => d.split("-").reverse().join("/");

function atraso(c: Cl): { onTime: boolean; label: string } {
  const s = spParts(c.submitted_at);
  const dias = Math.round((Date.parse(s.date) - Date.parse(c.date)) / 86400000);
  if (dias === 0) {
    if (c.period === "diurno" && s.hour < DIURNO_LIMITE_HORA + 1 && (s.hour < DIURNO_LIMITE_HORA || s.hm === `${String(DIURNO_LIMITE_HORA).padStart(2, "0")}:00`)) return { onTime: true, label: `no prazo (${s.hm})` };
    if (c.period === "noturno" && s.hour >= NOTURNO_INICIO_HORA) return { onTime: true, label: `no prazo (${s.hm})` };
    return { onTime: false, label: `mesmo dia, ${s.hm}` };
  }
  if (dias < 0) return { onTime: false, label: `${-dias} dia(s) antes` };
  return { onTime: false, label: `${dias} dia(s) depois, ${s.hm}` };
}

type Tab = "atrasados" | "nao_conformes" | "diario_sem" | "check_sem";

export default function GestaoFrotasChecklist() {
  const goBack = useSmartBack("/gestao-frotas");
  const [ini, setIni] = useState(() => { const n = new Date(); return toLocalISODate(new Date(n.getFullYear(), n.getMonth(), 1)); });
  const [fim, setFim] = useState(toLocalISODate());
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<Tab>("atrasados");
  const [loading, setLoading] = useState(false);
  const [cls, setCls] = useState<Cl[]>([]);
  const [dys, setDys] = useState<Dy[]>([]);
  const [noks, setNoks] = useState<Nok[]>([]);
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const fetchAll = async (table: string, select: string, apply: (q: any) => any) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await apply((supabase as any).from(table).select(select).range(from, from + 999));
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };

  const carregar = async () => {
    setLoading(true); setErro(null);
    try {
      const c = await fetchAll("equipment_preop_checklists",
        "id, equipment_fleet, equipment_type, date, period, operator_name, submitted_at, diary_id",
        (q) => q.gte("date", ini).lte("date", fim).order("date", { ascending: false }));
      const d = await fetchAll("equipment_diaries",
        "id, equipment_fleet, equipment_type, date, period, operator_name, work_status, preop_checklist_id, checklist_submitted_at, status",
        (q) => q.gte("date", ini).lte("date", fim).neq("status", "rascunho"));
      const ids = c.map((x: Cl) => x.id);
      const n: Nok[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        n.push(...(await fetchAll("equipment_preop_checklist_entries",
          "preop_checklist_id, item_id, observation, photo_url",
          (q) => q.eq("status", "nao_ok").in("preop_checklist_id", ids.slice(i, i + 100)))));
      }
      const itemIds = [...new Set(n.map((x) => x.item_id))];
      const map: Record<string, string> = {};
      if (itemIds.length) {
        const { data } = await (supabase as any).from("checklist_items_standard").select("id, item_name").in("id", itemIds);
        (data || []).forEach((i: any) => { map[i.id] = i.item_name; });
      }
      setCls(c); setDys(d); setNoks(n); setItemMap(map);
    } catch (e: any) {
      console.error("[GestaoFrotasChecklist]", e);
      setErro(e?.message || "Erro ao carregar");
    }
    setLoading(false);
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const key = (f: string | null, dt: string, p: string | null) => `${(f || "").trim().toUpperCase()}|${dt}|${p || ""}`;

  const data = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const match = (f: string | null, o: string | null) => !q || (f || "").toLowerCase().includes(q) || (o || "").toLowerCase().includes(q);

    const clKeys = new Set(cls.map((c) => key(c.equipment_fleet, c.date, c.period)));
    const clIds = new Set(cls.map((c) => c.id));
    const dyKeys = new Set(dys.map((d) => key(d.equipment_fleet, d.date, d.period)));
    const dyLinked = new Set(dys.map((d) => d.preop_checklist_id).filter(Boolean) as string[]);

    const atrasados = cls.filter((c) => match(c.equipment_fleet, c.operator_name))
      .map((c) => ({ c, a: atraso(c) })).filter((x) => !x.a.onTime);
    const noPrazo = cls.length - cls.filter((c) => atraso(c).onTime).length;

    const noksByCl = new Map<string, Nok[]>();
    noks.forEach((x) => { const a = noksByCl.get(x.preop_checklist_id) || []; a.push(x); noksByCl.set(x.preop_checklist_id, a); });
    const naoConformes = cls.filter((c) => noksByCl.has(c.id) && match(c.equipment_fleet, c.operator_name));

    // Diário de operação (Trabalhando/Em Transporte) sem checklist na chave frota+data+turno
    const diarioSem = dys.filter((d) =>
      ["Trabalhando", "Em Transporte"].includes(d.work_status || "") &&
      !d.preop_checklist_id && !d.checklist_submitted_at &&
      !clKeys.has(key(d.equipment_fleet, d.date, d.period)) && match(d.equipment_fleet, d.operator_name));

    const checkSem = cls.filter((c) => !c.diary_id && !dyLinked.has(c.id) &&
      !dyKeys.has(key(c.equipment_fleet, c.date, c.period)) && match(c.equipment_fleet, c.operator_name));

    return { atrasados, naoConformes, noksByCl, diarioSem, checkSem, totalAtrasados: noPrazo, clIds };
  }, [cls, dys, noks, busca]);

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Sem registros" }]), name);
    add("Atrasados", data.atrasados.map(({ c, a }) => ({ Data: fmtDate(c.date), Frota: c.equipment_fleet, Turno: c.period, Operador: c.operator_name || "", "Enviado em": `${fmtDate(spParts(c.submitted_at).date)} ${spParts(c.submitted_at).hm}`, Situação: a.label })));
    add("Nao conformes", data.naoConformes.flatMap((c) => (data.noksByCl.get(c.id) || []).map((x) => ({ Data: fmtDate(c.date), Frota: c.equipment_fleet, Turno: c.period, Operador: c.operator_name || "", Item: itemMap[x.item_id] || x.item_id, Observação: x.observation || "", Foto: x.photo_url ? "sim" : "não" }))));
    add("Diario sem checklist", data.diarioSem.map((d) => ({ Data: fmtDate(d.date), Frota: d.equipment_fleet, Turno: d.period, Operador: d.operator_name || "", Status: d.work_status || "" })));
    add("Checklist sem diario", data.checkSem.map((c) => ({ Data: fmtDate(c.date), Frota: c.equipment_fleet, Turno: c.period, Operador: c.operator_name || "" })));
    XLSX.writeFile(wb, `checklists_${ini}_${fim}.xlsx`);
  };

  const pctPrazo = cls.length ? Math.round(((cls.length - data.totalAtrasados) / cls.length) * 100) : 0;
  const kpis: { id: Tab; label: string; value: number; icon: any; tone: string }[] = [
    { id: "atrasados", label: "Enviados fora do prazo", value: data.atrasados.length, icon: Clock, tone: "text-amber-600" },
    { id: "nao_conformes", label: "Com NÃO CONFORME", value: data.naoConformes.length, icon: AlertTriangle, tone: "text-red-600" },
    { id: "diario_sem", label: "Operou sem checklist", value: data.diarioSem.length, icon: FileWarning, tone: "text-red-600" },
    { id: "check_sem", label: "Checklist sem diário", value: data.checkSem.length, icon: ClipboardCheck, tone: "text-blue-600" },
  ];

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={goBack} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-sm text-primary-foreground">Acompanhamento de Checklists</p>
          <p className="text-[11px] text-primary-foreground/80">Frotas • Manutenção • Pré-operação (não bloqueia o diário)</p>
        </div>
        <Button size="sm" variant="secondary" onClick={exportar} disabled={loading}><Download className="w-4 h-4 mr-1" />Excel</Button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="rdo-card grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div><label className="text-[11px] text-muted-foreground">De</label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Até</label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          <div><label className="text-[11px] text-muted-foreground">Frota ou operador</label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: CB024" /></div>
          <Button onClick={carregar} disabled={loading}>{loading ? "Carregando..." : "Buscar"}</Button>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <p className="text-xs text-muted-foreground">
          {cls.length} checklists no período • {pctPrazo}% no prazo. Prazo: diurno até {DIURNO_LIMITE_HORA}h do próprio dia; noturno no próprio dia a partir de {NOTURNO_INICIO_HORA}h.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {kpis.map((k) => (
            <button key={k.id} onClick={() => setTab(k.id)} className={`rdo-card text-left ${tab === k.id ? "ring-2 ring-primary" : ""}`}>
              <k.icon className={`w-4 h-4 ${k.tone}`} />
              <p className="text-2xl font-extrabold">{k.value}</p>
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
            </button>
          ))}
        </div>

        <div className="rdo-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground border-b">
              <th className="py-2 pr-2">Data</th><th className="pr-2">Frota</th><th className="pr-2">Turno</th><th className="pr-2">Operador</th>
              <th>{tab === "atrasados" ? "Situação" : tab === "nao_conformes" ? "Itens NÃO CONFORME" : tab === "diario_sem" ? "Status do diário" : "Enviado em"}</th>
            </tr></thead>
            <tbody>
              {tab === "atrasados" && data.atrasados.map(({ c, a }) => (
                <tr key={c.id} className="border-b"><td className="py-1.5 pr-2">{fmtDate(c.date)}</td><td className="pr-2 font-semibold">{c.equipment_fleet}</td><td className="pr-2">{c.period}</td><td className="pr-2">{c.operator_name || "—"}</td><td>{a.label}</td></tr>
              ))}
              {tab === "nao_conformes" && data.naoConformes.map((c) => (
                <tr key={c.id} className="border-b align-top"><td className="py-1.5 pr-2">{fmtDate(c.date)}</td><td className="pr-2 font-semibold">{c.equipment_fleet}</td><td className="pr-2">{c.period}</td><td className="pr-2">{c.operator_name || "—"}</td>
                  <td className="space-y-1">{(data.noksByCl.get(c.id) || []).map((x, i) => (
                    <div key={i}>• {itemMap[x.item_id] || x.item_id}{x.observation ? ` — ${x.observation}` : ""} {x.photo_url ? <StorageLink href={x.photo_url} target="_blank" rel="noreferrer" className="text-primary underline">foto</StorageLink> : <span className="text-red-600">(sem foto)</span>}</div>
                  ))}</td></tr>
              ))}
              {tab === "diario_sem" && data.diarioSem.map((d) => (
                <tr key={d.id} className="border-b"><td className="py-1.5 pr-2">{fmtDate(d.date)}</td><td className="pr-2 font-semibold">{d.equipment_fleet}</td><td className="pr-2">{d.period}</td><td className="pr-2">{d.operator_name || "—"}</td><td>{d.work_status}</td></tr>
              ))}
              {tab === "check_sem" && data.checkSem.map((c) => (
                <tr key={c.id} className="border-b"><td className="py-1.5 pr-2">{fmtDate(c.date)}</td><td className="pr-2 font-semibold">{c.equipment_fleet}</td><td className="pr-2">{c.period}</td><td className="pr-2">{c.operator_name || "—"}</td><td>{fmtDate(spParts(c.submitted_at).date)} {spParts(c.submitted_at).hm}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
