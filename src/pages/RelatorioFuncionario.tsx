import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, User, FileSpreadsheet, Printer } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface ResultRow {
  nome: string;
  matricula: string | null;
  data: string;
  obra_nome: string;
  encarregado: string | null;
  funcao: string | null;
  entrada: string | null;
  saida: string | null;
  turno: string | null;
  clima: string | null;
  contratante: string | null;
  local: string | null;
  equipe: string | null;
  responsavel: string | null;
  preenchido_por: string | null;
  tipo_rdo: string | null;
  rdo_id: string;
  origem_horario: string;
  alertas: string[];
}

type FilterType = "funcionario" | "funcao" | "obra" | "encarregado";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const norm = (v: string | null | undefined) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const splitNomes = (v: string | null | undefined) =>
  (v || "").split("|||").map(n => n.trim()).filter(Boolean);
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COLS_HEAD = ["Data", "Funcionário", "Matrícula", "Função", "OGS", "Contratante", "Local", "Equipe", "Encarregado", "Responsável", "Preenchido por", "Turno", "Entrada", "Saída", "Origem do horário", "Alertas", "Status"];
const rowCells = (r: ResultRow) => [
  fmtDate(r.data), r.nome || "-", r.matricula || "-", r.funcao || "-",
  r.obra_nome || "-", r.contratante || "-", r.local || "-", r.equipe || "-",
  r.encarregado || "-", r.responsavel || "-", r.preenchido_por || "-", r.turno || "-",
  hhmm(r.entrada) || "-", hhmm(r.saida) || "-", r.origem_horario || "-",
  r.alertas.join("; ") || "-", r.clima || "Trabalhou",
];

