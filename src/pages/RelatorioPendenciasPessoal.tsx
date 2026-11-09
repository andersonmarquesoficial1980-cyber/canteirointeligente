import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import type { PendenciaQuadro } from "@/lib/quadroPendencias";
import {
  CATEGORIAS, PRIORIDADE_ROTULO, STATUS_ROTULO, categoriaPendencia, detalhePendencia, escHtml, filtrarPendencias, fmtData,
  rotuloCategoria, type CategoriaPendencia, type FiltrosPendencias, type LinhaPendencia,
} from "@/lib/relatorioPendenciasPessoal";

type Emp = { id: string; name: string; role: string | null; equipe: string | null; status: string | null; matricula: string | null; cpf: string | null; centro_custo: string | null; data_admissao: string | null };

const HEADERS = ["Matrícula", "Nome", "CPF", "Função", "Equipe", "Centro de custo", "Admissão", "Pendência", "Detalhe", "Motivo", "Prioridade", "Status", "Data prevista", "Solicitado por", "Registrado em"];

function montarLinha(l: LinhaPendencia & { emp?: Emp }): string[] {
  const e = l.emp as Emp | undefined; const p = l.p;
  return [e?.matricula || "-", e?.name || "(funcionário não encontrado)", e?.cpf || "-", e?.role || "-", e?.equipe?.trim() || "Sem equipe", e?.centro_custo || "-",
    fmtData(e?.data_admissao), rotuloCategoria(categoriaPendencia(p)), detalhePendencia(p) || "-", p.justificativa || "-",
    PRIORIDADE_ROTULO[p.prioridade] || p.prioridade, STATUS_ROTULO[p.status] || p.status, fmtData(p.data_efetiva), p.solicitado_por_nome || "-", fmtData(p.created_at)];
}

function tituloAuto(f: FiltrosPendencias) {
  if (f.categorias.length === 1) return `Pendências de Pessoal — ${rotuloCategoria(f.categorias[0])}`;
  return "Pendências de Pessoal";
}

function exportCsv(titulo: string, obs: string, linhas: (LinhaPendencia & { emp?: Emp })[]) {
  const out: string[][] = [[titulo], [`Gerado em: ${new Date().toLocaleString("pt-BR")}`]];
  if (obs.trim()) out.push([`Observação: ${obs.trim()}`]);
  out.push([], HEADERS, ...linhas.map(montarLinha));
  const csv = "\uFEFF" + out.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `WF_Pendencias_Pessoal_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

function exportPdf(titulo: string, obs: string, linhas: (LinhaPendencia & { emp?: Emp })[]) {
  const cols = [0, 1, 3, 7, 8, 9, 10, 12]; // colunas do PDF (equipe vira cabeçalho de grupo)
  const grupos = new Map<string, string[][]>();
  linhas.forEach((l) => { const r = montarLinha(l); (grupos.get(r[4]) || grupos.set(r[4], []).get(r[4])!).push(r); });
  const nomes = [...grupos.keys()].sort((a, b) => (a === "Sem equipe" ? -1 : b === "Sem equipe" ? 1 : a.localeCompare(b, "pt-BR")));
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(titulo)}</title><style>
    @page{size:A4 landscape;margin:10mm}
    body{font-family:Arial,sans-serif;color:#111827;font-size:11px}
    h1{font-size:16px;border-bottom:2px solid #0f172a;padding-bottom:6px;margin:0 0 8px}
    h2{font-size:12px;margin:14px 0 4px;background:#f3f4f6;padding:4px 6px}
    p{margin:3px 0;color:#374151}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th,td{border:1px solid #d1d5db;padding:4px 5px;text-align:left;vertical-align:top}
    th{background:#e5e7eb} tr{page-break-inside:avoid}
  </style></head><body><h1>${escHtml(titulo)}</h1>
  <p><strong>Gerado em:</strong> ${escHtml(new Date().toLocaleString("pt-BR"))} &nbsp; <strong>Total:</strong> ${linhas.length}</p>
  ${obs.trim() ? `<p><strong>Observação:</strong> ${escHtml(obs.trim())}</p>` : ""}`;
  nomes.forEach((n) => {
    const rs = grupos.get(n)!;
    html += `<h2>${escHtml(n)} (${rs.length})</h2><table><tr>${cols.map((c) => `<th>${HEADERS[c]}</th>`).join("")}</tr>`;
    rs.forEach((r) => { html += `<tr>${cols.map((c) => `<td>${escHtml(r[c])}</td>`).join("")}</tr>`; });
    html += "</table>";
  });
  html += "</body></html>";
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
}

