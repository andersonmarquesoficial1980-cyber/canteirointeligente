import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Printer, Search, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";

type Equipment = {
  id: string;
  frota: string;
  centro_custo: string | null;
  tipo: string | null;
  placa: string | null;
  marca: string | null;
  modelo_completo: string | null;
  nome: string | null;
  serie: string | null;
  chassi: string | null;
  setor: string | null;
  condutor_atual: string | null;
  condicao: string | null;
  empresa_proprietaria: string | null;
  status: string | null;
  ano: string | number | null;
};
type Column = keyof Omit<Equipment, "id"> | "data_chegada";
const COLUNAS: { key: Column; label: string }[] = [
  { key: "frota", label: "Frota" },
  { key: "centro_custo", label: "Centro de Custo" },
  { key: "tipo", label: "Tipo" },
  { key: "placa", label: "Placa" },
  { key: "marca", label: "Marca" },
  { key: "modelo_completo", label: "Modelo" },
  { key: "nome", label: "Nome" },
  { key: "ano", label: "Ano" },
  { key: "serie", label: "Série" },
  { key: "chassi", label: "Chassi" },
  { key: "setor", label: "Equipe / Setor" },
  { key: "condutor_atual", label: "Condutor atual (cadastro)" },
  { key: "condicao", label: "Condição" },
  { key: "empresa_proprietaria", label: "Empresa proprietária" },
  { key: "status", label: "Status" },
  { key: "data_chegada", label: "Data de chegada" },
];
const SELECT = "id, frota, centro_custo, tipo, placa, marca, modelo_completo, nome, ano, serie, chassi, setor, condutor_atual, condicao, empresa_proprietaria, status";
const PAGE_SIZE = 500;
const dateBR = (date?: string) => date ? date.split("-").reverse().join("/") : "-";
const cell = (equipment: Equipment, column: Column, dates: Record<string, string>) =>
  column === "data_chegada" ? dateBR(dates[equipment.id]) : String(equipment[column] ?? "-") || "-";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);

