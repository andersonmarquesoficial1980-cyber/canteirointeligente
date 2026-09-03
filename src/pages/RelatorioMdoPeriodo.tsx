import { useMemo, useState } from "react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function normalizeName(v?: string | null) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

type OrigemVinculo = "id_direto" | "nome_exato" | "sem_match";

type MdoDetalheRow = {
  data: string;
  rdo_id: string;
  status_validacao: string | null;
  tipo_rdo: string | null;
  obra_nome: string;
  encarregado: string | null;
  turno: string | null;
  apontador_user_id: string | null;
  apontador_nome: string | null;
  apontador_email: string | null;

  nome_lancado: string;
  funcao_lancada: string | null;
  matricula_lancada: string | null;

  employee_id_resolvido: string | null;
  employee_nome_resolvido: string | null;
  equipe_resolvida: string | null;
  status_employee: string | null;

  origem_vinculo: OrigemVinculo;
  confianca_vinculo: "alta" | "media" | "baixa";
};

type EmployeeLite = {
  id: string;
  name: string;
  equipe: string | null;
  role: string | null;
  status: string | null;
};

export default function RelatorioMdoPeriodo() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 8)}01`;

  const [dataIni, setDataIni] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [rows, setRows] = useState<MdoDetalheRow[]>([]);
  const [employeesAtivos, setEmployeesAtivos] = useState<EmployeeLite[]>([]);

  // filtros client-side
  const [fEquipe, setFEquipe] = useState("TODAS");
  const [fObra, setFObra] = useState("TODAS");
  const [fEncarregado, setFEncarregado] = useState("TODOS");
  const [fApontador, setFApontador] = useState("TODOS");
  const [fVinculo, setFVinculo] = useState<"todos" | OrigemVinculo>("todos");
  const [fSomenteSemPresenca, setFSomenteSemPresenca] = useState(false);
  const [q, setQ] = useState("");

  const equipeOptions = useMemo(() => {
    return Array.from(new Set(employeesAtivos.map((e) => (e.equipe || "SEM EQUIPE").trim() || "SEM EQUIPE"))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [employeesAtivos]);

  const obraOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => (r.obra_nome || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const encarregadoOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => (r.encarregado || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [rows]);

  const apontadorOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => (r.apontador_nome || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [rows]);

  const presenteEmployeeIds = useMemo(() => {
    return new Set(rows.map((r) => r.employee_id_resolvido).filter(Boolean) as string[]);
  }, [rows]);

  const semPresenca = useMemo(() => {
    return employeesAtivos
      .filter((e) => !presenteEmployeeIds.has(e.id))
      .filter((e) => (fEquipe === "TODAS" ? true : ((e.equipe || "SEM EQUIPE") === fEquipe)))
      .filter((e) => {
        const qq = q.trim().toLowerCase();
        if (!qq) return true;
        return [e.name, e.role || "", e.equipe || ""]
          .join(" ")
          .toLowerCase()
          .includes(qq);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [employeesAtivos, presenteEmployeeIds, fEquipe, q]);

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows
      .filter((r) => (fEquipe === "TODAS" ? true : (r.equipe_resolvida || "SEM EQUIPE") === fEquipe))
      .filter((r) => (fObra === "TODAS" ? true : r.obra_nome === fObra))
      .filter((r) => (fEncarregado === "TODOS" ? true : (r.encarregado || "") === fEncarregado))
      .filter((r) => (fApontador === "TODOS" ? true : (r.apontador_nome || "") === fApontador))
      .filter((r) => (fVinculo === "todos" ? true : r.origem_vinculo === fVinculo))
      .filter((r) => {
        if (!qq) return true;
        return [
          r.nome_lancado,
          r.funcao_lancada || "",
          r.obra_nome || "",
          r.encarregado || "",
          r.apontador_nome || "",
          r.apontador_email || "",
          r.equipe_resolvida || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(qq);
      })
      .sort((a, b) => b.data.localeCompare(a.data) || a.nome_lancado.localeCompare(b.nome_lancado, "pt-BR"));
  }, [rows, fEquipe, fObra, fEncarregado, fApontador, fVinculo, q]);

  const kpis = useMemo(() => {
    const idsVistos = new Set(filteredRows.map((r) => r.employee_id_resolvido).filter(Boolean) as string[]);
    const ativosFiltradosEquipe = employeesAtivos.filter((e) =>
      fEquipe === "TODAS" ? true : ((e.equipe || "SEM EQUIPE") === fEquipe),
    );

    return {
      ativosCadastro: ativosFiltradosEquipe.length,
      comPresenca: ativosFiltradosEquipe.filter((e) => idsVistos.has(e.id)).length,
      semPresenca: ativosFiltradosEquipe.filter((e) => !idsVistos.has(e.id)).length,
      lancamentosIdDireto: filteredRows.filter((r) => r.origem_vinculo === "id_direto").length,
      lancamentosNomeExato: filteredRows.filter((r) => r.origem_vinculo === "nome_exato").length,
      lancamentosSemMatch: filteredRows.filter((r) => r.origem_vinculo === "sem_match").length,
    };
  }, [filteredRows, employeesAtivos, fEquipe]);

  const canSearch = Boolean(profile?.company_id && dataIni && dataFim && dataIni <= dataFim);

  const buscar = async () => {
    if (!profile?.company_id || !canSearch) return;
    setLoading(true);
    setSearched(true);

    try {
      // 1) RDO headers do período
      const { data: rdos, error: rdoErr } = await supabase
        .from("rdo_diarios")
        .select("id,data,obra_nome,encarregado,turno,tipo_rdo,status_validacao,user_id,company_id")
        .eq("company_id", profile.company_id)
        .or("status_validacao.is.null,status_validacao.neq.rascunho")
        .gte("data", dataIni)
        .lte("data", dataFim)
        .order("data", { ascending: false });

      if (rdoErr) throw rdoErr;
      const rdoList = (rdos || []) as any[];
      const rdoIds = rdoList.map((r) => r.id).filter(Boolean);

      // 2) perfis dos apontadores
      const apontadorIds = Array.from(new Set(rdoList.map((r) => r.user_id).filter(Boolean)));
      const { data: perfis } = apontadorIds.length
        ? await supabase
            .from("profiles")
            .select("user_id,nome_completo,email")
            .in("user_id", apontadorIds)
        : { data: [] as any[] };

      const perfilMap: Record<string, { nome: string; email: string }> = {};
      (perfis || []).forEach((p: any) => {
        perfilMap[p.user_id] = { nome: p.nome_completo || "", email: p.email || "" };
      });

      // 3) efetivo dos RDOs
      let efetivo: any[] = [];
      if (rdoIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < rdoIds.length; i += chunkSize) {
          const ids = rdoIds.slice(i, i + chunkSize);
          const { data: part, error: efErr } = await (supabase as any)
            .from("rdo_efetivo")
            .select("rdo_id,funcao,nome,matricula,employee_id")
            .in("rdo_id", ids);
          if (efErr) throw efErr;
          efetivo = efetivo.concat((part || []) as any[]);
        }
      }

      // 4) employees ativos do cadastro (base de comparação)
      const { data: emps, error: empErr } = await supabase
        .from("employees")
        .select("id,name,equipe,role,status")
        .eq("company_id", profile.company_id)
        .eq("status", "ativo")
        .order("name", { ascending: true });
      if (empErr) throw empErr;

      const employees = (emps || []) as EmployeeLite[];
      setEmployeesAtivos(employees);

      const rdoMap = new Map<string, any>();
      rdoList.forEach((r) => rdoMap.set(r.id, r));

      const employeeById = new Map<string, EmployeeLite>();
      employees.forEach((e) => employeeById.set(e.id, e));

      const employeeByName = new Map<string, EmployeeLite[]>();
      employees.forEach((e) => {
        const k = normalizeName(e.name);
        if (!k) return;
        if (!employeeByName.has(k)) employeeByName.set(k, []);
        employeeByName.get(k)!.push(e);
      });

      const result: MdoDetalheRow[] = [];

      efetivo.forEach((ef) => {
        const rdo = rdoMap.get(ef.rdo_id);
        if (!rdo) return;

        const nomes = String(ef.nome || "")
          .split("|||")
          .map((n: string) => n.trim())
          .filter(Boolean);

        const matriculas = String(ef.matricula || "")
          .split("|||")
          .map((m: string) => m.trim());

        const pessoas = nomes.length > 0 ? nomes : [""];

        pessoas.forEach((nomePessoa: string, idx: number) => {
          const matriculaPessoa = matriculas[idx] || matriculas[0] || null;

          let resolved: EmployeeLite | null = null;
          let origem: OrigemVinculo = "sem_match";
          let confianca: "alta" | "media" | "baixa" = "baixa";

          if (ef.employee_id && employeeById.has(ef.employee_id)) {
            resolved = employeeById.get(ef.employee_id) || null;
            origem = "id_direto";
            confianca = "alta";
          } else {
            const key = normalizeName(nomePessoa);
            const candidatos = employeeByName.get(key) || [];
            if (candidatos.length === 1) {
              resolved = candidatos[0];
              origem = "nome_exato";
              confianca = "media";
            }
          }

          result.push({
            data: rdo.data || "",
            rdo_id: rdo.id,
            status_validacao: rdo.status_validacao || null,
            tipo_rdo: rdo.tipo_rdo || null,
            obra_nome: rdo.obra_nome || "",
            encarregado: rdo.encarregado || null,
            turno: rdo.turno || null,
            apontador_user_id: rdo.user_id || null,
            apontador_nome: perfilMap[rdo.user_id || ""]?.nome || null,
            apontador_email: perfilMap[rdo.user_id || ""]?.email || null,

            nome_lancado: nomePessoa || "",
            funcao_lancada: ef.funcao || null,
            matricula_lancada: matriculaPessoa,

            employee_id_resolvido: resolved?.id || null,
            employee_nome_resolvido: resolved?.name || null,
            equipe_resolvida: resolved?.equipe || null,
            status_employee: resolved?.status || null,

            origem_vinculo: origem,
            confianca_vinculo: confianca,
          });
        });
      });

      setRows(result);
    } catch (err) {
      console.error("[RelatorioMdoPeriodo] erro", err);
      setRows([]);
      setEmployeesAtivos([]);
    } finally {
      setLoading(false);
    }
  };

  function exportarExcel() {
    const resumo = [
      { indicador: "Funcionários ativos (cadastro)", valor: kpis.ativosCadastro },
      { indicador: "Ativos com presença no período", valor: kpis.comPresenca },
      { indicador: "Ativos sem presença no período", valor: kpis.semPresenca },
      { indicador: "Lançamentos com vínculo por ID", valor: kpis.lancamentosIdDireto },
      { indicador: "Lançamentos com vínculo por nome exato", valor: kpis.lancamentosNomeExato },
      { indicador: "Lançamentos sem match", valor: kpis.lancamentosSemMatch },
    ];

    const detalhe = filteredRows.map((r) => ({
      DATA: fmtDate(r.data),
      RDO_ID: r.rdo_id,
      STATUS_RDO: r.status_validacao || "-",
      TIPO_RDO: r.tipo_rdo || "-",
      OGS_OBRA: r.obra_nome || "-",
      ENCARREGADO: r.encarregado || "-",
      TURNO: r.turno || "-",
      APONTADOR: r.apontador_nome || "-",
      APONTADOR_EMAIL: r.apontador_email || "-",
      FUNCIONARIO_LANCADO: r.nome_lancado || "-",
      FUNCAO_LANCADA: r.funcao_lancada || "-",
      MATRICULA_LANCADA: r.matricula_lancada || "-",
      FUNCIONARIO_RESOLVIDO: r.employee_nome_resolvido || "-",
      EQUIPE_RESOLVIDA: r.equipe_resolvida || "SEM EQUIPE",
      ORIGEM_VINCULO: r.origem_vinculo,
      CONFIANCA_VINCULO: r.confianca_vinculo,
    }));

    const semPresencaAba = semPresenca.map((e) => ({
      FUNCIONARIO: e.name,
      FUNCAO: e.role || "-",
      EQUIPE: e.equipe || "SEM EQUIPE",
      STATUS: e.status || "-",
    }));

    const divergencias = filteredRows
      .filter((r) => r.origem_vinculo === "sem_match")
      .map((r) => ({
        DATA: fmtDate(r.data),
        RDO_ID: r.rdo_id,
        OGS_OBRA: r.obra_nome,
        ENCARREGADO: r.encarregado || "-",
        NOME_LANCADO: r.nome_lancado,
        FUNCAO_LANCADA: r.funcao_lancada || "-",
        APONTADOR: r.apontador_nome || "-",
      }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "RESUMO");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), "DETALHE_MDO");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semPresencaAba), "SEM_PRESENCA");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(divergencias), "DIVERGENCIAS_NOME");

    XLSX.writeFile(wb, `WF_MDO_PERIODO_${dataIni}_a_${dataFim}.xlsx`);
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(13);
    doc.text("WF Relatórios - MDO por Período (RDO x Gestão de Pessoas)", 12, 12);
    doc.setFontSize(9);
    doc.text(`Período: ${fmtDate(dataIni)} a ${fmtDate(dataFim)}`, 12, 18);
    doc.text(`Ativos: ${kpis.ativosCadastro} | Com presença: ${kpis.comPresenca} | Sem presença: ${kpis.semPresenca}`, 12, 23);

    const body = filteredRows.slice(0, 1200).map((r) => [
      fmtDate(r.data),
      r.nome_lancado || "-",
      r.equipe_resolvida || "SEM EQUIPE",
      r.funcao_lancada || "-",
      r.obra_nome || "-",
      r.encarregado || "-",
      r.apontador_nome || "-",
      r.origem_vinculo,
    ]);

    autoTable(doc, {
      startY: 28,
      head: [["Data", "Funcionário", "Equipe", "Função", "OGS/Obra", "Encarregado", "Apontador", "Vínculo"]],
      body,
      styles: { fontSize: 7, cellPadding: 1.6 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 8, right: 8 },
      theme: "grid",
    });

    doc.save(`WF_MDO_PERIODO_${dataIni}_a_${dataFim}.pdf`);
  }

  const canExport = searched && !loading && (filteredRows.length > 0 || semPresenca.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">👷 MDO por Período (RDO x Gestão de Pessoas)</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros de busca</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Data início</label>
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data fim</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Equipe</label>
              <select value={fEquipe} onChange={(e) => setFEquipe(e.target.value)} className="h-10 w-full px-3 bg-secondary border border-border rounded-md text-sm">
                <option value="TODAS">Todas</option>
                {equipeOptions.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vínculo</label>
              <select value={fVinculo} onChange={(e) => setFVinculo(e.target.value as any)} className="h-10 w-full px-3 bg-secondary border border-border rounded-md text-sm">
                <option value="todos">Todos</option>
                <option value="id_direto">ID direto</option>
                <option value="nome_exato">Nome exato</option>
                <option value="sem_match">Sem match</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">OGS/Obra</label>
              <select value={fObra} onChange={(e) => setFObra(e.target.value)} className="h-10 w-full px-3 bg-secondary border border-border rounded-md text-sm">
                <option value="TODAS">Todas</option>
                {obraOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Encarregado</label>
              <select value={fEncarregado} onChange={(e) => setFEncarregado(e.target.value)} className="h-10 w-full px-3 bg-secondary border border-border rounded-md text-sm">
                <option value="TODOS">Todos</option>
                {encarregadoOptions.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Apontador</label>
              <select value={fApontador} onChange={(e) => setFApontador(e.target.value)} className="h-10 w-full px-3 bg-secondary border border-border rounded-md text-sm">
                <option value="TODOS">Todos</option>
                {apontadorOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Busca livre</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nome, função, obra..." className="h-10" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fSomenteSemPresenca}
                onChange={(e) => setFSomenteSemPresenca(e.target.checked)}
              />
              Exibir somente funcionários sem presença no período
            </label>

            <Button onClick={buscar} disabled={!canSearch || loading} className="h-10 gap-2">
              <Search className="w-4 h-4" />
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        {searched && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Ativos cadastro</p><p className="text-lg font-bold">{kpis.ativosCadastro}</p></div>
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Com presença</p><p className="text-lg font-bold text-green-700">{kpis.comPresenca}</p></div>
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Sem presença</p><p className="text-lg font-bold text-red-700">{kpis.semPresenca}</p></div>
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Vínculo por ID</p><p className="text-lg font-bold">{kpis.lancamentosIdDireto}</p></div>
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Vínculo por nome</p><p className="text-lg font-bold">{kpis.lancamentosNomeExato}</p></div>
            <div className="bg-card rounded-xl border p-3"><p className="text-xs text-muted-foreground">Sem match</p><p className="text-lg font-bold">{kpis.lancamentosSemMatch}</p></div>
          </div>
        )}

        {canExport && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportarExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button variant="outline" onClick={exportarPdf} className="gap-2">
              <Printer className="w-4 h-4" /> Exportar PDF
            </Button>
          </div>
        )}

        {searched && !loading && fSomenteSemPresenca && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 text-sm font-semibold">Funcionários sem presença no período ({semPresenca.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Funcionário</th>
                    <th className="text-left px-3 py-2">Função</th>
                    <th className="text-left px-3 py-2">Equipe</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {semPresenca.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{e.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.role || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.equipe || "SEM EQUIPE"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.status || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {searched && !loading && !fSomenteSemPresenca && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 text-sm font-semibold">Detalhe MDO ({filteredRows.length} linhas)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Funcionário lançado</th>
                    <th className="text-left px-3 py-2">Equipe</th>
                    <th className="text-left px-3 py-2">Função</th>
                    <th className="text-left px-3 py-2">OGS/Obra</th>
                    <th className="text-left px-3 py-2">Encarregado</th>
                    <th className="text-left px-3 py-2">Apontador</th>
                    <th className="text-left px-3 py-2">Vínculo</th>
                    <th className="text-left px-3 py-2">RDO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={`${r.rdo_id}-${i}`} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.data)}</td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.nome_lancado || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.equipe_resolvida || "SEM EQUIPE"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.funcao_lancada || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.obra_nome || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.encarregado || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.apontador_nome || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          r.origem_vinculo === "id_direto"
                            ? "bg-green-100 text-green-700"
                            : r.origem_vinculo === "nome_exato"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}>
                          {r.origem_vinculo}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.rdo_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
