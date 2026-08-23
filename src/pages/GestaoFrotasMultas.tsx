import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, IdCard, Plus, Save, Upload, User } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSmartBack } from "@/hooks/useSmartBack";

type MultaRow = {
  id: string;
  company_id: string;
  data_infracao: string;
  hora_infracao: string | null;
  placa: string;
  equipment_fleet: string | null;
  equipamento_id: string | null;
  auto_infracao: string | null;
  local_infracao: string | null;
  descricao: string | null;
  valor: number | null;
  status: string;
  condutor_nome: string | null;
  condutor_employee_id: string | null;
  observacoes: string | null;
  created_at: string;
};

type EquipRow = {
  id: string;
  placa: string | null;
  frota: string | null;
  centro_custo: string | null;
  tipo: string | null;
};

type EmployeeRow = {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
};

type CnhDoc = {
  id: string;
  employee_id: string;
  arquivo_url: string | null;
  validade: string | null;
  status: string | null;
  tipo: string | null;
};

type MultaImportPreview = {
  data_infracao: string;
  hora_infracao: string | null;
  placa: string;
  equipment_fleet: string | null;
  equipamento_id: string | null;
  auto_infracao: string | null;
  local_infracao: string | null;
  descricao: string | null;
  valor: number;
  status: string;
  condutor_nome: string | null;
  condutor_employee_id: string | null;
  observacoes: string | null;
  origem_linha: number;
  chave_duplicidade: string;
  pode_importar: boolean;
  motivo_bloqueio: string | null;
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "contestada", label: "Contestada" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

function fmtDate(data: string | null | undefined) {
  if (!data) return "—";
  const [y, m, d] = data.split("-");
  if (!y || !m || !d) return data;
  return `${d}/${m}/${y}`;
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normPlate(v: string | null | undefined) {
  return String(v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function normText(v: string | null | undefined) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function excelNumberDateToISO(excelNumber: number) {
  const utcDays = Math.floor(excelNumber - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const year = dateInfo.getUTCFullYear();
  const month = `${dateInfo.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${dateInfo.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateToISO(value: any): string {
  if (value == null || value === "") return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    return excelNumberDateToISO(value);
  }
  const raw = String(value).trim();
  if (!raw) return new Date().toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${m}-${d}`;
  }

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);

  return new Date().toISOString().slice(0, 10);
}

function parseTimeHHmm(value: any): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }

  return null;
}

function parseBRLToNumber(value: any): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.replace(/R\$/gi, "").replace(/\./g, "").replace(/,/g, ".").replace(/\s/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function pickField(row: Record<string, any>, aliases: string[]) {
  const keys = Object.keys(row);
  const map = new Map(keys.map((k) => [normText(k), k]));

  for (const alias of aliases) {
    const found = map.get(normText(alias));
    if (found) return row[found];
  }

  for (const k of keys) {
    const nk = normText(k);
    if (aliases.some((a) => nk.includes(normText(a)))) {
      return row[k];
    }
  }

  return null;
}

function buildDuplicateKey(dataInfracao: string, placa: string, autoInfracao: string | null | undefined) {
  const auto = String(autoInfracao || "").trim().toUpperCase();
  if (!auto) return "";
  return `${dataInfracao}|${normPlate(placa)}|${auto}`;
}

export default function GestaoFrotasMultas() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/gestao-frotas");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");
  const [multas, setMultas] = useState<MultaRow[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [cnhByEmployee, setCnhByEmployee] = useState<Record<string, CnhDoc | null>>({});
  const [importPreview, setImportPreview] = useState<MultaImportPreview[]>([]);

  const [form, setForm] = useState({
    data_infracao: new Date().toISOString().slice(0, 10),
    hora_infracao: "",
    placa: "",
    equipment_fleet: "",
    equipamento_id: "",
    auto_infracao: "",
    local_infracao: "",
    descricao: "",
    valor: "",
    status: "pendente",
    condutor_nome: "",
    condutor_employee_id: "",
    observacoes: "",
  });

  const employeeById = useMemo(() => {
    const map = new Map<string, EmployeeRow>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  const equipamentosByPlaca = useMemo(() => {
    const map = new Map<string, EquipRow>();
    for (const eq of equipamentos) {
      const n = normPlate(eq.placa);
      if (n) map.set(n, eq);
    }
    return map;
  }, [equipamentos]);

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        toast({ title: "Sessão inválida", variant: "destructive" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      const cid = (profile as any)?.company_id as string | undefined;
      if (!cid) {
        toast({ title: "Empresa não encontrada para o usuário", variant: "destructive" });
        return;
      }
      setCompanyId(cid);

      const [{ data: multasRows, error: multasErr }, { data: equips }, { data: emps }] = await Promise.all([
        (supabase as any)
          .from("gestao_frotas_multas")
          .select("*")
          .eq("company_id", cid)
          .order("data_infracao", { ascending: false })
          .order("hora_infracao", { ascending: false })
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("equipamentos")
          .select("id,placa,frota,centro_custo,tipo")
          .eq("company_id", cid)
          .order("frota"),
        (supabase as any)
          .from("employees")
          .select("id,name,role,status")
          .eq("company_id", cid)
          .order("name"),
      ]);

      if (multasErr) throw multasErr;

      const multasSafe = (multasRows || []) as MultaRow[];
      setMultas(multasSafe);
      setEquipamentos((equips || []) as EquipRow[]);
      setEmployees((emps || []) as EmployeeRow[]);

      await carregarCnhPorEmployee(multasSafe);
    } catch (e: any) {
      toast({ title: "Erro ao carregar multas", description: e?.message || "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function carregarCnhPorEmployee(rows: MultaRow[]) {
    const employeeIds = Array.from(new Set(rows.map((m) => m.condutor_employee_id).filter(Boolean))) as string[];
    if (employeeIds.length === 0) {
      setCnhByEmployee({});
      return;
    }

    const { data: docs } = await (supabase as any)
      .from("employee_documentos")
      .select("id,employee_id,arquivo_url,validade,status,tipo,created_at")
      .in("employee_id", employeeIds)
      .ilike("tipo", "%CNH%")
      .order("created_at", { ascending: false });

    const map: Record<string, CnhDoc | null> = {};
    for (const id of employeeIds) map[id] = null;

    for (const d of (docs || []) as CnhDoc[]) {
      if (!map[d.employee_id]) map[d.employee_id] = d;
    }

    setCnhByEmployee(map);
  }

  async function sugerirCondutorPorEquipData(eq: EquipRow, dataRef: string): Promise<{ employeeId: string | null; nome: string | null }> {
    const chaves = [eq.frota, eq.placa, eq.centro_custo].map((v) => String(v || "").trim()).filter(Boolean);
    if (!companyId || !dataRef || chaves.length === 0) return { employeeId: null, nome: null };

    let diariosQuery = (supabase as any)
      .from("equipment_diaries")
      .select("operator_name,operator_solo,operator_id,operator_solo_id,date,created_at,status")
      .eq("company_id", companyId)
      .eq("date", dataRef)
      .order("created_at", { ascending: false })
      .limit(20);

    diariosQuery = chaves.length === 1
      ? diariosQuery.eq("equipment_fleet", chaves[0])
      : diariosQuery.in("equipment_fleet", chaves);

    const { data: diarios } = await diariosQuery;
    const manual = (diarios || []).find((d: any) => String(d.status || "").toLowerCase() !== "auto");
    if (!manual) return { employeeId: null, nome: null };

    const employeeId = manual.operator_id || manual.operator_solo_id || null;
    const nome = String(manual.operator_name || manual.operator_solo || "").trim() || null;
    return { employeeId, nome };
  }

  async function sugerirPorPlacaEData(placaInput: string, dataRef: string) {
    const placaNorm = normPlate(placaInput);
    const eq = equipamentosByPlaca.get(placaNorm);

    if (eq) {
      setForm((prev) => ({
        ...prev,
        equipment_fleet: eq.frota || eq.centro_custo || "",
        equipamento_id: eq.id,
      }));
    } else {
      setForm((prev) => ({ ...prev, equipment_fleet: "", equipamento_id: "" }));
      return;
    }

    const sugestao = await sugerirCondutorPorEquipData(eq, dataRef);
    if (!sugestao.employeeId && !sugestao.nome) return;

    if (sugestao.employeeId) {
      const emp = employeeById.get(sugestao.employeeId);
      setForm((prev) => ({
        ...prev,
        condutor_employee_id: sugestao.employeeId || "",
        condutor_nome: emp?.name || sugestao.nome || "",
      }));
      return;
    }

    if (sugestao.nome) {
      const nomeNorm = normText(sugestao.nome);
      const candidato = employees.find((e) => normText(e.name) === nomeNorm);

      setForm((prev) => ({
        ...prev,
        condutor_nome: sugestao.nome || "",
        condutor_employee_id: candidato?.id || "",
      }));
    }
  }

  async function processarArquivoMultas(file: File) {
    if (!companyId) {
      toast({ title: "Empresa não carregada ainda", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) throw new Error("Planilha sem abas.");

      const sheet = wb.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!json.length) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        setImportPreview([]);
        return;
      }

      const diariosCache = new Map<string, { employeeId: string | null; nome: string | null }>();
      const preview: MultaImportPreview[] = [];

      for (let i = 0; i < json.length; i++) {
        const row = json[i];

        const placaRaw = pickField(row, ["placa", "placa veículo", "placa veiculo", "veiculo", "frota"]);
        const placa = normPlate(placaRaw);
        if (!placa) continue;

        const dataRaw = pickField(row, ["data da infração", "data da infracao", "data", "dt infração", "dt infracao"]);
        const horaRaw = pickField(row, ["hora", "horário", "horario"]);
        const autoRaw = pickField(row, ["auto de infração", "auto de infracao", "auto", "número auto", "numero auto"]);
        const localRaw = pickField(row, ["local", "local da infração", "local da infracao", "endereço", "endereco"]);
        const descricaoRaw = pickField(row, ["descrição", "descricao", "enquadramento", "observação", "observacao"]);
        const valorRaw = pickField(row, ["valor", "valor multa", "valor da multa"]);

        const dataIso = parseDateToISO(dataRaw);
        const hora = parseTimeHHmm(horaRaw);
        const valor = parseBRLToNumber(valorRaw);

        const eq = equipamentosByPlaca.get(placa) || null;
        const cacheKey = `${placa}-${dataIso}`;

        let sugestao = diariosCache.get(cacheKey);
        if (!sugestao && eq) {
          sugestao = await sugerirCondutorPorEquipData(eq, dataIso);
          diariosCache.set(cacheKey, sugestao);
        }

        const employeeId = sugestao?.employeeId || null;
        const nomeSug = employeeId ? (employeeById.get(employeeId)?.name || sugestao?.nome || null) : (sugestao?.nome || null);
        const autoInfracao = autoRaw ? String(autoRaw).trim().toUpperCase() : null;

        preview.push({
          data_infracao: dataIso,
          hora_infracao: hora,
          placa,
          equipment_fleet: eq?.frota || eq?.centro_custo || null,
          equipamento_id: eq?.id || null,
          auto_infracao: autoInfracao,
          local_infracao: localRaw ? String(localRaw).trim() : null,
          descricao: descricaoRaw ? String(descricaoRaw).trim() : null,
          valor,
          status: "pendente",
          condutor_nome: nomeSug,
          condutor_employee_id: employeeId,
          observacoes: "Importado de planilha",
          origem_linha: i + 2,
          chave_duplicidade: buildDuplicateKey(dataIso, placa, autoInfracao),
          pode_importar: true,
          motivo_bloqueio: null,
        });
      }

      const usadosNaPlanilha = new Set<string>();
      for (const p of preview) {
        if (!p.chave_duplicidade) continue;
        if (usadosNaPlanilha.has(p.chave_duplicidade)) {
          p.pode_importar = false;
          p.motivo_bloqueio = "Duplicada na própria planilha (Auto+Placa+Data).";
          continue;
        }
        usadosNaPlanilha.add(p.chave_duplicidade);
      }

      const autos = Array.from(new Set(preview.map((p) => p.auto_infracao).filter(Boolean))) as string[];
      const placas = Array.from(new Set(preview.map((p) => p.placa).filter(Boolean))) as string[];
      const datas = preview.map((p) => p.data_infracao).filter(Boolean);

      const minData = datas.length ? datas.slice().sort()[0] : null;
      const maxData = datas.length ? datas.slice().sort().at(-1) || null : null;

      const existingKeys = new Set<string>();
      if (autos.length && placas.length && minData && maxData) {
        const { data: existentes } = await (supabase as any)
          .from("gestao_frotas_multas")
          .select("data_infracao,placa,auto_infracao")
          .eq("company_id", companyId)
          .in("auto_infracao", autos)
          .in("placa", placas)
          .gte("data_infracao", minData)
          .lte("data_infracao", maxData);

        for (const row of (existentes || []) as Array<{ data_infracao: string; placa: string; auto_infracao: string | null }>) {
          const k = buildDuplicateKey(String(row.data_infracao || ""), String(row.placa || ""), row.auto_infracao);
          if (k) existingKeys.add(k);
        }
      }

      for (const p of preview) {
        if (!p.chave_duplicidade) continue;
        if (existingKeys.has(p.chave_duplicidade)) {
          p.pode_importar = false;
          p.motivo_bloqueio = "Já existe no banco (Auto+Placa+Data).";
        }
      }

      setImportPreview(preview);

      const aptas = preview.filter((p) => p.pode_importar).length;
      const bloqueadas = preview.length - aptas;
      toast({
        title: "Pré-visualização gerada",
        description: `${preview.length} linha(s): ${aptas} apta(s), ${bloqueadas} bloqueada(s) por duplicidade.`,
      });
    } catch (e: any) {
      toast({ title: "Falha ao processar planilha", description: e?.message || "", variant: "destructive" });
      setImportPreview([]);
    } finally {
      setImporting(false);
    }
  }

  async function importarPreview() {
    if (!companyId || importPreview.length === 0) return;

    const aptas = importPreview.filter((p) => p.pode_importar);
    if (aptas.length === 0) {
      toast({ title: "Nenhuma linha apta para importação", description: "Todas as linhas estão bloqueadas por duplicidade.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const payload = aptas.map((p) => ({
        company_id: companyId,
        data_infracao: p.data_infracao,
        hora_infracao: p.hora_infracao,
        placa: p.placa,
        equipment_fleet: p.equipment_fleet,
        equipamento_id: p.equipamento_id,
        auto_infracao: p.auto_infracao,
        local_infracao: p.local_infracao,
        descricao: p.descricao,
        valor: p.valor,
        status: p.status,
        condutor_nome: p.condutor_nome,
        condutor_employee_id: p.condutor_employee_id,
        observacoes: p.observacoes,
      }));

      const { error } = await (supabase as any).from("gestao_frotas_multas").insert(payload);
      if (error) throw error;

      const bloqueadas = importPreview.length - aptas.length;
      toast({ title: "Importação concluída", description: `${payload.length} inserida(s) • ${bloqueadas} bloqueada(s) por duplicidade` });
      setImportPreview([]);
      await carregarTudo();
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e?.message || "", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function exportarBloqueadasCsv() {
    const bloqueadas = importPreview.filter((p) => !p.pode_importar);
    if (!bloqueadas.length) {
      toast({ title: "Sem linhas bloqueadas para exportar" });
      return;
    }

    const linhas = bloqueadas.map((b) => ({
      linha_planilha: b.origem_linha,
      data_infracao: b.data_infracao,
      placa: b.placa,
      auto_infracao: b.auto_infracao || "",
      frota_resolvida: b.equipment_fleet || "",
      condutor_sugerido: b.condutor_nome || "",
      motivo_bloqueio: b.motivo_bloqueio || "",
    }));

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "bloqueadas");
    XLSX.writeFile(wb, `multas_bloqueadas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function salvarMulta() {
    if (!companyId) return;
    if (!form.data_infracao || !form.placa.trim()) {
      toast({ title: "Data e placa são obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const autoNormalizado = form.auto_infracao.trim().toUpperCase() || null;
      const placaNormalizada = form.placa.trim().toUpperCase();

      if (autoNormalizado) {
        const { data: jaExiste } = await (supabase as any)
          .from("gestao_frotas_multas")
          .select("id")
          .eq("company_id", companyId)
          .eq("data_infracao", form.data_infracao)
          .eq("placa", placaNormalizada)
          .eq("auto_infracao", autoNormalizado)
          .limit(1)
          .maybeSingle();

        if (jaExiste?.id) {
          toast({ title: "Multa já cadastrada", description: "Mesmo Auto+Placa+Data já existe no banco.", variant: "destructive" });
          return;
        }
      }

      const payload = {
        company_id: companyId,
        data_infracao: form.data_infracao,
        hora_infracao: form.hora_infracao || null,
        placa: placaNormalizada,
        equipment_fleet: form.equipment_fleet || null,
        equipamento_id: form.equipamento_id || null,
        auto_infracao: autoNormalizado,
        local_infracao: form.local_infracao.trim() || null,
        descricao: form.descricao.trim() || null,
        valor: form.valor ? Number(form.valor.replace(",", ".")) : 0,
        status: form.status || "pendente",
        condutor_nome: form.condutor_nome.trim() || null,
        condutor_employee_id: form.condutor_employee_id || null,
        observacoes: form.observacoes.trim() || null,
      };

      const { error } = await (supabase as any).from("gestao_frotas_multas").insert(payload);
      if (error) throw error;

      toast({ title: "Multa cadastrada" });

      setForm({
        data_infracao: new Date().toISOString().slice(0, 10),
        hora_infracao: "",
        placa: "",
        equipment_fleet: "",
        equipamento_id: "",
        auto_infracao: "",
        local_infracao: "",
        descricao: "",
        valor: "",
        status: "pendente",
        condutor_nome: "",
        condutor_employee_id: "",
        observacoes: "",
      });

      await carregarTudo();
    } catch (e: any) {
      toast({ title: "Erro ao salvar multa", description: e?.message || "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function atualizarStatus(multaId: string, status: string) {
    const old = multas;
    setMultas((prev) => prev.map((m) => (m.id === multaId ? { ...m, status } : m)));

    const { error } = await (supabase as any)
      .from("gestao_frotas_multas")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", multaId);

    if (error) {
      setMultas(old);
      toast({ title: "Falha ao atualizar status", description: error.message, variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando multas...</div>;
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={goBack} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-sm text-primary-foreground">Gerenciamento de Multas</p>
          <p className="text-[11px] text-primary-foreground/80">Frotas • Condutor • CNH</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="rdo-card space-y-3 border border-primary/10">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm">Importar planilha de multas (.xlsx)</p>
            <span className="text-xs text-muted-foreground">Prévia: {importPreview.length}</span>
          </div>

          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processarArquivoMultas(file);
            }}
          />

          {importPreview.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {importPreview.filter((x) => x.equipment_fleet).length}/{importPreview.length} com frota resolvida • {importPreview.filter((x) => x.condutor_nome).length}/{importPreview.length} com condutor sugerido
              </div>
              <div className="text-xs font-medium flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-emerald-700">{importPreview.filter((x) => x.pode_importar).length} apta(s)</span>
                  <span className="text-muted-foreground"> • </span>
                  <span className="text-red-700">{importPreview.filter((x) => !x.pode_importar).length} bloqueada(s)</span>
                </div>
                {importPreview.filter((x) => !x.pode_importar).length > 0 && (
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={exportarBloqueadasCsv}>
                    <Download className="w-3.5 h-3.5" /> Exportar bloqueadas
                  </Button>
                )}
              </div>
              <div className="max-h-44 overflow-auto border rounded-lg p-2 space-y-1 bg-slate-50">
                {importPreview.slice(0, 20).map((r) => (
                  <div key={`${r.origem_linha}-${r.placa}-${r.data_infracao}`} className="text-xs flex items-center justify-between gap-2">
                    <span>L{r.origem_linha} • {r.placa} • {fmtDate(r.data_infracao)} • {fmtBRL(r.valor)}</span>
                    {r.pode_importar ? (
                      <span className="text-muted-foreground">{r.equipment_fleet || "sem frota"} • {r.condutor_nome || "sem condutor"}</span>
                    ) : (
                      <span className="text-red-700">{r.motivo_bloqueio}</span>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={importarPreview} disabled={importing || importPreview.filter((x) => x.pode_importar).length === 0} className="w-full gap-2">
                <Upload className="w-4 h-4" /> {importing ? "Importando..." : `Importar ${importPreview.filter((x) => x.pode_importar).length} multas aptas`}
              </Button>
            </div>
          )}
        </div>

        <div className="rdo-card space-y-3 border border-primary/10">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Nova multa operacional</p>
            <span className="text-xs text-muted-foreground">{multas.length} registrada(s)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input type="date" value={form.data_infracao} onChange={(e) => {
              const data = e.target.value;
              setForm((p) => ({ ...p, data_infracao: data }));
              if (form.placa) sugerirPorPlacaEData(form.placa, data);
            }} />
            <Input type="time" value={form.hora_infracao} onChange={(e) => setForm((p) => ({ ...p, hora_infracao: e.target.value }))} />

            <Input
              placeholder="Placa (ex.: FNP7D91)"
              value={form.placa}
              onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))}
              onBlur={() => sugerirPorPlacaEData(form.placa, form.data_infracao)}
            />
            <Input placeholder="Frota (automático)" value={form.equipment_fleet} onChange={(e) => setForm((p) => ({ ...p, equipment_fleet: e.target.value }))} />

            <Input placeholder="Auto de infração" value={form.auto_infracao} onChange={(e) => setForm((p) => ({ ...p, auto_infracao: e.target.value }))} />
            <Input placeholder="Valor (R$)" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} />

            <Input className="sm:col-span-2" placeholder="Local da infração" value={form.local_infracao} onChange={(e) => setForm((p) => ({ ...p, local_infracao: e.target.value }))} />
            <Input className="sm:col-span-2" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />

            <Select
              value={form.condutor_employee_id || "__manual"}
              onValueChange={(value) => {
                if (value === "__manual") {
                  setForm((p) => ({ ...p, condutor_employee_id: "" }));
                  return;
                }
                const emp = employeeById.get(value);
                setForm((p) => ({ ...p, condutor_employee_id: value, condutor_nome: emp?.name || p.condutor_nome }));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Condutor (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual">Selecionar manualmente (sem vínculo)</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input placeholder="Nome do condutor" value={form.condutor_nome} onChange={(e) => setForm((p) => ({ ...p, condutor_nome: e.target.value }))} />

            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
          </div>

          <Button onClick={salvarMulta} disabled={saving} className="w-full gap-2">
            {saving ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {saving ? "Salvando..." : "Cadastrar multa"}
          </Button>
        </div>

        <div className="space-y-3">
          {multas.length === 0 ? (
            <div className="rdo-card text-sm text-muted-foreground">Nenhuma multa cadastrada ainda.</div>
          ) : multas.map((m) => {
            const cnh = m.condutor_employee_id ? cnhByEmployee[m.condutor_employee_id] : null;
            const emp = m.condutor_employee_id ? employeeById.get(m.condutor_employee_id) : null;

            return (
              <div key={m.id} className="rdo-card space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{m.equipment_fleet || m.placa} • {fmtDate(m.data_infracao)} {m.hora_infracao || ""}</p>
                  <Select value={m.status} onValueChange={(v) => atualizarStatus(m.id, v)}>
                    <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-1">
                  <p><strong>Placa:</strong> {m.placa}</p>
                  <p><strong>Auto:</strong> {m.auto_infracao || "—"}</p>
                  <p><strong>Local:</strong> {m.local_infracao || "—"}</p>
                  <p><strong>Valor:</strong> {fmtBRL(m.valor)}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1">
                  <p className="text-xs flex items-center gap-1"><User className="w-3.5 h-3.5" /> <strong>Condutor:</strong> {m.condutor_nome || "Não informado"}</p>

                  {m.condutor_employee_id ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{emp?.role || "Função não informada"}</span>
                      <button className="underline text-primary" onClick={() => navigate(`/gestao-pessoas/${m.condutor_employee_id}`)}>
                        Abrir ficha
                      </button>
                    </div>
                  ) : null}

                  <p className="text-xs flex items-center gap-1"><IdCard className="w-3.5 h-3.5" /> <strong>CNH:</strong></p>
                  {cnh?.arquivo_url ? (
                    <div className="text-xs flex flex-wrap items-center gap-2">
                      <a className="underline text-primary" href={cnh.arquivo_url} target="_blank" rel="noreferrer">Ver anexo CNH</a>
                      <span className="text-muted-foreground">Validade: {fmtDate(cnh.validade)}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-700">Sem CNH anexada para este condutor.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
