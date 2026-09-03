import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, XCircle, Clock3, ListChecks, FileSpreadsheet, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";

interface Pendencia {
  id: string;
  employee_id: string;
  tipo: "classificacao" | "aumento_salarial" | "demissao" | "substituicao";
  status: "aberta" | "em_analise" | "aprovada" | "reprovada" | "cancelada";
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  justificativa: string;
  data_efetiva: string | null;
  payload: Record<string, any> | null;
  parecer_gp: string | null;
  motivo_reprovacao: string | null;
  solicitado_por_nome: string | null;
  created_at: string;
  employee?: { name?: string | null; matricula?: string | null; role?: string | null } | null;
}

const TIPO_LABEL: Record<Pendencia["tipo"], string> = {
  classificacao: "Classificação",
  aumento_salarial: "Aumento Salarial",
  demissao: "Demissão",
  substituicao: "Substituição",
};

const STATUS_LABEL: Record<Pendencia["status"], string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  cancelada: "Cancelada",
};

const STATUS_BADGE: Record<Pendencia["status"], string> = {
  aberta: "bg-yellow-100 text-yellow-700 border-yellow-300",
  em_analise: "bg-blue-100 text-blue-700 border-blue-300",
  aprovada: "bg-green-100 text-green-700 border-green-300",
  reprovada: "bg-red-100 text-red-700 border-red-300",
  cancelada: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function exportarCsvPendencias(rows: Pendencia[]) {
  const headers = [
    "Funcionário",
    "Matrícula",
    "Função",
    "Tipo",
    "Status",
    "Prioridade",
    "Data efetiva",
    "Aberta em",
    "Solicitado por",
    "Justificativa",
    "Nova classificação",
    "Novo salário",
    "Tipo demissão",
    "Substituto sugerido",
    "Parecer GP",
    "Motivo reprovação",
  ];

  const lines = [
    headers,
    ...rows.map((p) => [
      p.employee?.name || "",
      p.employee?.matricula || "",
      p.employee?.role || "",
      TIPO_LABEL[p.tipo],
      STATUS_LABEL[p.status],
      p.prioridade.toUpperCase(),
      fmtDate(p.data_efetiva),
      new Date(p.created_at).toLocaleString("pt-BR"),
      p.solicitado_por_nome || "",
      p.justificativa || "",
      p.payload?.classificacao_nova || "",
      p.payload?.novo_salario != null
        ? Number(p.payload.novo_salario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
      p.payload?.tipo_demissao || "",
      p.payload?.substituto_sugerido || "",
      p.parecer_gp || "",
      p.motivo_reprovacao || "",
    ]),
  ];

  const csv = "\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_Pendencias_Funcionarios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function imprimirPendencias(rows: Pendencia[]) {
  const htmlRows = rows
    .map((p) => {
      const detalhe =
        p.tipo === "classificacao"
          ? `Nova classificação: ${String(p.payload?.classificacao_nova || "—")}`
          : p.tipo === "aumento_salarial"
          ? `Novo salário: R$ ${
              p.payload?.novo_salario != null
                ? Number(p.payload.novo_salario).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"
            }`
          : p.tipo === "demissao"
          ? `Tipo demissão: ${String(p.payload?.tipo_demissao || "—")}`
          : `Substituto sugerido: ${String(p.payload?.substituto_sugerido || "—")}`;

      return `<tr>
        <td>${String(p.employee?.name || "—")}</td>
        <td>${String(p.employee?.matricula || "—")}</td>
        <td>${TIPO_LABEL[p.tipo]}</td>
        <td>${STATUS_LABEL[p.status]}</td>
        <td>${p.prioridade.toUpperCase()}</td>
        <td>${fmtDate(p.data_efetiva)}</td>
        <td>${new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
        <td>${String(p.solicitado_por_nome || "—")}</td>
        <td>${String(p.justificativa || "—")}</td>
        <td>${detalhe}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pendências de Funcionários</title>
  <style>
    body{font-family:Arial,sans-serif;padding:16px;color:#111827}
    h1{font-size:16px;margin:0 0 8px 0}
    p{font-size:12px;color:#374151;margin:0 0 12px 0}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:6px;text-align:left;vertical-align:top}
    th{background:#f3f4f6}
  </style></head><body>
  <h1>Pendências de Funcionários</h1>
  <p>Gerado em ${new Date().toLocaleString("pt-BR")} · Total: ${rows.length}</p>
  <table>
    <thead>
      <tr><th>Funcionário</th><th>Matrícula</th><th>Tipo</th><th>Status</th><th>Prioridade</th><th>Data efetiva</th><th>Abertura</th><th>Solicitado por</th><th>Justificativa</th><th>Detalhe</th></tr>
    </thead>
    <tbody>${htmlRows}</tbody>
  </table>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export default function GestaoPessoasPendencias() {
  const goBack = useSmartBack("/gestao-pessoas");
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { isAdmin } = useIsAdmin();

  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<"aberta" | "em_analise" | "aprovada" | "reprovada" | "cancelada" | "todas">("todas");
  const [busca, setBusca] = useState("");

  const podeTramitar = isAdmin || ["Administrador", "Gerente", "RH", "Gestão de Pessoas"].includes(String(profile?.perfil || ""));

  async function carregar() {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let query = (supabase as any)
        .from("rh_pendencias_funcionario")
        .select("*, employee:employees(name, matricula, role)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFiltro !== "todas") query = query.eq("status", statusFiltro);

      const { data, error } = await query;
      if (error) throw error;
      setItens((data || []) as Pendencia[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar pendências", description: err?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [profile?.company_id, statusFiltro]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((p) => {
      const nome = String(p.employee?.name || "").toLowerCase();
      const matricula = String(p.employee?.matricula || "").toLowerCase();
      const tipo = TIPO_LABEL[p.tipo].toLowerCase();
      return nome.includes(q) || matricula.includes(q) || tipo.includes(q);
    });
  }, [itens, busca]);

  async function tramitar(p: Pendencia, novo: Pendencia["status"]) {
    if (!podeTramitar) return;
    const comentario = novo === "reprovada"
      ? window.prompt("Motivo da reprovação:", p.motivo_reprovacao || "")
      : window.prompt("Observação da tramitação (opcional):", p.parecer_gp || "");

    if (novo === "reprovada" && !comentario?.trim()) {
      toast({ title: "Motivo da reprovação é obrigatório", variant: "destructive" });
      return;
    }

    const payload: Record<string, any> = {
      status: novo,
      parecer_gp: comentario?.trim() || null,
    };
    if (novo === "reprovada") payload.motivo_reprovacao = comentario?.trim();
    if (["aprovada", "reprovada", "cancelada"].includes(novo)) {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = profile?.user_id || null;
    }

    try {
      const { error } = await (supabase as any).from("rh_pendencias_funcionario").update(payload).eq("id", p.id);
      if (error) throw error;
      toast({ title: `Pendência ${STATUS_LABEL[novo].toLowerCase()} com sucesso` });
      await carregar();
    } catch (err: any) {
      toast({ title: "Erro ao tramitar pendência", description: err?.message || "Tente novamente", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Pendências de Funcionários</h1>
          <p className="text-[10px] text-primary-foreground/70">Fila para Gestão de Pessoas</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, matrícula ou tipo..."
            className="md:col-span-2 h-10 rounded-xl border border-border bg-secondary px-3 text-sm"
          />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm"
          >
            <option value="todas">Todos status</option>
            <option value="aberta">Abertas</option>
            <option value="em_analise">Em análise</option>
            <option value="aprovada">Aprovadas</option>
            <option value="reprovada">Reprovadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportarCsvPendencias(filtrados)}
            disabled={filtrados.length === 0}
            className="text-xs border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
          </button>
          <button
            onClick={() => imprimirPendencias(filtrados)}
            disabled={filtrados.length === 0}
            className="text-xs border border-indigo-300 text-indigo-700 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          <button
            onClick={carregar}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted"
          >
            Atualizar
          </button>
        </div>

        {loading && <p className="text-sm text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando...</p>}

        {!loading && filtrados.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <ListChecks className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma pendência encontrada.</p>
          </div>
        )}

        {!loading && filtrados.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{p.employee?.name || "Funcionário"} <span className="text-muted-foreground">· Mat. {p.employee?.matricula || "—"}</span></p>
                <p className="text-xs text-muted-foreground">{p.employee?.role || "—"}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
              <span>Tipo: <strong className="text-foreground">{TIPO_LABEL[p.tipo]}</strong></span>
              <span>Prioridade: <strong className="text-foreground">{p.prioridade.toUpperCase()}</strong></span>
              <span>Data efetiva: <strong className="text-foreground">{fmtDate(p.data_efetiva)}</strong></span>
              <span>Criada: <strong className="text-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</strong></span>
            </div>

            <p className="text-sm">{p.justificativa}</p>

            {p.tipo === "classificacao" && p.payload?.classificacao_nova && (
              <p className="text-xs">Nova classificação: <strong>{String(p.payload.classificacao_nova)}</strong></p>
            )}
            {p.tipo === "aumento_salarial" && p.payload?.novo_salario != null && (
              <p className="text-xs">Novo salário: <strong>R$ {Number(p.payload.novo_salario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            )}
            {p.tipo === "demissao" && p.payload?.tipo_demissao && (
              <p className="text-xs">Tipo demissão: <strong>{String(p.payload.tipo_demissao)}</strong></p>
            )}
            {p.tipo === "substituicao" && p.payload?.substituto_sugerido && (
              <p className="text-xs">Substituto sugerido: <strong>{String(p.payload.substituto_sugerido)}</strong></p>
            )}

            {p.parecer_gp && <p className="text-xs text-muted-foreground">Parecer GP: {p.parecer_gp}</p>}
            {p.motivo_reprovacao && <p className="text-xs text-red-600">Motivo reprovação: {p.motivo_reprovacao}</p>}

            {podeTramitar && (p.status === "aberta" || p.status === "em_analise") && (
              <div className="flex flex-wrap gap-2 pt-1">
                {p.status === "aberta" && (
                  <button onClick={() => tramitar(p, "em_analise")} className="text-[11px] px-2.5 py-1 rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 inline-flex items-center gap-1">
                    <Clock3 className="w-3 h-3" /> Em análise
                  </button>
                )}
                <button onClick={() => tramitar(p, "aprovada")} className="text-[11px] px-2.5 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aprovar
                </button>
                <button onClick={() => tramitar(p, "reprovada")} className="text-[11px] px-2.5 py-1 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Reprovar
                </button>
                <button onClick={() => tramitar(p, "cancelada")} className="text-[11px] px-2.5 py-1 rounded border border-zinc-300 text-zinc-700 bg-zinc-50 hover:bg-zinc-100">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