export default function RelatorioPendenciasPessoal() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pend, setPend] = useState<PendenciaQuadro[]>([]);
  const [emps, setEmps] = useState<Record<string, Emp>>({});
  const [f, setF] = useState<FiltrosPendencias>({ categorias: [], status: ["aberta", "em_analise"], equipe: "TODAS", funcao: "TODAS", prioridade: "TODAS", de: "", ate: "" });
  const [titulo, setTitulo] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    const companyId = profile?.company_id; if (!companyId) return;
    (async () => {
      setLoading(true); setErro(null);
      try {
        const { data, error, count } = await (supabase as any).from("rh_pendencias_funcionario")
          .select("id, employee_id, tipo, status, prioridade, justificativa, data_efetiva, payload, solicitado_por_nome, created_at", { count: "exact" })
          .eq("company_id", companyId).order("created_at", { ascending: false }).range(0, 4999);
        if (error) throw error;
        if (count != null && count > (data || []).length) throw new Error(`Foram carregadas ${(data || []).length} de ${count} pendências; refine o período.`);
        const lista = (data || []) as PendenciaQuadro[];
        const ids = Array.from(new Set(lista.map((p) => p.employee_id)));
        const mapa: Record<string, Emp> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const { data: es, error: e2 } = await supabase.from("employees")
            .select("id, name, role, equipe, status, matricula, cpf, centro_custo, data_admissao").eq("company_id", companyId).in("id", ids.slice(i, i + 200));
          if (e2) throw e2;
          (es || []).forEach((e: any) => { mapa[e.id] = e as Emp; });
        }
        setPend(lista); setEmps(mapa);
      } catch (e: any) { setErro(e?.message || "Falha ao carregar pendências"); setPend([]); }
      finally { setLoading(false); }
    })();
  }, [profile?.company_id]);

  const todas = useMemo(() => pend.map((p) => ({ p, emp: emps[p.employee_id] })), [pend, emps]);
  const equipes = useMemo(() => Array.from(new Set(Object.values(emps).map((e) => (e.equipe || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [emps]);
  const funcoes = useMemo(() => Array.from(new Set(Object.values(emps).map((e) => (e.role || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [emps]);
  const linhas = useMemo(() => filtrarPendencias(todas, f).sort((a, b) => (a.emp?.name || "").localeCompare(b.emp?.name || "", "pt-BR")), [todas, f]);
  const contagem = useMemo(() => { const c: Partial<Record<CategoriaPendencia, number>> = {}; filtrarPendencias(todas, { ...f, categorias: [] }).forEach(({ p }) => { const k = categoriaPendencia(p); c[k] = (c[k] || 0) + 1; }); return c; }, [todas, f]);
  const tituloFinal = titulo.trim() || tituloAuto(f);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">Pendências de Pessoal</h1>
            <p className="text-sm text-muted-foreground">Marcações do Quadro de Equipes (demitir, classificar, alocar…). Relatório somente de leitura, para enviar ao RH.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Tipo de pendência (vazio = todas)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => (
                <button key={c.id} type="button" onClick={() => setF({ ...f, categorias: toggle(f.categorias, c.id) })}
                  className={`px-3 py-1.5 rounded-full border text-sm ${f.categorias.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}>
                  {c.rotulo} <span className="opacity-70">({contagem[c.id] || 0})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_ROTULO).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setF({ ...f, status: toggle(f.status, k) })}
                  className={`px-3 py-1 rounded-full border text-sm ${f.status.includes(k) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}>{v}</button>
              ))}
              <span className="text-xs text-muted-foreground self-center">Padrão: abertas e em análise</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <label className="text-xs">Equipe<select className={`${sel} w-full`} value={f.equipe} onChange={(e) => setF({ ...f, equipe: e.target.value })}>
              <option value="TODAS">Todas</option><option value="__sem__">Sem equipe</option>{equipes.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
            <label className="text-xs">Função<select className={`${sel} w-full`} value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })}>
              <option value="TODAS">Todas</option>{funcoes.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
            <label className="text-xs">Prioridade<select className={`${sel} w-full`} value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>
              <option value="TODAS">Todas</option>{Object.entries(PRIORIDADE_ROTULO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-xs">Registrada de<Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
            <label className="text-xs">até<Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs">Título do relatório<Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tituloAuto(f)} /></label>
            <label className="text-xs">Observação (aparece no cabeçalho)<Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Enviar ao RH até sexta" /></label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{loading ? "Carregando…" : `${linhas.length} pendência(s)`}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={!linhas.length} onClick={() => exportCsv(tituloFinal, obs, linhas as any)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel (CSV)</Button>
            <Button disabled={!linhas.length} onClick={() => exportPdf(tituloFinal, obs, linhas as any)}><Printer className="h-4 w-4 mr-1" />PDF</Button>
          </div>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted"><tr>{HEADERS.map((h) => <th key={h} className="text-left p-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.p.id} className="border-t border-border align-top">
                  {montarLinha(l as any).map((c, i) => <td key={i} className={`p-2 ${i === 9 ? "min-w-[220px]" : ""}`}>{c}</td>)}
                </tr>
              ))}
              {!loading && !linhas.length && <tr><td colSpan={HEADERS.length} className="p-6 text-center text-muted-foreground">Nenhuma pendência para estes filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