function exportarExcel(filterLabel: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  const linhas: string[][] = [];
  linhas.push(["Localização de Funcionários (RDO)"]);
  linhas.push([`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`]);
  linhas.push([`Filtro: ${filterLabel}`]);
  linhas.push([]);
  linhas.push(COLS_HEAD);
  rows.forEach(r => linhas.push(rowCells(r)));
  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_FuncionariosRdo_${dataIni || "inicio"}_a_${dataFim || "fim"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarPdf(filterLabel: string, dataIni: string, dataFim: string, rows: ResultRow[]) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Localização de Funcionários (RDO)</title><style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:Arial,sans-serif;padding:12px;color:#333;font-size:10px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px;font-size:15px}
    .period{font-size:10px;color:#666;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:9px}
    th,td{border:1px solid #d1d5db;padding:3px 5px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    .al{color:#b45309;font-weight:600}
    .note{font-size:9px;color:#666;margin-top:6px}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>Localização de Funcionários (RDO)</h1>
  <p class="period"><strong>Período:</strong> ${fmtDate(dataIni)} a ${fmtDate(dataFim)}</p>
  <p class="period"><strong>Filtro:</strong> ${esc(filterLabel)} | <strong>Total:</strong> ${rows.length} registros</p>
  <table><tr>${["Data", "Funcionário", "Função", "OGS", "Equipe", "Encarregado", "Preenchido por", "Turno", "Entrada", "Saída", "Origem do horário", "Alertas"].map(h => `<th>${h}</th>`).join("")}</tr>`;
  rows.forEach(r => {
    html += `<tr><td>${fmtDate(r.data)}</td><td>${esc(r.nome || "-")}${r.matricula ? ` (${esc(r.matricula)})` : ""}</td><td>${esc(r.funcao || "-")}</td>
      <td>${esc(r.obra_nome || "-")}</td><td>${esc(r.equipe || "-")}</td><td>${esc(r.encarregado || "-")}</td>
      <td>${esc(r.preenchido_por || "-")}</td><td>${esc(r.turno || "-")}</td><td>${hhmm(r.entrada) || "-"}</td><td>${hhmm(r.saida) || "-"}</td>
      <td>${esc(r.origem_horario)}</td><td class="al">${esc(r.alertas.join("; ") || "-")}</td></tr>`;
  });
  html += `</table><p class="note">Horários conforme informado pelo apontador no RDO. "Padrão do RDO" = todos do RDO com o mesmo horário; "Individual" = horário diferente dentro do mesmo RDO.</p></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioFuncionario() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();

  const [filterType, setFilterType] = useState<FilterType>("funcionario");

  // Por Funcionário
  const [busca, setBusca] = useState("");
  const [cadastro, setCadastro] = useState<{ id: string; name: string; matricula: string | null }[]>([]);

  // Por Função
  const [funcao, setFuncao] = useState("");
  const [nome, setNome] = useState("");
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [nomesSelecionaveis, setNomesSelecionaveis] = useState<string[]>([]);
  const [loadingFuncoes, setLoadingFuncoes] = useState(false);
  const [loadingNomes, setLoadingNomes] = useState(false);

  // Por Obra / Por Encarregado
  const [obra, setObra] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [obras, setObras] = useState<string[]>([]);
  const [encarregados, setEncarregados] = useState<string[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const [messageNoData, setMessageNoData] = useState("");

  // Autocomplete de funcionários (cadastro único)
  useEffect(() => {
    if (filterType !== "funcionario" || !profile?.company_id || cadastro.length > 0) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("employees")
        .select("id, name, matricula")
        .eq("company_id", profile.company_id!)
        .order("name");
      setCadastro((data || []).filter((e: any) => e.name));
    })();
  }, [filterType, profile?.company_id, cadastro.length]);

  // Carregar funções disponíveis — busca da tabela funcoes (cadastro oficial)
  useEffect(() => {
    if (filterType !== "funcao" || !profile?.company_id) return;
    const load = async () => {
      setLoadingFuncoes(true);
      try {
        // Busca apenas funções que têm pelo menos 1 funcionário ativo vinculado à empresa
        const { data } = await (supabase as any)
          .from("funcoes")
          .select("nome, employees!inner(company_id, funcao_id)")
          .eq("employees.company_id", profile.company_id!)
          .not("nome", "is", null);
        const unique = Array.from(new Set((data || []).map((d: any) => d.nome).filter(Boolean))).sort() as string[];
        setFuncoes(unique);
      } catch (err) {
        console.error("Erro ao carregar funções:", err);
      } finally {
        setLoadingFuncoes(false);
      }
    };
    load();
  }, [filterType, profile?.company_id]);

  // Carregar nomes quando função é selecionada
  useEffect(() => {
    if (!funcao || filterType !== "funcao" || !profile?.company_id) return;
    const load = async () => {
      setLoadingNomes(true);
      setNome("");
      try {
        const { data } = await (supabase as any)
          .from("rdo_efetivo")
          .select("nome, rdo_diarios!inner(company_id, status_validacao)")
          .eq("funcao", funcao)
          .eq("rdo_diarios.company_id", profile.company_id!)
          .neq("rdo_diarios.status_validacao", "rascunho")
          .not("nome", "is", null);
        // Split por ||| para não mostrar nomes compostos no dropdown
        const allNomes = (data || []).flatMap((d: any) =>
          (d.nome || "").split("|||").map((n: string) => n.trim()).filter(Boolean)
        );
        const unique = Array.from(new Set(allNomes)).sort() as string[];
        setNomesSelecionaveis(unique);
      } catch (err) {
        console.error("Erro ao carregar nomes:", err);
      } finally {
        setLoadingNomes(false);
      }
    };
    load();
  }, [funcao, filterType, profile?.company_id]);

  // Carregar obras ou encarregados
  useEffect(() => {
    if (!profile?.company_id) return;
    if (filterType !== "obra" && filterType !== "encarregado") return;
    const load = async () => {
      setLoadingDropdowns(true);
      try {
        if (filterType === "obra") {
          const { data } = await supabase
            .from("rdo_diarios")
            .select("obra_nome")
            .eq("company_id", profile.company_id!)
            .or("status_validacao.is.null,status_validacao.neq.rascunho")
            .not("obra_nome", "is", null)
            .order("obra_nome", { ascending: true });
          const unique = Array.from(new Map((data || []).map((d: any) => [d.obra_nome, d])).values()).map((d: any) => d.obra_nome) as string[];
          setObras(unique);
        } else {
          const { data } = await supabase
            .from("rdo_diarios")
            .select("encarregado")
            .eq("company_id", profile.company_id!)
            .or("status_validacao.is.null,status_validacao.neq.rascunho")
            .not("encarregado", "is", null)
            .order("encarregado", { ascending: true });
          const unique = Array.from(new Map((data || []).map((d: any) => [d.encarregado, d])).values()).map((d: any) => d.encarregado) as string[];
          setEncarregados(unique);
        }
      } catch (err) {
        console.error("Erro ao carregar dropdown:", err);
      } finally {
        setLoadingDropdowns(false);
      }
    };
    load();
  }, [filterType, profile?.company_id]);

  const isValid = () => {
    if (filterType === "funcionario") return busca.trim().length >= 3;
    if (filterType === "funcao") return funcao.trim().length > 0;
    if (filterType === "obra") return obra.trim().length > 0;
    if (filterType === "encarregado") return encarregado.trim().length > 0;
    return false;
  };

  const getFilterLabel = () => {
    if (filterType === "funcionario") return `Funcionário: ${busca}`;
    if (filterType === "funcao") return `Função: ${funcao}${nome ? ` | ${nome}` : " (todos)"}`;
    if (filterType === "obra") return `Obra: ${obra}`;
    return `Encarregado: ${encarregado}`;
  };

  const buscar = async () => {
    if (!isValid() || !profile?.company_id) return;

    setLoading(true);
    setSearched(true);
    setMessageNoData("");

    try {
      let rdoIds: string[] = [];
      let rdoMap: Record<string, any> = {};

      if (filterType === "funcionario") {
        const termo = busca.trim();
        const alvo = cadastro.find(e => norm(e.name) === norm(termo) || (e.matricula && norm(e.matricula) === norm(termo)));
        const nomeAlvo = norm(alvo ? alvo.name : termo);
        const matAlvo = alvo?.matricula ? norm(alvo.matricula) : (/^\d+$/.test(termo) ? norm(termo) : "");
        const orParts = [`nome.ilike.%${(alvo ? alvo.name : termo).replace(/[,()%]/g, " ")}%`];
        if (alvo) orParts.push(`employee_id.eq.${alvo.id}`);
        if (matAlvo) orParts.push(`matricula.ilike.%${matAlvo}%`);

        let q = (supabase as any)
          .from("rdo_efetivo")
          .select("nome, funcao, entrada, saida, matricula, employee_id, rdo_id, rdo_diarios!inner(id, data, obra_nome, encarregado, turno, clima, equipe, responsavel, preenchido_por, tipo_rdo, company_id, status_validacao)")
          .eq("rdo_diarios.company_id", profile.company_id!)
          .neq("rdo_diarios.status_validacao", "rascunho")
          .or(orParts.join(","));
        if (dataIni) q = q.gte("rdo_diarios.data", dataIni);
        if (dataFim) q = q.lte("rdo_diarios.data", dataFim);
        const { data, error } = await q.limit(5000);
        if (error) throw error;

        let result: ResultRow[] = [];
        (data || []).forEach((r: any) => {
          const nomes = splitNomes(r.nome);
          const mats = (r.matricula || "").split("|||").map((m: string) => m.trim());
          // Match exato por nome (sem acento/caixa), por employee_id ou matrícula; termo livre = contém
          let idx = nomes.findIndex(n => (alvo ? norm(n) === nomeAlvo : norm(n).includes(nomeAlvo)));
          const porId = !!alvo && r.employee_id === alvo.id;
          const porMat = !!matAlvo && mats.some((m: string) => norm(m) === matAlvo);
          if (idx < 0 && !porId && !porMat) return;
          if (idx < 0) idx = 0;
          const nomeFinal = nomes[idx] || (alvo?.name ?? "");
          // Só uma pessoa casa por linha; para termo livre, listar todas as que casam
          const indices = alvo ? [idx] : nomes.map((n, i) => (norm(n).includes(nomeAlvo) ? i : -1)).filter(i => i >= 0);
          (indices.length ? indices : [idx]).forEach(i => {
            result.push({
              nome: nomes[i] || nomeFinal,
              matricula: mats[i] || (nomes.length === 1 ? (r.matricula || null) : null),
              data: r.rdo_diarios?.data || "",
              obra_nome: r.rdo_diarios?.obra_nome || "",
              encarregado: r.rdo_diarios?.encarregado || null,
              funcao: r.funcao || null,
              entrada: r.entrada || null,
              saida: r.saida || null,
              turno: r.rdo_diarios?.turno || null,
              clima: r.rdo_diarios?.clima || null,
              contratante: null,
              local: null,
              equipe: r.rdo_diarios?.equipe || null,
              responsavel: r.rdo_diarios?.responsavel || null,
              preenchido_por: r.rdo_diarios?.preenchido_por || null,
              tipo_rdo: r.rdo_diarios?.tipo_rdo || null,
              rdo_id: r.rdo_id,
              origem_horario: "",
              alertas: [],
            });
          });
        });

        result = await finalizar(result, profile.company_id!);

        // Alocações manuais do Programador (quem não está em RDO no dia)
        try {
          let ids: string[] = alvo ? [alvo.id] : cadastro.filter(e => norm(e.name).includes(nomeAlvo)).map(e => e.id).slice(0, 50);
          if (ids.length > 0) {
            let aq = (supabase as any).from("alocacao_diaria")
              .select("data, tipo, ogs_number, entrada, saida, observacao, id, employees(name, matricula, equipe, funcoes(nome))")
              .eq("company_id", profile.company_id!).in("employee_id", ids);
            if (dataIni) aq = aq.gte("data", dataIni);
            if (dataFim) aq = aq.lte("data", dataFim);
            const { data: aloc } = await aq;
            const TIPOS: Record<string, string> = { obra: "Alocado em obra", base: "Base Osasco", disponivel: "Disponível", falta: "Falta", folga: "Folga", atestado: "Atestado", ferias: "Férias" };
            let extra: ResultRow[] = (aloc || []).map((a: any) => ({
              nome: a.employees?.name || "", matricula: a.employees?.matricula || null, data: a.data,
              obra_nome: a.ogs_number || "", encarregado: null, funcao: a.employees?.funcoes?.nome || null,
              entrada: a.entrada, saida: a.saida, turno: null, clima: TIPOS[a.tipo] || a.tipo,
              contratante: null, local: null, equipe: a.employees?.equipe || null, responsavel: null,
              preenchido_por: "Programador de Obras", tipo_rdo: "ALOCACAO", rdo_id: `aloc-${a.id}`,
              origem_horario: "Alocação manual", alertas: a.observacao ? [`Obs: ${a.observacao}`] : [],
            }));
            extra = await enrichWithOgs(extra, profile.company_id!);
            result = [...result, ...extra];
          }
        } catch (e) { console.error("Alocações manuais:", e); }

        result.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome) || (a.entrada || "").localeCompare(b.entrada || ""));
        if (result.length === 0) setMessageNoData(`Nenhum RDO encontrado para "${termo}" no período. Confira a grafia ou tente só o sobrenome/matrícula.`);
        setRows(result);

      } else if (filterType === "funcao") {
        // Busca direta em rdo_efetivo com join
        let query = (supabase as any)
          .from("rdo_efetivo")
          .select("nome, funcao, entrada, saida, matricula, employee_id, rdo_id, rdo_diarios!inner(id, data, obra_nome, encarregado, turno, clima, equipe, responsavel, preenchido_por, tipo_rdo, company_id, status_validacao)")
          .eq("rdo_diarios.company_id", profile.company_id!)
          .neq("rdo_diarios.status_validacao", "rascunho")
          .eq("funcao", funcao);

        if (nome.trim()) query = query.eq("nome", nome.trim());
        if (dataIni) query = query.gte("rdo_diarios.data", dataIni);
        if (dataFim) query = query.lte("rdo_diarios.data", dataFim);

        const { data, error } = await query;
        if (error) throw error;

        let result: ResultRow[] = [];
        (data || []).forEach((r: any) => {
          // nome pode conter múltiplos nomes separados por "|||"
          const nomes = (r.nome || "").split("|||").map((n: string) => n.trim()).filter(Boolean);
          const lista = nomes.length > 0 ? nomes : [""];
          const matsRow = (r.matricula || "").split("|||").map((m: string) => m.trim());
          lista.forEach((n: string, li: number) => {
            result.push({
              nome: n,
              data: r.rdo_diarios?.data || "",
              obra_nome: r.rdo_diarios?.obra_nome || "",
              encarregado: r.rdo_diarios?.encarregado || null,
              funcao: r.funcao || null,
              entrada: r.entrada || null,
              saida: r.saida || null,
              turno: r.rdo_diarios?.turno || null,
              clima: r.rdo_diarios?.clima || null,
              contratante: null,
              local: null,
              matricula: (nomes.length > 1 ? matsRow[li] : r.matricula) || null,
              equipe: r.rdo_diarios?.equipe || null,
              responsavel: r.rdo_diarios?.responsavel || null,
              preenchido_por: r.rdo_diarios?.preenchido_por || null,
              tipo_rdo: r.rdo_diarios?.tipo_rdo || null,
              rdo_id: r.rdo_id,
              origem_horario: "",
              alertas: [],
            });
          });
        });

        if (dataIni) result = result.filter(r => r.data >= dataIni);
        if (dataFim) result = result.filter(r => r.data <= dataFim);

        result = await finalizar(result, profile.company_id!);
        result.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));

        if (result.length === 0) setMessageNoData(`Nenhum funcionário encontrado para "${funcao}"${nome ? ` (${nome})` : ""} no período.`);
        setRows(result);

      } else {
        // Para obra e encarregado: buscar RDOs primeiro, depois efetivo
        let rdoQuery = supabase
          .from("rdo_diarios")
          .select("id, data, obra_nome, encarregado, turno, clima, equipe, responsavel, preenchido_por, tipo_rdo, company_id")
          .eq("company_id", profile.company_id!)
          .or("status_validacao.is.null,status_validacao.neq.rascunho");

        if (filterType === "obra") rdoQuery = rdoQuery.ilike("obra_nome", `%${obra.trim()}%`);
        if (filterType === "encarregado") rdoQuery = rdoQuery.eq("encarregado", encarregado.trim());
        if (dataIni) rdoQuery = rdoQuery.gte("data", dataIni);
        if (dataFim) rdoQuery = rdoQuery.lte("data", dataFim);

        const { data: rdos, error: rdoErr } = await rdoQuery;
        if (rdoErr) throw rdoErr;

        if (!rdos || rdos.length === 0) {
          setRows([]);
          setMessageNoData("Nenhum RDO encontrado para o filtro selecionado.");
          setLoading(false);
          return;
        }

        rdoIds = rdos.map((r: any) => r.id);
        rdos.forEach((r: any) => { rdoMap[r.id] = r; });

        const { data: efetivo, error: efErr } = await (supabase as any)
          .from("rdo_efetivo")
          .select("nome, funcao, entrada, saida, rdo_id, matricula")
          .in("rdo_id", rdoIds);

        if (efErr) throw efErr;

        let result: ResultRow[] = [];
        (efetivo || []).forEach((r: any) => {
          const rdo = rdoMap[r.rdo_id];
          if (!rdo) return;
          // nome pode conter múltiplos nomes separados por "|||"
          const nomes = (r.nome || "").split("|||").map((n: string) => n.trim()).filter(Boolean);
          const lista = nomes.length > 0 ? nomes : [""];
          const matsRow = (r.matricula || "").split("|||").map((m: string) => m.trim());
          lista.forEach((n: string, li: number) => {
            result.push({
              nome: n,
              data: rdo?.data || "",
              obra_nome: rdo?.obra_nome || "",
              encarregado: rdo?.encarregado || null,
              funcao: r.funcao || null,
              entrada: r.entrada || null,
              saida: r.saida || null,
              turno: rdo?.turno || null,
              clima: rdo?.clima || null,
              contratante: null,
              local: null,
              matricula: (nomes.length > 1 ? matsRow[li] : r.matricula) || null,
              equipe: rdo?.equipe || null,
              responsavel: rdo?.responsavel || null,
              preenchido_por: rdo?.preenchido_por || null,
              tipo_rdo: rdo?.tipo_rdo || null,
              rdo_id: r.rdo_id,
              origem_horario: "",
              alertas: [],
            });
          });
        });

        result = await finalizar(result, profile.company_id!);
        result.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));

        if (result.length === 0) setMessageNoData("Nenhum funcionário encontrado nos RDOs do período.");
        setRows(result);
      }
    } catch (err: any) {
      console.error("Erro na busca:", err);
    } finally {
      setLoading(false);
    }
  };

  // Enriquecimento comum: OGS/contratante, equipe do cadastro, origem do horário e alertas
  const finalizar = async (result: ResultRow[], companyId: string): Promise<ResultRow[]> => {
    result = await enrichWithOgs(result, companyId);
    const rdoIds = Array.from(new Set(result.map(r => r.rdo_id).filter(Boolean)));

    // Horários de todos do mesmo RDO → saber se o horário é "padrão do RDO" ou individual
    const horariosPorRdo: Record<string, Set<string>> = {};
    for (let i = 0; i < rdoIds.length; i += 150) {
      const { data } = await (supabase as any)
        .from("rdo_efetivo")
        .select("rdo_id, entrada, saida")
        .in("rdo_id", rdoIds.slice(i, i + 150));
      (data || []).forEach((h: any) => {
        (horariosPorRdo[h.rdo_id] ||= new Set()).add(`${hhmm(h.entrada)}-${hhmm(h.saida)}`);
      });
    }

    // Mesmo funcionário em mais de um RDO no mesmo dia
    const contagemDia: Record<string, Set<string>> = {};
    result.forEach(r => {
      const k = `${norm(r.nome)}|${r.data}`;
      (contagemDia[k] ||= new Set()).add(r.rdo_id);
    });

    // Equipe: a do RDO; se vazia, a do encarregado do RDO (equipe que de fato comandou o dia).
    // Equipe do cadastro do funcionário só entra como comparação (alerta "equipe de cadastro diferente").
    const nomesBusca = Array.from(new Set([
      ...result.map(r => r.nome),
      ...result.filter(r => !r.equipe).map(r => r.encarregado || ""),
    ].filter(Boolean)));
    const equipeCadastro: Record<string, string> = {};
    for (let i = 0; i < nomesBusca.length; i += 150) {
      const { data } = await (supabase as any)
        .from("employees").select("name, equipe").eq("company_id", companyId).in("name", nomesBusca.slice(i, i + 150));
      (data || []).forEach((e: any) => { if (e.equipe) equipeCadastro[norm(e.name)] = e.equipe; });
    }

    return result.map(r => {
      const alertas: string[] = [];
      const folga = r.clima === "Folga" || r.clima === "Cancelou";
      // Folga/Cancelou: sem horário (legado copiado do dia anterior não deve aparecer)
      const ent = folga ? "" : hhmm(r.entrada), sai = folga ? "" : hhmm(r.saida);
      if (!folga) {
        if (!ent || !sai) alertas.push("Sem horário");
        else if (sai < ent && r.turno !== "noturno") alertas.push("Saída antes da entrada");
        else if (sai === ent) alertas.push("Entrada = saída");
      }
      if ((contagemDia[`${norm(r.nome)}|${r.data}`]?.size || 0) > 1) alertas.push("Mais de um RDO no dia");
      const equipeDia = r.equipe || equipeCadastro[norm(r.encarregado)] || null;
      const eqCad = equipeCadastro[norm(r.nome)];
      if (eqCad && equipeDia && norm(eqCad) !== norm(equipeDia)) alertas.push(`Cadastro em outra equipe: ${eqCad}`);
      const hs = horariosPorRdo[r.rdo_id];
      const origem = folga ? "Sem trabalho (" + r.clima + ")" : r.tipo_rdo === "AUTOMATICO" ? "Automático (presumido)" : !ent && !sai ? "Não informado" : hs && hs.size > 1 ? "Individual" : "Padrão do RDO";
      return { ...r, entrada: folga ? null : r.entrada, saida: folga ? null : r.saida, alertas, origem_horario: origem, equipe: equipeDia };
    });
  };

  const enrichWithOgs = async (result: ResultRow[], companyId: string): Promise<ResultRow[]> => {
    const ogsNumbers = Array.from(new Set(result.map(r => r.obra_nome).filter(Boolean)));
    if (ogsNumbers.length === 0) return result;

    const { data: ogsRefs } = await supabase
      .from("ogs_reference")
      .select("ogs_number, client_name, location_address")
      .eq("company_id", companyId)
      .in("ogs_number", ogsNumbers as string[]);

    const ogsMap: Record<string, any> = {};
    (ogsRefs || []).forEach((o: any) => { ogsMap[o.ogs_number] = o; });

    return result.map(r => ({
      ...r,
      contratante: ogsMap[r.obra_nome]?.client_name || null,
      local: ogsMap[r.obra_nome]?.location_address || null,
    }));
  };

  // Barra de rolagem horizontal espelhada no topo (suspensa) — mede a largura real da tabela
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const measure = () => setTableWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [rows, loading]);

  const resetFilters = (type: FilterType) => {
    setFilterType(type);
    setBusca(""); setFuncao(""); setNome(""); setNomesSelecionaveis([]);
    setObra(""); setEncarregado("");
    setRows([]); setSearched(false); setMessageNoData("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-[1800px] mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <User className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Localização de Funcionários (RDO)</h1>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">

        {/* Seletor de tipo de filtro */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tipo de Filtro
          </label>
          <div className="flex gap-2">
            <Button variant={filterType === "funcionario" ? "default" : "outline"} onClick={() => resetFilters("funcionario")} className="flex-1">
              Por Funcionário
            </Button>
            <Button variant={filterType === "funcao" ? "default" : "outline"} onClick={() => resetFilters("funcao")} className="flex-1">
              Por Função
            </Button>
            <Button variant={filterType === "obra" ? "default" : "outline"} onClick={() => resetFilters("obra")} className="flex-1">
              Por Obra
            </Button>
            <Button variant={filterType === "encarregado" ? "default" : "outline"} onClick={() => resetFilters("encarregado")} className="flex-1">
              Por Encarregado
            </Button>
          </div>
        </div>

        {/* Card de filtros */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">

          {/* Por Funcionário */}
          {filterType === "funcionario" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funcionário (nome ou matrícula) *</label>
              <Input
                list="wf-func-cadastro"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscar(); }}
                placeholder="Digite o nome ou matrícula e escolha na lista..."
                className="h-11 bg-secondary border-border"
              />
              <datalist id="wf-func-cadastro">
                {cadastro.map(e => <option key={e.id} value={e.name}>{e.matricula || ""}</option>)}
              </datalist>
              <p className="text-[11px] text-muted-foreground">Mostra onde a pessoa esteve nos RDOs, com horário de entrada e saída informado pelo apontador. Mínimo 3 caracteres.</p>
            </div>
          )}

          {/* Por Função: cascata Função → Funcionário */}
          {filterType === "funcao" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Função *</label>
                <select
                  value={funcao}
                  onChange={(e) => { setFuncao(e.target.value); setNome(""); setNomesSelecionaveis([]); }}
                  disabled={loadingFuncoes}
                  className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                >
                  <option value="">{loadingFuncoes ? "Carregando..." : "Selecione a função..."}</option>
                  {funcoes.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {funcao && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Funcionário (opcional — deixe em branco para todos)
                  </label>
                  <select
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={loadingNomes}
                    className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
                  >
                    <option value="">{loadingNomes ? "Carregando..." : nomesSelecionaveis.length === 0 ? "Nenhum funcionário encontrado" : "Todos os funcionários"}</option>
                    {nomesSelecionaveis.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Por Obra */}
          {filterType === "obra" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obra *</label>
              <select
                value={obra}
                onChange={(e) => setObra(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione uma obra..."}</option>
                {obras.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {/* Por Encarregado */}
          {filterType === "encarregado" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encarregado *</label>
              <select
                value={encarregado}
                onChange={(e) => setEncarregado(e.target.value)}
                disabled={loadingDropdowns}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="">{loadingDropdowns ? "Carregando..." : "Selecione um encarregado..."}</option>
                {encarregados.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início</label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>

          <Button onClick={buscar} disabled={loading || !isValid()} className="w-full h-11 gap-2">
            <Search className="w-4 h-4" />
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {/* Botões de exportação */}
        {searched && !loading && rows.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={() => exportarExcel(getFilterLabel(), dataIni, dataFim, rows)} variant="outline" className="flex-1 gap-2 text-xs">
              <FileSpreadsheet className="w-4 h-4" /> Download Excel
            </Button>
            <Button onClick={() => exportarPdf(getFilterLabel(), dataIni, dataFim, rows)} variant="outline" className="flex-1 gap-2 text-xs">
              <Printer className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        )}

        {/* Resultados */}
        {searched && !loading && (
          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                {messageNoData || "Nenhum registro encontrado."}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground px-1">{rows.length} registro(s) encontrado(s)</p>
                <div
                  ref={topScrollRef}
                  onScroll={e => { if (tableScrollRef.current) tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
                  className="sticky top-[72px] z-30 overflow-x-auto overflow-y-hidden rounded-md border border-border bg-card shadow-sm"
                  style={{ height: 16 }}
                >
                  <div style={{ width: tableWidth, height: 1 }} />
                </div>
                <div
                  ref={tableScrollRef}
                  onScroll={e => { if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; }}
                  className="bg-card rounded-xl border border-border overflow-x-auto"
                >
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 sticky top-0">
<tr>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Data</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Funcionário</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Função</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">OGS / Contratante</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Equipe</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Encarregado</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Preenchido por</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Turno</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Entrada</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Saída</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Origem do horário</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Alertas</th>
<th className="text-left px-2 py-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
</tr>
</thead>
<tbody>
{rows.map((r, i) => (
  <tr key={`${r.rdo_id}-${i}`} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{fmtDate(r.data)}</td>
    <td className="px-2 py-1.5 font-semibold min-w-[150px]">{r.nome || "-"}{r.matricula && <span className="block text-[10px] font-normal text-muted-foreground">Mat. {r.matricula}</span>}</td>
    <td className="px-2 py-1.5 text-muted-foreground min-w-[110px]">{r.funcao || "-"}</td>
    <td className="px-2 py-1.5"><span className="text-primary font-semibold">{r.obra_nome || "-"}</span>{r.contratante && <span className="block text-[10px] text-muted-foreground">{r.contratante}</span>}</td>
    <td className="px-2 py-1.5 text-muted-foreground min-w-[110px]">{r.equipe || "-"}</td>
    <td className="px-2 py-1.5 text-muted-foreground min-w-[110px]">{r.encarregado || "-"}</td>
    <td className="px-2 py-1.5 text-muted-foreground min-w-[110px]">{r.preenchido_por || "-"}</td>
    <td className="px-2 py-1.5 text-xs capitalize whitespace-nowrap">{r.turno || "-"}</td>
    <td className="px-2 py-1.5 font-mono font-semibold whitespace-nowrap">{hhmm(r.entrada) || "-"}</td>
    <td className="px-2 py-1.5 font-mono font-semibold whitespace-nowrap">{hhmm(r.saida) || "-"}</td>
    <td className="px-2 py-1.5 whitespace-nowrap">
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${r.origem_horario === "Individual" ? "bg-blue-100 text-blue-700" : r.origem_horario === "Automático (presumido)" ? "bg-purple-100 text-purple-700" : r.origem_horario === "Alocação manual" ? "bg-teal-100 text-teal-700" : r.origem_horario === "Não informado" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{r.origem_horario}</span>
    </td>
    <td className="px-2 py-1.5 min-w-[140px]">
      {r.alertas.length === 0 ? <span className="text-muted-foreground">-</span> : r.alertas.map(a => (
        <span key={a} className="mr-1 mb-0.5 inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">{a}</span>
      ))}
    </td>
    <td className="px-2 py-1.5 whitespace-nowrap">
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
        r.clima === "Cancelou" ? "bg-red-100 text-red-700" :
        r.clima === "Folga" ? "bg-yellow-100 text-yellow-700" :
        "bg-green-100 text-green-700"
      }`}>{r.clima || "Trabalhou"}</span>
    </td>
  </tr>
))}
</tbody>
</table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
