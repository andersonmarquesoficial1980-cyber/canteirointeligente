import { useState, useEffect, useMemo } from "react";
import { fmtNum } from "@/lib/fmt";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Fuel, Loader2, Filter, Trash2, Clock, Truck, Droplets, ChevronDown, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import { buildEquipmentTypeOptionsFromEquipments, listEquipmentFleetsByCategory } from "@/lib/equipmentTypeCatalog";

const VEHICLE_PREFIXES = ["CM", "CC", "CP", "CE", "CB", "VT", "MCO", "BUS"];
const MACARICO_TYPE_VALUE = "MACARICO";
const MACARICO_FLEETS = ["CE01", "CE02", "CE03", "CE04", "CE16"];

function isVehicleFleet(frota: string) {
  return VEHICLE_PREFIXES.some(p => frota.toUpperCase().startsWith(p));
}

function isMacaricoType(tipo: string) {
  return String(tipo || "").trim().toUpperCase() === MACARICO_TYPE_VALUE;
}

function buildMacaricoFleetOptions() {
  return MACARICO_FLEETS.map((frota) => ({
    id: `macarico-${frota}`,
    frota: `${frota} - MAÇARICO`,
    nome: "MAÇARICO",
    categoria_rdo: "VEÍCULOS",
  }));
}

interface EntradaAbastecimento {
  id: string;
  hora: string;
  tipoEquipamento: string;
  frota: string;
  medicao: string;
  litros: string;
  ogs: string;
  lubrificado: boolean;
  lavado: boolean;
}

function novaEntrada(): EntradaAbastecimento {
  return {
    id: crypto.randomUUID(),
    hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    tipoEquipamento: "",
    frota: "",
    medicao: "",
    litros: "",
    ogs: "",
    lubrificado: false,
    lavado: false,
  };
}

interface AbastecimentoRow {
  id: string;
  equipment_fleet: string;
  equipment_type: string;
  data: string;
  hora: string;
  litros: number;
  horimetro: number;
  km_odometro: number;
  fonte: string;
  comboio_fleet: string;
  motorista_comboio: string;
  lubrificador: string;
  fornecedor: string;
  lubrificado: boolean;
  lavado: boolean;
  ogs: string;
  observacao: string;
  saldo_inicial: number;
  created_by?: string;
}

interface ExtratoReservatorioRow {
  id: string;
  timestamp: string;
  data: string;
  hora: string;
  tipo: "entrada" | "saida";
  litros: number;
  fornecedor?: string | null;
  lubrificador?: string | null;
  equipamento?: string | null;
  ogs?: string | null;
  saldoApos: number;
}

const FONTE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  comboio: { label: "Comboio",  color: "bg-blue-50 text-blue-700 border-blue-200",   emoji: "🚛" },
  posto:   { label: "Posto",    color: "bg-green-50 text-green-700 border-green-200", emoji: "⛽" },
  shelbox: { label: "Shelbox",  color: "bg-purple-50 text-purple-700 border-purple-200", emoji: "💳" },
  manual:  { label: "Manual",   color: "bg-gray-50 text-gray-600 border-gray-200",    emoji: "📝" },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function buildOgsOptions(ogsData: any[]) {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  // 000 primeiro, resto decrescente
  const sorted = [...ogsData].sort((a, b) => {
    if (a.ogs_number === "000") return -1;
    if (b.ogs_number === "000") return 1;
    return parseInt(b.ogs_number) - parseInt(a.ogs_number);
  });
  sorted.forEach((o: any) => {
    if (!o.ogs_number) return;
    const addrs = o.location_address
      ? o.location_address.split(";").map((s: string) => s.trim()).filter(Boolean)
      : [];
    if (addrs.length === 0) {
      const key = o.ogs_number;
      if (!seen.has(key)) { seen.add(key); options.push({ value: o.ogs_number, label: `${o.ogs_number} — ${o.client_name || ""}` }); }
    } else {
      addrs.forEach((addr: string) => {
        const key = `${o.ogs_number}|${addr}`;
        if (!seen.has(key)) { seen.add(key); options.push({ value: `${o.ogs_number} | ${addr}`, label: `${o.ogs_number} — ${o.client_name || ""} — ${addr}` }); }
      });
    }
  });
  return options;
}

