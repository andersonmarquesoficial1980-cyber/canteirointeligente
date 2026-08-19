import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Printer, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";

type ColumnKey =
  | "name"
  | "role"
  | "equipe"
  | "cpf"
  | "rg"
  | "matricula"
  | "telefone"
  | "email"
  | "centro_custo"
  | "responsavel"
  | "status"
  | "data_admissao"
  | "checkin_date";

interface EmployeeRow {
  id: string;
  name: string;
  role: string | null;
  equipe: string | null;
  cpf: string | null;
  rg: string | null;
  matricula: string | null;
  telefone: string | null;
  email: string | null;
  centro_custo: string | null;
  responsavel: string | null;
  status: string | null;
  data_admissao: string | null;
}

const COLUMN_OPTIONS: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "role", label: "Função" },
  { key: "equipe", label: "Equipe" },
  { key: "cpf", label: "CPF" },
  { key: "rg", label: "R.G" },
  { key: "matricula", label: "Matrícula" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "centro_custo", label: "Centro de Custo" },
  { key: "responsavel", label: "Responsável" },
  { key: "status", label: "Status" },
  { key: "data_admissao", label: "Data de Admissão" },
  { key: "checkin_date", label: "Data de Check-in" },
];

function fmtDate(date: string | null | undefined) {
  if (!date) return "-";
  if (!date.includes("-")) return date;
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

function valueForColumn(col: ColumnKey, employee: EmployeeRow, checkinDate?: string) {
  switch (col) {
    case "name":
      return employee.name || "-";
    case "role":
      return employee.role || "-";
    case "equipe":
      return employee.equipe || "-";
    case "cpf":
      return employee.cpf || "-";
    case "rg":
      return employee.rg || "-";
    case "matricula":
      return employee.matricula || "-";
    case "telefone":
      return employee.telefone || "-";
    case "email":
      return employee.email || "-";
    case "centro_custo":
      return employee.centro_custo || "-";
    case "responsavel":
      return employee.responsavel || "-";
    case "status":
      return employee.status || "-";
    case "data_admissao":
      return fmtDate(employee.data_admissao);
    case "checkin_date":
      return checkinDate ? fmtDate(checkinDate) : "-";
    default:
      return "-";
  }
}

function exportCsv(
  selectedColumns: ColumnKey[],
  selectedEmployees: EmployeeRow[],
  checkinDates: Record<string, string>,
  observacao: string,
) {
  const headers = selectedColumns.map((c) => COLUMN_OPTIONS.find((co) => co.key === c)?.label || c);
  const rows = selectedEmployees.map((employee) =>
    selectedColumns.map((col) => valueForColumn(col, employee, checkinDates[employee.id])),
  );

  const lines: string[][] = [];
  lines.push(["Relatório Personalizado de Funcionários (Cadastro RH)"]);
  lines.push([`Gerado em: ${new Date().toLocaleString("pt-BR")}`]);
  if (observacao.trim()) lines.push([`Observação/Endereço: ${observacao.trim()}`]);
  lines.push([]);
  lines.push(headers);
  lines.push(...rows);

  const csv =
    "\uFEFF" +
    lines
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_Relatorio_Funcionarios_Personalizado_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(
  selectedColumns: ColumnKey[],
  selectedEmployees: EmployeeRow[],
  checkinDates: Record<string, string>,
  observacao: string,
) {
  const headers = selectedColumns.map((c) => COLUMN_OPTIONS.find((co) => co.key === c)?.label || c);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório Personalizado de Funcionários</title><style>
    body{font-family:Arial,sans-serif;padding:18px;color:#111827;font-size:12px}
    h1{color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:6px;font-size:16px;margin-bottom:8px}
    p{margin:4px 0;color:#374151}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
    th,td{border:1px solid #d1d5db;padding:5px 6px;text-align:left;vertical-align:top}
    th{background:#f3f4f6;font-weight:700}
    @media print{body{padding:8px}}
  </style></head><body>
  <h1>👥 Relatório Personalizado de Funcionários</h1>
  <p><strong>Gerado em:</strong> ${new Date().toLocaleString("pt-BR")}</p>
  ${observacao.trim() ? `<p><strong>Observação/Endereço:</strong> ${observacao.trim()}</p>` : ""}
  <p><strong>Total de funcionários:</strong> ${selectedEmployees.length}</p>
  <table><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;

  selectedEmployees.forEach((employee) => {
    html += "<tr>";
    selectedColumns.forEach((col) => {
      html += `<td>${valueForColumn(col, employee, checkinDates[employee.id])}</td>`;
    });
    html += "</tr>";
  });

  html += "</table></body></html>";

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RelatorioFuncionariosPersonalizado() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(["name", "role", "equipe", "cpf"]);
  const [checkinDates, setCheckinDates] = useState<Record<string, string>>({});
  const [showDemitidos, setShowDemitidos] = useState(false);
  const [filtroEquipe, setFiltroEquipe] = useState("TODAS");
  const [filtroFuncao, setFiltroFuncao] = useState("TODAS");
  const [observacao, setObservacao] = useState(
    "Rua Porto Alegre, nº 137 – Jardim Caçula – Capitão Leônidas Marques/PR",
  );

  const equipesDisponiveis = useMemo(() => {
    return Array.from(new Set(employees.map((e) => (e.equipe || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [employees]);

  const funcoesDisponiveis = useMemo(() => {
    return Array.from(new Set(employees.map((e) => (e.role || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [employees]);

  useEffect(() => {
    if (!profile?.company_id) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("employees")
          .select(
            "id, name, role, equipe, cpf, rg, matricula, telefone, email, centro_custo, responsavel, status, data_admissao",
          )
          .eq("company_id", profile.company_id)
          .order("name", { ascending: true });

        if (error) throw error;
        setEmployees((data || []) as EmployeeRow[]);
      } catch (err) {
        console.error("Erro ao carregar funcionários para relatório personalizado:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.company_id]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((e) => {
      const status = String(e.status || "").toLowerCase();
      if (!showDemitidos && status === "demitido") return false;

      if (filtroEquipe !== "TODAS" && (e.equipe || "").trim() !== filtroEquipe) return false;
      if (filtroFuncao !== "TODAS" && (e.role || "").trim() !== filtroFuncao) return false;

      if (!q) return true;
      return [e.name, e.role, e.equipe, e.cpf, e.rg, e.matricula]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [employees, search, showDemitidos, filtroEquipe, filtroFuncao]);

  const selectedEmployees = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return employees.filter((e) => selectedSet.has(e.id));
  }, [employees, selectedIds]);

  const groupedByCheckin = useMemo(() => {
    const groups: Record<string, EmployeeRow[]> = {};
    selectedEmployees.forEach((employee) => {
      const checkin = checkinDates[employee.id] || "sem_data";
      if (!groups[checkin]) groups[checkin] = [];
      groups[checkin].push(employee);
    });

    const orderedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "sem_data") return 1;
      if (b === "sem_data") return -1;
      return a.localeCompare(b);
    });

    return orderedKeys.map((key) => ({ key, label: key === "sem_data" ? "Sem data de check-in" : fmtDate(key), rows: groups[key] }));
  }, [selectedEmployees, checkinDates]);

  const filteredIds = useMemo(() => filteredEmployees.map((e) => e.id), [filteredEmployees]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  function toggleColumn(column: ColumnKey) {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== column);
      }
      return [...prev, column];
    });
  }

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectOrClearFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  }

  function clearSelection() {
    setSelectedIds([]);
    setCheckinDates({});
  }

  const canExport = selectedEmployees.length > 0 && selectedColumns.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Relatório Personalizado de Funcionários</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configuração do relatório</p>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Buscar no cadastro</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, função, equipe, CPF, R.G, matrícula..."
                  className="pl-9 h-11 bg-secondary border-border"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observação / Endereço</label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: endereço do hotel"
                className="h-11 bg-secondary border-border"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtro por equipe</label>
              <select
                value={filtroEquipe}
                onChange={(e) => setFiltroEquipe(e.target.value)}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="TODAS">Todas as equipes</option>
                {equipesDisponiveis.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtro por função</label>
              <select
                value={filtroFuncao}
                onChange={(e) => setFiltroFuncao(e.target.value)}
                className="h-11 w-full px-3 bg-secondary border border-border rounded-md text-sm"
              >
                <option value="TODAS">Todas as funções</option>
                {funcoesDisponiveis.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={showDemitidos ? "default" : "outline"} onClick={() => setShowDemitidos((v) => !v)}>
              {showDemitidos ? "Mostrando demitidos" : "Ocultar demitidos"}
            </Button>
            <Button type="button" variant="outline" onClick={selectOrClearFiltered} disabled={filteredIds.length === 0}>
              {allFilteredSelected ? "Limpar seleção filtrada" : `Selecionar filtrados (${filteredIds.length})`}
            </Button>
            <Button type="button" variant="outline" onClick={clearSelection} disabled={selectedIds.length === 0}>
              Limpar seleção total
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFiltroEquipe("TODAS");
                setFiltroFuncao("TODAS");
                setSearch("");
              }}
            >
              Limpar filtros
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colunas do relatório</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COLUMN_OPTIONS.map((column) => {
                const checked = selectedColumns.includes(column.key);
                return (
                  <label
                    key={column.key}
                    className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs cursor-pointer ${
                      checked ? "border-primary bg-primary/5" : "border-border bg-background"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(column.key)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{column.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Selecione os campos que devem aparecer no relatório. Ex.: Nome + Função + Equipe ou Nome + R.G.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Cadastro de Funcionários ({filteredEmployees.length})</h2>
              {loading && <span className="text-xs text-muted-foreground">Carregando...</span>}
            </div>

            <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
              {!loading && filteredEmployees.length === 0 && (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3">Nenhum funcionário encontrado com esse filtro.</div>
              )}

              {filteredEmployees.map((employee) => {
                const checked = selectedSet.has(employee.id);
                return (
                  <label
                    key={employee.id}
                    className={`border rounded-md p-3 flex items-start gap-3 cursor-pointer ${
                      checked ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleEmployee(employee.id)} className="mt-1 h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{employee.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {employee.role || "Sem função"}
                        {employee.equipe ? ` · ${employee.equipe}` : ""}
                        {employee.cpf ? ` · CPF ${employee.cpf}` : ""}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Selecionados ({selectedEmployees.length})</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => exportCsv(selectedColumns, selectedEmployees, checkinDates, observacao)}
                  disabled={!canExport}
                  variant="outline"
                  className="gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" /> CSV
                </Button>
                <Button
                  onClick={() => exportPdf(selectedColumns, selectedEmployees, checkinDates, observacao)}
                  disabled={!canExport}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" /> PDF
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Dica: use a coluna "Data de Check-in" para montar listas separadas (ex.: 19/08 e 23/08).
            </p>

            <div className="max-h-[220px] overflow-auto space-y-2 pr-1">
              {selectedEmployees.length === 0 && (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-3">Selecione funcionários no painel ao lado para montar o relatório.</div>
              )}

              {selectedEmployees.map((employee) => (
                <div key={employee.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{employee.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {employee.role || "Sem função"}
                        {employee.equipe ? ` · ${employee.equipe}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleEmployee(employee.id)}>
                      Remover
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Data de check-in (opcional)</label>
                    <Input
                      type="date"
                      value={checkinDates[employee.id] || ""}
                      onChange={(e) =>
                        setCheckinDates((prev) => ({
                          ...prev,
                          [employee.id]: e.target.value,
                        }))
                      }
                      className="h-9 bg-secondary border-border"
                    />
                  </div>
                </div>
              ))}
            </div>

            {selectedEmployees.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo por check-in</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {groupedByCheckin.map((group) => (
                    <div key={group.key} className="border rounded-md p-2">
                      <p className="text-xs font-bold">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.rows.length} colaborador(es)</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEmployees.length > 0 && selectedColumns.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-semibold text-sm">Pré-visualização do relatório</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {selectedColumns.map((col) => (
                      <th key={col} className="text-left border-b border-border py-2 pr-3 font-semibold whitespace-nowrap">
                        {COLUMN_OPTIONS.find((c) => c.key === col)?.label || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-border/50">
                      {selectedColumns.map((col) => (
                        <td key={col} className="py-2 pr-3 whitespace-nowrap">
                          {valueForColumn(col, employee, checkinDates[employee.id])}
                        </td>
                      ))}
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