function downloadCsv(title: string, note: string, rows: Equipment[], columns: Column[], dates: Record<string, string>) {
  const lines = [
    [title || "Relatório Personalizado de Equipamentos"],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    ...(note ? [[`Observação/Endereço: ${note}`]] : []),
    [],
    columns.map((col) => COLUNAS.find((c) => c.key === col)?.label || col),
    ...rows.map((row) => columns.map((col) => cell(row, col, dates))),
  ];
  const csv = "\uFEFF" + lines.map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `WF_Relatorio_Equipamentos_Personalizado_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printPdf(title: string, note: string, rows: Equipment[], columns: Column[], dates: Record<string, string>) {
  const win = window.open("", "_blank");
  if (!win) return;
  const header = columns.map((col) => `<th>${escapeHtml(COLUNAS.find((c) => c.key === col)?.label || col)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(cell(row, col, dates))}</td>`).join("")}</tr>`).join("");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:18px;font-size:12px}h1{font-size:16px;border-bottom:2px solid #0f172a;padding-bottom:6px}table{border-collapse:collapse;width:100%;margin-top:12px;font-size:11px}th,td{border:1px solid #d1d5db;padding:5px;text-align:left}th{background:#f3f4f6}@media print{body{padding:8px}}</style></head><body><h1>🚜 ${escapeHtml(title)}</h1><p>Gerado em: ${new Date().toLocaleString("pt-BR")}</p>${note ? `<p>Observação/Endereço: ${escapeHtml(note)}</p>` : ""}<p>Total de equipamentos: ${rows.length}</p><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioEquipamentosPersonalizado() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("TODOS");
  const [filterTeam, setFilterTeam] = useState("TODAS");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [columns, setColumns] = useState<Column[]>(["frota", "tipo", "placa", "setor"]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("Relatório Personalizado de Equipamentos");
  const [note, setNote] = useState("");

  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) { setEquipment([]); setSelected([]); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setEquipment([]);
      setSelected([]);
      try {
        const all: Equipment[] = [];
        for (let start = 0; ; start += PAGE_SIZE) {
          const { data, error: queryError } = await (supabase as any).from("equipamentos").select(SELECT)
            .eq("company_id", companyId).order("id").range(start, start + PAGE_SIZE - 1);
          if (queryError) throw queryError;
          if (cancelled) return;
          all.push(...(data || []) as Equipment[]);
          if (!data || data.length < PAGE_SIZE) break;
        }
        if (!cancelled) setEquipment(all.sort((a, b) => a.frota.localeCompare(b.frota, "pt-BR")));
      } catch (err) {
        if (!cancelled) { setError("Não foi possível carregar os equipamentos. Tente abrir o relatório novamente."); console.error("Relatório personalizado de equipamentos:", err); }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const types = useMemo(() => [...new Set(equipment.map((e) => e.tipo?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")), [equipment]);
  const teams = useMemo(() => [...new Set(equipment.map((e) => e.setor?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")), [equipment]);
  const filtered = useMemo(() => equipment.filter((e) => {
    if (!includeInactive && ["inativo", "inoperante", "devolvido"].includes((e.status || "").toLowerCase())) return false;
    if (filterType !== "TODOS" && e.tipo?.trim() !== filterType) return false;
    if (filterTeam !== "TODAS" && e.setor?.trim() !== filterTeam) return false;
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return !q || [e.frota, e.centro_custo, e.tipo, e.placa, e.marca, e.modelo_completo, e.nome, e.setor, e.empresa_proprietaria]
      .some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(q));
  }), [equipment, includeInactive, filterType, filterTeam, search]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(() => equipment.filter((e) => selectedSet.has(e.id)), [equipment, selectedSet]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedSet.has(e.id));
  const arrivalGroups = useMemo(() => {
    const counts = new Map<string, number>();
    selectedRows.forEach((e) => { const date = dates[e.id] || "sem_data"; counts.set(date, (counts.get(date) || 0) + 1); });
    return [...counts].sort(([a], [b]) => a === "sem_data" ? 1 : b === "sem_data" ? -1 : a.localeCompare(b));
  }, [selectedRows, dates]);
  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b"><div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={goBack} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
      <Tractor className="h-5 w-5 text-primary" /><h1 className="text-lg font-bold">Relatório Personalizado de Equipamentos</h1>
    </div></div>
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      <section className="bg-card rounded-xl border p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Configuração do relatório</p>
        <label className="block space-y-1"><span className="text-xs font-semibold">Buscar no cadastro</span><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Frota, placa, tipo, modelo, equipe..." className="pl-9 h-11" /></div></label>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1"><span className="text-xs font-semibold">Título do relatório</span><Input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Observação / Endereço (opcional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Filtro por tipo</span><select className="h-11 w-full px-3 bg-secondary border rounded-md text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="TODOS">Todos os tipos</option>{types.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="space-y-1"><span className="text-xs font-semibold">Filtro por equipe / setor</span><select className="h-11 w-full px-3 bg-secondary border rounded-md text-sm" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}><option value="TODAS">Todas as equipes</option>{teams.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={includeInactive ? "default" : "outline"} onClick={() => setIncludeInactive((v) => !v)}>{includeInactive ? "Mostrando inativos/devolvidos" : "Ocultar inativos/devolvidos"}</Button>
          <Button variant="outline" disabled={!filtered.length || loading || !!error} onClick={() => setSelected((prev) => allFilteredSelected ? prev.filter((id) => !filtered.some((e) => e.id === id)) : [...new Set([...prev, ...filtered.map((e) => e.id)])])}>{allFilteredSelected ? "Limpar seleção filtrada" : `Selecionar filtrados (${filtered.length})`}</Button>
          <Button variant="outline" disabled={!selected.length} onClick={() => { setSelected([]); setDates({}); }}>Limpar seleção total</Button>
          <Button variant="outline" onClick={() => { setSearch(""); setFilterType("TODOS"); setFilterTeam("TODAS"); }}>Limpar filtros</Button>
        </div>
        <div className="space-y-2"><p className="text-xs font-semibold">Colunas do relatório</p><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{COLUNAS.map(({ key, label }) => <label key={key} className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs cursor-pointer ${columns.includes(key) ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={columns.includes(key)} onChange={() => setColumns((prev) => prev.includes(key) ? prev.length === 1 ? prev : prev.filter((c) => c !== key) : [...prev, key])} /><span>{label}</span></label>)}</div><p className="text-xs text-muted-foreground">Selecione os campos que devem aparecer no relatório. A data de chegada é informada manualmente nesta lista, não altera o cadastro.</p></div>
      </section>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-card rounded-xl border p-4"><h2 className="font-semibold text-sm mb-3">Cadastro de Equipamentos ({filtered.length}) {loading && <span className="text-muted-foreground">Carregando...</span>}</h2>
          {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}
          <div className="max-h-[420px] overflow-auto space-y-2 pr-1">{!loading && !error && !filtered.length && <p className="text-sm text-muted-foreground">Nenhum equipamento encontrado com esse filtro.</p>}{filtered.map((e) => <label key={e.id} className={`border rounded-md p-3 flex items-start gap-3 cursor-pointer ${selectedSet.has(e.id) ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={selectedSet.has(e.id)} onChange={() => toggle(e.id)} className="mt-1" /><span className="min-w-0"><strong className="text-sm block truncate">{e.frota || "Sem frota"}{e.placa ? ` · ${e.placa}` : ""}</strong><small className="text-muted-foreground block truncate">{e.tipo || "Sem tipo"}{e.setor ? ` · ${e.setor}` : ""}{e.status ? ` · ${e.status}` : ""}</small></span></label>)}</div>
        </section>
        <section className="bg-card rounded-xl border p-4 space-y-3"><div className="flex items-center justify-between gap-2 flex-wrap"><h2 className="font-semibold text-sm">Selecionados ({selectedRows.length})</h2><div className="flex gap-2"><Button variant="outline" disabled={!selectedRows.length || !columns.length || loading || !!error} onClick={() => downloadCsv(title.trim(), note.trim(), selectedRows, columns, dates)}><FileSpreadsheet className="w-4 h-4 mr-2" />CSV</Button><Button variant="outline" disabled={!selectedRows.length || !columns.length || loading || !!error} onClick={() => printPdf(title.trim() || "Relatório Personalizado de Equipamentos", note.trim(), selectedRows, columns, dates)}><Printer className="w-4 h-4 mr-2" />PDF</Button></div></div>
          <p className="text-xs text-muted-foreground">Informe uma data de chegada por equipamento, se necessário.</p>
          <div className="max-h-[220px] overflow-auto space-y-2 pr-1">{!selectedRows.length && <p className="text-sm text-muted-foreground">Selecione equipamentos no painel ao lado para montar o relatório.</p>}{selectedRows.map((e) => <div key={e.id} className="border rounded-md p-3 space-y-2"><div className="flex justify-between gap-2"><span className="text-sm font-semibold">{e.frota} · {e.tipo || "Sem tipo"}</span><Button variant="ghost" size="sm" onClick={() => toggle(e.id)}>Remover</Button></div><label className="block space-y-1"><span className="text-xs text-muted-foreground">Data de chegada (opcional)</span><Input type="date" value={dates[e.id] || ""} onChange={(event) => setDates((prev) => ({ ...prev, [e.id]: event.target.value }))} className="h-9" /></label></div>)}</div>
          {!!selectedRows.length && <div><p className="text-xs font-semibold mb-2">Resumo por chegada</p><div className="grid sm:grid-cols-2 gap-2">{arrivalGroups.map(([date, count]) => <div key={date} className="border rounded-md p-2 text-xs"><strong>{date === "sem_data" ? "Sem data de chegada" : dateBR(date)}</strong><p className="text-muted-foreground">{count} equipamento(s)</p></div>)}</div></div>}
        </section>
      </div>
      {!!selectedRows.length && <section className="bg-card rounded-xl border p-4 space-y-3"><h2 className="font-semibold text-sm">Pré-visualização do relatório</h2><div className="overflow-auto"><table className="min-w-full text-sm border-collapse"><thead><tr>{columns.map((col) => <th key={col} className="text-left border-b py-2 pr-3 whitespace-nowrap">{COLUNAS.find((c) => c.key === col)?.label}</th>)}</tr></thead><tbody>{selectedRows.map((e) => <tr key={e.id} className="border-b">{columns.map((col) => <td key={col} className="py-2 pr-3 whitespace-nowrap">{cell(e, col, dates)}</td>)}</tr>)}</tbody></table></div></section>}
    </div>
  </div>;
}