export default function AbastecimentoHome() {
  const navigate = useNavigate();

  // ── Dados da tela principal ──
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFonte, setFiltroFonte] = useState("todas");
  const [filtroFrota, setFiltroFrota] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroTipoEquipamento, setFiltroTipoEquipamento] = useState("");
  const [filtroOgs, setFiltroOgs] = useState("");
  const [extratoComboioFrota, setExtratoComboioFrota] = useState("");
  const [extratoRows, setExtratoRows] = useState<ExtratoReservatorioRow[]>([]);
  const [extratoSaldoAtual, setExtratoSaldoAtual] = useState(0);
  const [extratoLoading, setExtratoLoading] = useState(false);

  // ── Modal de lançamento ──
  const [modal, setModal] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoCarga, setSalvandoCarga] = useState(false);

  // ── Dados de suporte ──
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [ogsData, setOgsData] = useState<any[]>([]);
  const [motoristas, setMotoristas] = useState<string[]>([]);
  const [lubrificadores, setLubrificadores] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isFuelAdmin, setIsFuelAdmin] = useState(false);

  // ── Modal edição ──
  const [editingRow, setEditingRow] = useState<AbastecimentoRow | null>(null);
  const [editLitros, setEditLitros] = useState("");
  const [editMedicao, setEditMedicao] = useState("");
  const [editOgs, setEditOgs] = useState("");
  const [editLubrificado, setEditLubrificado] = useState(false);
  const [editLavado, setEditLavado] = useState(false);
  const [editObs, setEditObs] = useState("");
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [abastConfig, setAbastConfig] = useState<{ motoristas: string[]; lubrificadores: string[]; fornecedores_diesel: string[] }>({ motoristas: [], lubrificadores: [], fornecedores_diesel: [] });

  // ── Estado do formulário de lançamento ──
  const [fonte, setFonte] = useState<"comboio" | "posto" | "shelbox" | "manual">("comboio");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [motoristaComboio, setMotoristaComboio] = useState("");
  const [lubrificador, setLubrificador] = useState("");
  const [comboioFrota, setComboioFrota] = useState("");
  // Saldo persistente do comboio
  const [saldoComboio, setSaldoComboio] = useState<number>(0);  // vem do DB
  const [buscandoSaldo, setBuscandoSaldo] = useState(false);
  const [fornecedor, setFornecedor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [entradas, setEntradas] = useState<EntradaAbastecimento[]>([novaEntrada()]);

  // ── Estado do modal Controle de Carga (reservatório) ──
  const [cargaData, setCargaData] = useState(new Date().toISOString().split("T")[0]);
  const [cargaHora, setCargaHora] = useState(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  const [cargaComboioFrota, setCargaComboioFrota] = useState("");
  const [cargaFornecedor, setCargaFornecedor] = useState("");
  const [cargaLubrificador, setCargaLubrificador] = useState("");
  const [cargaLitros, setCargaLitros] = useState("");
  const [cargaObservacao, setCargaObservacao] = useState("");

  // Para posto/shelbox/manual — lançamento simples
  const [simpFrota, setSimpFrota] = useState("");
  const [simpTipoEquip, setSimpTipoEquip] = useState("");
  const [simpHora, setSimpHora] = useState("");
  const [simpLitros, setSimpLitros] = useState("");
  const [simpMedicao, setSimpMedicao] = useState("");
  const [simpOgs, setSimpOgs] = useState("");
  const [simpFornecedor, setSimpFornecedor] = useState("");
  const [simpLubrificado, setSimpLubrificado] = useState(false);
  const [simpAutorizadoPor, setSimpAutorizadoPor] = useState("");

  useEffect(() => { buscarTudo(); }, []);

  async function buscarTudo() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
    const cid = (profile as any)?.company_id || null;
    setCompanyId(cid);

    const [abast, equips, ogsRes, cfgRes, opComboio, opLubri] = await Promise.all([
      supabase.from("abastecimentos").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("equipamentos").select("id, frota, nome, placa, tipo, categoria_rdo").in("status", ["ativo", "Operando"]).order("frota"),
      (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address"),
      (supabase as any).from("abastecimento_config").select("*").eq("company_id", cid).maybeSingle(),
      // Habilitados para Comboio e Lubrificador (join manual via funcionario_id)
      (supabase as any).from("equipment_type_operators").select("funcionario_id").eq("equipment_type", "Comboio").eq("company_id", cid),
      (supabase as any).from("equipment_type_operators").select("funcionario_id").eq("equipment_type", "Lubrificador").eq("company_id", cid),
    ]);

    if (abast.data) setAbastecimentos(abast.data as AbastecimentoRow[]);
    if (equips.data) setEquipamentos(equips.data);
    if (ogsRes.data) setOgsData(ogsRes.data);
    if (cfgRes.data) setAbastConfig(cfgRes.data);

    // Buscar nomes dos funcionários habilitados
    const idsComboio = (opComboio.data || []).map((r: any) => r.funcionario_id).filter(Boolean);
    const idsLubri = (opLubri.data || []).map((r: any) => r.funcionario_id).filter(Boolean);

    if (idsComboio.length > 0) {
      const { data: nomes } = await (supabase as any).from("employees").select("name").in("id", idsComboio).order("name");
      if (nomes) setMotoristas(nomes.map((r: any) => r.name).filter(Boolean));
    }
    if (idsLubri.length > 0) {
      const { data: nomes } = await (supabase as any).from("employees").select("name").in("id", idsLubri).order("name");
      if (nomes) setLubrificadores(nomes.map((r: any) => r.name).filter(Boolean));
    }
    // Checar se usuário é fuel_admin
    const { data: fuelAdminCheck } = await (supabase as any)
      .from("user_admin_roles")
      .select("id, admin_roles(name)")
      .eq("user_id", user.id)
      .eq("is_active", true);
    const fuelAdminNames = (fuelAdminCheck || []).map((r: any) => r.admin_roles?.name?.toLowerCase() || "");
    setIsFuelAdmin(fuelAdminNames.some((n: string) => n.includes("fuel") || n.includes("abastec")));

    setLoading(false);
  }

  const ogsOptions = useMemo(() => buildOgsOptions(ogsData), [ogsData]);
  const equipmentTypeOptions = useMemo(() => {
    const dynamicOptions = buildEquipmentTypeOptionsFromEquipments(equipamentos as any[]).filter((opt) => opt.value !== "OUTROS");
    const hasMacarico = dynamicOptions.some((opt) => isMacaricoType(opt.value));
    return hasMacarico
      ? dynamicOptions
      : [...dynamicOptions, { value: MACARICO_TYPE_VALUE, label: "MAÇARICO" }];
  }, [equipamentos]);
  const fornecedoresList = abastConfig.fornecedores_diesel.length > 0 ? abastConfig.fornecedores_diesel : ["Posto Fremix", "Shell", "Rimacris", "Petrobrás"];
  const listMotoristas = motoristas;
  const listLubrificadores = lubrificadores;

  // Frotas de comboio — filtrar pelo tipo
  const frotasComboio = equipamentos.filter((e: any) =>
    e.tipo?.toLowerCase().includes("comboio")
  );

  useEffect(() => {
    if (!extratoComboioFrota && frotasComboio.length > 0) {
      setExtratoComboioFrota(frotasComboio[0].frota || "");
    }
    if (!cargaComboioFrota && frotasComboio.length === 1) {
      setCargaComboioFrota(frotasComboio[0].frota || "");
    }
  }, [frotasComboio, extratoComboioFrota, cargaComboioFrota]);

  useEffect(() => {
    if (!companyId || !extratoComboioFrota) {
      setExtratoRows([]);
      setExtratoSaldoAtual(0);
      return;
    }
    carregarExtratoReservatorio(extratoComboioFrota);
  }, [companyId, extratoComboioFrota]);

  function eventTimestamp(date?: string | null, hour?: string | null, fallback?: string | null) {
    if (date && hour) return new Date(`${date}T${hour}`).toISOString();
    if (date) return new Date(`${date}T00:00:00`).toISOString();
    if (fallback) return new Date(fallback).toISOString();
    return new Date(0).toISOString();
  }

  async function carregarExtratoReservatorio(frota: string) {
    if (!companyId || !frota) return;
    setExtratoLoading(true);
    try {
      const [saldoRes, reposicoesRes, saidasRes] = await Promise.all([
        (supabase as any)
          .from("comboio_saldo")
          .select("saldo_atual")
          .eq("company_id", companyId)
          .eq("comboio_fleet", frota)
          .maybeSingle(),
        (supabase as any)
          .from("comboio_reposicoes")
          .select("id, data, hora, litros, fornecedor, lubrificador, created_at")
          .eq("company_id", companyId)
          .eq("comboio_fleet", frota)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(120),
        (supabase as any)
          .from("abastecimentos")
          .select("id, data, hora, litros, fornecedor, equipment_fleet, ogs, created_at")
          .eq("company_id", companyId)
          .eq("fonte", "comboio")
          .eq("comboio_fleet", frota)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(240),
      ]);

      const saldoAtual = Number(saldoRes.data?.saldo_atual || 0);
      setExtratoSaldoAtual(saldoAtual);

      const entradas = (reposicoesRes.data || []).map((r: any) => ({
        id: `repo-${r.id}`,
        timestamp: eventTimestamp(r.data, r.hora, r.created_at),
        data: r.data || "",
        hora: r.hora || (r.created_at ? new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""),
        tipo: "entrada" as const,
        litros: Number(r.litros || 0),
        fornecedor: r.fornecedor || null,
        lubrificador: r.lubrificador || null,
        equipamento: null,
        ogs: null,
        delta: Number(r.litros || 0),
      }));

      const saidas = (saidasRes.data || []).map((s: any) => ({
        id: `abast-${s.id}`,
        timestamp: eventTimestamp(s.data, s.hora, s.created_at),
        data: s.data || "",
        hora: s.hora || (s.created_at ? new Date(s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""),
        tipo: "saida" as const,
        litros: Number(s.litros || 0),
        fornecedor: s.fornecedor || null,
        equipamento: s.equipment_fleet || null,
        ogs: s.ogs || null,
        delta: -Number(s.litros || 0),
      }));

      const eventos = [...entradas, ...saidas].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      let runningAfter = saldoAtual;
      const extrato: ExtratoReservatorioRow[] = eventos.map((ev) => {
        const row: ExtratoReservatorioRow = {
          id: ev.id,
          timestamp: ev.timestamp,
          data: ev.data,
          hora: ev.hora,
          tipo: ev.tipo,
          litros: ev.litros,
          fornecedor: ev.fornecedor,
          lubrificador: ev.lubrificador,
          equipamento: ev.equipamento,
          ogs: ev.ogs,
          saldoApos: runningAfter,
        };
        runningAfter = runningAfter - ev.delta;
        return row;
      });

      setExtratoRows(extrato);
    } catch (e) {
      console.error("Erro ao carregar extrato do reservatório:", e);
      setExtratoRows([]);
    } finally {
      setExtratoLoading(false);
    }
  }

  function getEquipsByTipo(tipo: string) {
    if (!tipo) return [];
    if (isMacaricoType(tipo)) return buildMacaricoFleetOptions();
    return listEquipmentFleetsByCategory(equipamentos as any[], tipo);
  }

  function getFleetOptionLabel(equipment: any) {
    const frota = String(equipment?.frota || "").trim();
    const nome = String(equipment?.nome || "").trim();
    const placa = String(equipment?.placa || "").trim();

    if (!frota) return nome || placa || "-";

    const isVehicle = isVehicleFleet(frota) || String(equipment?.categoria_rdo || "").toUpperCase() === "VEÍCULOS";

    if (isVehicle) {
      if (placa) return `${frota} — ${placa}`;
      if (nome && nome.toUpperCase() !== frota.toUpperCase()) return `${frota} — ${nome}`;
    }

    return frota;
  }

  const totalAbastecido = useMemo(
    () => entradas.reduce((s, e) => s + (Number(e.litros) || 0), 0),
    [entradas]
  );
  // Saldo projetado durante o lançamento de abastecimento
  const saldoAtualCalculado = saldoComboio - totalAbastecido;
  // Buscar saldo persistente do comboio quando frota mudar
  async function buscarSaldoComboio(frota: string) {
    if (!frota || !companyId) { setSaldoComboio(0); return; }
    setBuscandoSaldo(true);
    const { data } = await (supabase as any)
      .from("comboio_saldo")
      .select("saldo_atual")
      .eq("company_id", companyId)
      .eq("comboio_fleet", frota)
      .maybeSingle();
    setSaldoComboio(data?.saldo_atual ?? 0);
    setBuscandoSaldo(false);
  }
  function abrirEdicao(a: AbastecimentoRow) {
    setEditingRow(a);
    setEditLitros(String(a.litros || ""));
    setEditMedicao(String(a.horimetro || a.km_odometro || ""));
    setEditOgs(a.ogs || "");
    setEditLubrificado(!!a.lubrificado);
    setEditLavado(!!a.lavado);
    setEditObs(a.observacao || "");
  }

  async function salvarEdicao() {
    if (!editingRow) return;
    setSalvandoEdit(true);
    try {
      const litros = parseFloat(String(editLitros).replace(",", "."));
      const medicaoVal = editMedicao ? parseFloat(String(editMedicao).replace(",", ".")) : null;
      await (supabase as any).from("abastecimentos").update({
        litros: isNaN(litros) ? editingRow.litros : litros,
        horimetro: !isVehicleFleet(editingRow.equipment_fleet) ? medicaoVal : null,
        km_odometro: isVehicleFleet(editingRow.equipment_fleet) ? medicaoVal : null,
        ogs: editOgs || null,
        lubrificado: editLubrificado,
        lavado: editLavado,
        observacao: editObs || null,
      }).eq("id", editingRow.id);
      setEditingRow(null);
      buscarTudo();
    } catch (e) { console.error(e); }
    finally { setSalvandoEdit(false); }
  }

  async function excluirLancamento(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    await (supabase as any).from("abastecimentos").delete().eq("id", id);
    buscarTudo();
  }
  function resetForm() {
    setFonte("comboio");
    setData(new Date().toISOString().split("T")[0]);
    setMotoristaComboio(""); setLubrificador(""); setComboioFrota("");
    // auto-select se só um comboio
    if (frotasComboio.length === 1) setComboioFrota(frotasComboio[0].frota);
    setSaldoComboio(0); setFornecedor(""); setObservacao("");
    setEntradas([novaEntrada()]);
    setSimpFrota(""); setSimpTipoEquip(""); setSimpHora(""); setSimpLitros("");
    setSimpMedicao(""); setSimpOgs(""); setSimpFornecedor("");
    setSimpLubrificado(false); setSimpAutorizadoPor("");
  }

  function resetModalCarga() {
    setCargaData(new Date().toISOString().split("T")[0]);
    setCargaHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    setCargaComboioFrota(frotasComboio.length === 1 ? (frotasComboio[0].frota || "") : "");
    setCargaFornecedor("");
    setCargaLubrificador("");
    setCargaLitros("");
    setCargaObservacao("");
  }

  async function salvarControleCarga() {
    if (!companyId) return;
    const litrosNum = Number(cargaLitros);
    if (!cargaComboioFrota || !litrosNum || litrosNum <= 0 || !cargaLubrificador) return;

    setSalvandoCarga(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      const currentUserId = currentUser.user?.id;

      const { data: saldoAtualDb } = await (supabase as any)
        .from("comboio_saldo")
        .select("saldo_atual")
        .eq("company_id", companyId)
        .eq("comboio_fleet", cargaComboioFrota)
        .maybeSingle();

      const saldoAtualNumero = Number(saldoAtualDb?.saldo_atual || 0);
      const novoSaldo = saldoAtualNumero + litrosNum;

      await (supabase as any).from("comboio_reposicoes").insert({
        company_id: companyId,
        comboio_fleet: cargaComboioFrota,
        litros: litrosNum,
        data: cargaData,
        hora: cargaHora || null,
        fornecedor: cargaFornecedor || null,
        lubrificador: cargaLubrificador || null,
        observacao: cargaObservacao || null,
        created_by: currentUserId,
      });

      await (supabase as any).from("comboio_saldo").upsert(
        { company_id: companyId, comboio_fleet: cargaComboioFrota, saldo_atual: novoSaldo, updated_by: currentUserId, updated_at: new Date().toISOString() },
        { onConflict: "company_id,comboio_fleet" }
      );

      if (comboioFrota === cargaComboioFrota) {
        setSaldoComboio(novoSaldo);
      }
      if (extratoComboioFrota === cargaComboioFrota) {
        carregarExtratoReservatorio(cargaComboioFrota);
      }

      setModalCarga(false);
      resetModalCarga();
      buscarTudo();
    } catch (e) {
      console.error(e);
    } finally {
      setSalvandoCarga(false);
    }
  }

  function updateEntrada(idx: number, field: keyof EntradaAbastecimento, value: any) {
    const updated = [...entradas];
    if (field === "tipoEquipamento") {
      updated[idx] = { ...updated[idx], tipoEquipamento: value, frota: "" };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setEntradas(updated);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const base = { data, created_by: user?.id, company_id: companyId, fonte };

      if (fonte === "comboio") {
        // Salva uma linha por entrada de abastecimento
        const rows = entradas
          .filter(e => e.frota && e.litros)
          .map(e => ({
            ...base,
            hora: e.hora || null,
            equipment_fleet: e.frota,
            equipment_type: e.tipoEquipamento || null,
            litros: parseFloat(String(e.litros).replace(",", ".")),
            horimetro: !isVehicleFleet(e.frota) && e.medicao ? parseFloat(String(e.medicao).replace(",", ".")) : null,
            km_odometro: isVehicleFleet(e.frota) && e.medicao ? parseFloat(String(e.medicao).replace(",", ".")) : null,
            ogs: e.ogs || null,
            lubrificado: e.lubrificado,
            lavado: e.lavado,
            comboio_fleet: comboioFrota || null,
            motorista_comboio: motoristaComboio || null,
            lubrificador: lubrificador || null,
            fornecedor: fornecedor || null,
            observacao: observacao || null,
          }));

        if (rows.length === 0) {
          setSalvando(false);
          return;
        }

        await (supabase as any).from("abastecimentos").insert(rows);

        // Atualizar saldo persistente do comboio após a saída para equipamentos
        if (comboioFrota && companyId) {
          const novoSaldo = saldoAtualCalculado;
          const { data: currentUser } = await supabase.auth.getUser();
          const currentUserId = currentUser.user?.id;

          await (supabase as any).from("comboio_saldo").upsert(
            { company_id: companyId, comboio_fleet: comboioFrota, saldo_atual: novoSaldo, updated_by: currentUserId, updated_at: new Date().toISOString() },
            { onConflict: "company_id,comboio_fleet" }
          );
        }
      } else {
        if (!simpFrota || !simpLitros) return;
        await supabase.from("abastecimentos").insert({
          ...base,
          hora: simpHora || null,
          equipment_fleet: simpFrota,
          equipment_type: simpTipoEquip || null,
          litros: parseFloat(String(simpLitros).replace(",", ".")),
          horimetro: simpMedicao ? parseFloat(String(simpMedicao).replace(",", ".")) : null,
          ogs: simpOgs || null,
          fornecedor: simpFornecedor || null,
          lubrificado: simpLubrificado,
          autorizado_por: fonte === "shelbox" ? (simpAutorizadoPor || null) : null,
          observacao: observacao || null,
        });
      }
      setModal(false);
      resetForm();
      buscarTudo();
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  }

  const filtrados = abastecimentos.filter(a => {
    if (filtroFonte !== "todas" && a.fonte !== filtroFonte) return false;
    if (filtroFrota && !a.equipment_fleet?.toLowerCase().includes(filtroFrota.toLowerCase())) return false;
    if (filtroDataInicio && a.data < filtroDataInicio) return false;
    if (filtroDataFim && a.data > filtroDataFim) return false;
    if (filtroTipoEquipamento && filtroTipoEquipamento !== "__todos__" && a.equipment_type !== filtroTipoEquipamento) return false;
    if (filtroOgs && !a.ogs?.toLowerCase().includes(filtroOgs.toLowerCase())) return false;
    return true;
  });
  
  const totalLitros = filtrados.reduce((s, a) => s + (a.litros || 0), 0);
  
  // Agrupar por equipamento_frota para o accordion
  const porEquipamento: Record<string, AbastecimentoRow[]> = {};
  filtrados.forEach(a => {
    const key = a.equipment_fleet || "Sem Frota";
    if (!porEquipamento[key]) porEquipamento[key] = [];
    porEquipamento[key].push(a);
  });

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Abastecimento</span>
          <span className="block text-[11px] text-primary-foreground/80">Comboio, Posto e Shelbox</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Programações do dia */}
        <ProgramacoesDoDia />

        {/* ── EXTRATO DO RESERVATÓRIO DO COMBOIO ── */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-primary" />
            <span className="text-sm font-display font-extrabold text-foreground uppercase tracking-wide">Extrato do Reservatório</span>
            <span className="ml-auto text-xs text-muted-foreground">Saldo atual: <span className={`font-bold ${extratoSaldoAtual < 0 ? "text-red-600" : "text-green-700"}`}>{fmtNum(extratoSaldoAtual)} L</span></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
            <div className="space-y-1.5">
              <span className="rdo-label">Comboio</span>
              <Select value={extratoComboioFrota} onValueChange={setExtratoComboioFrota}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {frotasComboio.map((e: any) => (
                    <SelectItem key={`extrato-${e.id}`} value={e.frota}>{e.frota} — {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-2">
              Entradas = abastecimento do tanque (reposições) · Saídas = abastecimentos feitos nos equipamentos.
            </div>
          </div>

          {extratoLoading ? (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando extrato...
            </div>
          ) : extratoComboioFrota ? (
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[90px_56px_74px_74px_1fr_120px] gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide bg-muted/40">
                <span>Data</span>
                <span>Hora</span>
                <span>Tipo</span>
                <span className="text-right">Litros</span>
                <span>Referência</span>
                <span className="text-right">Saldo após</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y">
                {extratoRows.length === 0 && (
                  <div className="px-3 py-4 text-xs text-muted-foreground">Sem movimentações para este comboio.</div>
                )}
                {extratoRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[90px_56px_74px_74px_1fr_120px] gap-2 px-3 py-2 text-xs items-center">
                    <span>{fmtDate(r.data)}</span>
                    <span>{r.hora || "--:--"}</span>
                    <span className={`font-semibold ${r.tipo === "entrada" ? "text-green-700" : "text-orange-700"}`}>{r.tipo === "entrada" ? "Entrada" : "Saída"}</span>
                    <span className={`text-right font-semibold ${r.tipo === "entrada" ? "text-green-700" : "text-orange-700"}`}>{r.tipo === "entrada" ? "+" : "-"}{fmtNum(r.litros)}</span>
                    <span className="truncate" title={r.tipo === "entrada" ? `${r.fornecedor || "Reposição"}${r.lubrificador ? ` · Lubrificador: ${r.lubrificador}` : ""}` : `${r.equipamento || "Frota"}${r.ogs ? ` · OGS ${r.ogs}` : ""}`}>
                      {r.tipo === "entrada" ? `${r.fornecedor || "Reposição de tanque"}${r.lubrificador ? ` · ${r.lubrificador}` : ""}` : `${r.equipamento || "Frota"}${r.ogs ? ` · OGS ${r.ogs}` : ""}`}
                    </span>
                    <span className={`text-right font-bold ${r.saldoApos < 0 ? "text-red-600" : "text-foreground"}`}>{fmtNum(r.saldoApos)} L</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Selecione um comboio para visualizar o extrato.</div>
          )}
        </div>

        {/* ── AÇÕES DE LANÇAMENTO ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => { resetForm(); setModal(true); }}
            className="w-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all border border-primary/50"
          >
            <div className="flex items-center justify-center gap-3">
              <Plus className="w-8 h-8" />
              <span className="font-display font-bold text-lg">+ Lançar Abastecimento</span>
            </div>
          </button>

          <button
            onClick={() => { resetModalCarga(); setModalCarga(true); }}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-600/90 hover:to-blue-500/90 text-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all border border-blue-500/60"
          >
            <div className="flex items-center justify-center gap-3">
              <Fuel className="w-8 h-8" />
              <span className="font-display font-bold text-lg">+ Controle de Carga</span>
            </div>
          </button>
        </div>

        {/* ── MEUS LANÇAMENTOS ── */}
        {(() => {
           const meusLancamentos = isFuelAdmin
             ? abastecimentos
             : abastecimentos.filter(a => a.created_by === userId);
          if (meusLancamentos.length === 0) return null;
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" />
                 <span className="text-sm font-display font-extrabold text-foreground uppercase tracking-wide">{isFuelAdmin ? "Todos os Lançamentos" : "Meus Lançamentos"}</span>
                <span className="ml-auto text-xs text-muted-foreground">{meusLancamentos.length} registro{meusLancamentos.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {meusLancamentos.slice(0, 10).map(a => {
                  const cfg = FONTE_CONFIG[a.fonte] || FONTE_CONFIG.manual;
                  const medicao = a.horimetro ? `${fmtNum(a.horimetro)} h` : a.km_odometro ? `${fmtNum(a.km_odometro)} km` : null;
                   const podeEditarExcluir = isFuelAdmin || a.created_by === userId;
                  return (
                    <div key={a.id} className="bg-card border rounded-2xl p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{fmtDate(a.data)}{a.hora ? ` · ${a.hora}` : ""}</span>
                         {podeEditarExcluir && (
                           <div className="flex gap-1 ml-1">
                             <button
                               onClick={() => abrirEdicao(a)}
                               className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                               title="Editar"
                             >
                               <Pencil className="w-3.5 h-3.5" />
                             </button>
                             <button
                               onClick={() => excluirLancamento(a.id)}
                               className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                               title="Excluir"
                             >
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                           </div>
                         )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-bold">{a.equipment_fleet}</span>
                        {a.equipment_type && <span className="text-xs text-muted-foreground">({a.equipment_type})</span>}
                        <span className="ml-auto text-sm font-bold text-primary">{fmtNum(a.litros)} L</span>
                      </div>
                      {(a.ogs || medicao || a.comboio_fleet) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {a.comboio_fleet && <span>🚛 {a.comboio_fleet}</span>}
                          {a.ogs && <span>OGS: {a.ogs}</span>}
                          {medicao && <span>⏱ {medicao}</span>}
                        </div>
                      )}
                      <div className="flex gap-3 text-xs">
                        {a.lubrificado && <span className="text-green-600 font-medium">✓ Lubrificado</span>}
                        {a.lavado && <span className="text-blue-600 font-medium">✓ Lavado</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Espaço pra rodapé */}
        <div className="h-24" />
      </div>


      {/* ── MODAL DE LANÇAMENTO (idêntico ao original) ── */}
      <Dialog open={modal} onOpenChange={v => { if (!v) resetForm(); setModal(v); }}>
        <DialogContent className="max-w-lg mx-2 rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Lançar Abastecimento</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Fonte */}
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Lançamento *</span>
              <div className="grid grid-cols-2 gap-2">
                {(["comboio", "posto", "shelbox", "manual"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFonte(f)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-colors ${fonte === f ? "bg-primary text-white border-primary" : "bg-secondary border-border text-foreground hover:border-primary/50"}`}
                  >
                    {FONTE_CONFIG[f].emoji} {FONTE_CONFIG[f].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <span className="rdo-label">Data *</span>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-11 rounded-xl" />
            </div>

            {/* ══ COMBOIO ══ */}
            {fonte === "comboio" && (
              <>
                {/* Frota do Comboio */}
                <div className="space-y-1.5">
                  <span className="rdo-label">Frota do Comboio *</span>
                  <Select value={comboioFrota} onValueChange={v => { setComboioFrota(v); buscarSaldoComboio(v); }}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o comboio..." /></SelectTrigger>
                    <SelectContent>
                      {frotasComboio.map((e: any) => (
                        <SelectItem key={e.id} value={e.frota}>{e.frota} — {e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Motorista + Lubrificador */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Motorista do Comboio</span>
                    <Select value={motoristaComboio} onValueChange={setMotoristaComboio}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={listMotoristas.length === 0 ? "Configure no Painel" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        {listMotoristas.map((nome: string) => (
                          <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                        ))}
                        {listMotoristas.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre em Painel → WF Abastecimento</div>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Lubrificador</span>
                    <Select value={lubrificador} onValueChange={setLubrificador}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={listLubrificadores.length === 0 ? "Configure no Painel" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>
                        {listLubrificadores.map((nome: string) => (
                          <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                        ))}
                        {listLubrificadores.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre em Painel → WF Abastecimento</div>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Saldo projetado do reservatório */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide flex items-center gap-2 border-b border-border pb-2">
                    <Fuel className="w-4 h-4" /> RESERVATÓRIO DO COMBOIO
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="rdo-label">Saldo Atual (Litros)</span>
                      <div className={`h-11 rounded-xl border flex items-center px-3 font-bold text-sm ${saldoAtualCalculado < 0 ? "bg-red-50 border-red-300 text-red-700" : saldoAtualCalculado < 50 ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-green-50 border-green-300 text-green-700"}`}>
                        {buscandoSaldo ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{fmtNum(saldoAtualCalculado)} L</>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="rdo-label">Fornecedor do Abastecimento</span>
                      <Select value={fornecedor} onValueChange={setFornecedor}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {fornecedoresList.map((f: string) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(saldoComboio > 0 || totalAbastecido > 0) && (
                    <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded-xl px-3 py-2">
                      {saldoComboio > 0 && <div>📦 Saldo anterior: <span className="font-semibold text-foreground">{fmtNum(saldoComboio)} L</span></div>}
                      {totalAbastecido > 0 && <div>🚜 Abastecido agora: <span className="font-semibold text-orange-600">−{fmtNum(totalAbastecido)} L</span></div>}
                    </div>
                  )}
                </div>

                {/* Abastecimentos de Frota */}
                <div className="space-y-3">
                  <h3 className="text-sm font-display font-extrabold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" /> ABASTECIMENTO DE FROTA
                  </h3>

                  {entradas.map((entry, idx) => {
                    const equipsDoTipo = getEquipsByTipo(entry.tipoEquipamento);
                    return (
                      <div key={entry.id} className="bg-card border border-border rounded-2xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={entry.tipoEquipamento} onValueChange={v => updateEntrada(idx, "tipoEquipamento", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Tipo *" /></SelectTrigger>
                            <SelectContent>
                              {equipmentTypeOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={entry.frota} onValueChange={v => updateEntrada(idx, "frota", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Frota *" /></SelectTrigger>
                            <SelectContent>
                              {equipsDoTipo.map((e: any) => (
                                <SelectItem key={e.id} value={e.frota}>{getFleetOptionLabel(e)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" value={entry.litros} onChange={e => updateEntrada(idx, "litros", e.target.value)} className="h-9 rounded-lg text-xs col-span-1" placeholder="Litros *" />
                          <Input type="number" value={entry.medicao} onChange={e => updateEntrada(idx, "medicao", e.target.value)} className="h-9 rounded-lg text-xs col-span-2" placeholder="Hor / Odo" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={entry.ogs} onValueChange={v => updateEntrada(idx, "ogs", v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="OGS" /></SelectTrigger>
                            <SelectContent>
                              {ogsOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={entry.lubrificado} onCheckedChange={v => updateEntrada(idx, "lubrificado", v)} />
                            <label className="text-xs">Lubrificado</label>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={entry.lavado} onCheckedChange={v => updateEntrada(idx, "lavado", v)} />
                          <label className="text-xs">Lavado</label>
                        </div>
                        {entradas.length > 1 && (
                          <button onClick={() => setEntradas(entradas.filter((_, i) => i !== idx))} className="text-xs text-red-600 hover:underline">
                            Remover
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <Button variant="outline" onClick={() => setEntradas([...entradas, novaEntrada()])} className="w-full h-9 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar Entrada
                  </Button>
                </div>
              </>
            )}

            {/* ══ POSTO / SHELBOX / MANUAL ══ */}
            {fonte !== "comboio" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Frota *</span>
                    <Select value={simpFrota} onValueChange={setSimpFrota}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {equipamentos.map((e: any) => (
                          <SelectItem key={e.id} value={e.frota}>{getFleetOptionLabel(e)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Tipo</span>
                    <Select value={simpTipoEquip} onValueChange={setSimpTipoEquip}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {equipmentTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" value={simpHora} onChange={e => setSimpHora(e.target.value)} className="h-11 rounded-xl" placeholder="Hora" />
                  <Input type="number" value={simpLitros} onChange={e => setSimpLitros(e.target.value)} className="h-11 rounded-xl" placeholder="Litros *" />
                </div>
                <Input type="number" value={simpMedicao} onChange={e => setSimpMedicao(e.target.value)} className="h-11 rounded-xl" placeholder="Medição (Hor/KM)" />
                <Select value={simpOgs} onValueChange={setSimpOgs}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="OGS" /></SelectTrigger>
                  <SelectContent>
                    {ogsOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={simpFornecedor} onValueChange={setSimpFornecedor}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                  <SelectContent>
                    {fornecedoresList.map((f: string) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox checked={simpLubrificado} onCheckedChange={v => setSimpLubrificado(v === true)} />
                  <label className="text-sm">Lubrificado</label>
                </div>
                {fonte === "shelbox" && (
                  <Input value={simpAutorizadoPor} onChange={e => setSimpAutorizadoPor(e.target.value)} className="h-11 rounded-xl" placeholder="Autorizado Por" />
                )}
              </>
            )}

            {/* Observação */}
            <div className="space-y-1.5">
              <span className="rdo-label">Observação</span>
              <Input value={observacao} onChange={e => setObservacao(e.target.value)} className="h-11 rounded-xl" placeholder="Adicione observações..." />
            </div>

            <Button onClick={salvar} disabled={salvando} className="w-full h-11 gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {salvando ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL CONTROLE DE CARGA (RESERVATÓRIO) ── */}
      <Dialog open={modalCarga} onOpenChange={v => { if (!v) resetModalCarga(); setModalCarga(v); }}>
        <DialogContent className="max-w-lg mx-2 rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Controle de Carga do Reservatório</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="rdo-label">Data *</span>
                <Input type="date" value={cargaData} onChange={e => setCargaData(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Hora</span>
                <Input type="time" value={cargaHora} onChange={e => setCargaHora(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Frota do Comboio *</span>
              <Select value={cargaComboioFrota} onValueChange={setCargaComboioFrota}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {frotasComboio.map((e: any) => (
                    <SelectItem key={`carga-${e.id}`} value={e.frota}>{e.frota} — {e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="rdo-label">Litros carregados *</span>
                <Input
                  type="number"
                  value={cargaLitros}
                  onChange={e => setCargaLitros(e.target.value)}
                  placeholder="Ex.: 5000"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Fornecedor</span>
                <Select value={cargaFornecedor} onValueChange={setCargaFornecedor}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedoresList.map((f: string) => (
                      <SelectItem key={`carga-forn-${f}`} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Lubrificador responsável *</span>
              <Select value={cargaLubrificador} onValueChange={setCargaLubrificador}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={listLubrificadores.length === 0 ? "Configure no Painel" : "Selecione..."} /></SelectTrigger>
                <SelectContent>
                  {listLubrificadores.map((nome: string) => (
                    <SelectItem key={`carga-lub-${nome}`} value={nome}>{nome}</SelectItem>
                  ))}
                  {listLubrificadores.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre em Painel → WF Abastecimento</div>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Observação / Equipe responsável</span>
              <Input
                value={cargaObservacao}
                onChange={e => setCargaObservacao(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="Ex.: Equipe base Fremix, turno manhã"
              />
            </div>

            <Button onClick={salvarControleCarga} disabled={salvandoCarga || !cargaComboioFrota || !(Number(cargaLitros) > 0) || !cargaLubrificador} className="w-full h-11 gap-2">
              {salvandoCarga ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fuel className="w-4 h-4" />}
              {salvandoCarga ? "Salvando carga..." : "Salvar Controle de Carga"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

       {/* ── MODAL DE EDIÇÃO ── */}
       <Dialog open={!!editingRow} onOpenChange={v => { if (!v) setEditingRow(null); }}>
         <DialogContent className="max-w-sm mx-2 rounded-2xl">
           <DialogHeader><DialogTitle className="font-display font-bold">Editar Lançamento</DialogTitle></DialogHeader>
           {editingRow && (
             <div className="space-y-3">
               <div className="bg-muted/40 rounded-xl px-3 py-2 text-sm">
                 <span className="font-bold text-primary">{editingRow.equipment_fleet}</span>
                 {editingRow.equipment_type && <span className="text-muted-foreground ml-2">({editingRow.equipment_type})</span>}
                 <span className="text-xs text-muted-foreground ml-2">· {fmtDate(editingRow.data)}</span>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1.5">
                   <span className="rdo-label">Litros *</span>
                   <Input type="number" value={editLitros} onChange={e => setEditLitros(e.target.value)} className="h-11 rounded-xl font-bold" />
                 </div>
                 <div className="space-y-1.5">
                   <span className="rdo-label">Hor / Odo</span>
                   <Input type="number" value={editMedicao} onChange={e => setEditMedicao(e.target.value)} className="h-11 rounded-xl" placeholder="—" />
                 </div>
               </div>
               <div className="space-y-1.5">
                 <span className="rdo-label">OGS</span>
                 <Select value={editOgs} onValueChange={setEditOgs}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     {ogsOptions.map(opt => (
                       <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                   <Checkbox checked={editLubrificado} onCheckedChange={v => setEditLubrificado(v === true)} />
                   <label className="text-sm">Lubrificado</label>
                 </div>
                 <div className="flex items-center gap-2">
                   <Checkbox checked={editLavado} onCheckedChange={v => setEditLavado(v === true)} />
                   <label className="text-sm">Lavado</label>
                 </div>
               </div>
               <div className="space-y-1.5">
                 <span className="rdo-label">Observação</span>
                 <Input value={editObs} onChange={e => setEditObs(e.target.value)} className="h-11 rounded-xl" placeholder="Observações..." />
               </div>
               <Button onClick={salvarEdicao} disabled={salvandoEdit} className="w-full h-11 gap-2">
                 {salvandoEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                 {salvandoEdit ? "Salvando..." : "Salvar Alterações"}
               </Button>
             </div>
           )}
         </DialogContent>
       </Dialog>
      </div>
      );
      }
