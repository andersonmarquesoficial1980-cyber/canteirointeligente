import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import { ArrowLeft, Plus, Car, Wrench, FileText, Fuel, Search, ChevronRight, BarChart3, Loader2, MapPin, Radio, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEquipamentoTipos } from "@/hooks/useEquipamentoTipos";
import { useToast } from "@/hooks/use-toast";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatLitros(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function labelFonte(fonte: string) {
  const key = (fonte || "manual").toLowerCase();
  if (key === "comboio") return "Comboio";
  if (key === "posto") return "Posto";
  if (key === "shelbox") return "Shelbox";
  return "Manual";
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const data = dt.toLocaleDateString("pt-BR");
  const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} ${hora}`;
}

const GF_FILTROS_KEY = "gestao-frotas-home:filtros-v10.3";
const AUDIT_PAGE_SIZE = 10;

type FiltrosGF = {
  categoria: string;
  tipo: string;
  subtipo: string;
  equipe: string;
  frota: string;
};

type ConsumoPeriodo = "7d" | "30d" | "90d";

type ConsumoRow = {
  id: string;
  equipment_fleet: string | null;
  equipment_type: string | null;
  litros: number | null;
  data: string | null;
  fonte: string | null;
  ogs: string | null;
};

type ConsumoSortBy = "frota" | "tipo" | "litros" | "lancamentos" | "ultimaData";
type ConsumoSortDir = "asc" | "desc";
type FiltroRapido = "todos" | "sem_equipe" | "terceiro" | "proprio" | "sem_placa";

function carregarFiltrosIniciais(): FiltrosGF {
  const defaults: FiltrosGF = {
    categoria: "todos",
    tipo: "todos",
    subtipo: "todos",
    equipe: "todas",
    frota: "",
  };

  try {
    const bruto = sessionStorage.getItem(GF_FILTROS_KEY);
    if (!bruto) return defaults;
    const parsed = JSON.parse(bruto);
    return {
      categoria: typeof parsed?.categoria === "string" ? parsed.categoria : defaults.categoria,
      tipo: typeof parsed?.tipo === "string" ? parsed.tipo : defaults.tipo,
      subtipo: typeof parsed?.subtipo === "string" ? parsed.subtipo : defaults.subtipo,
      equipe: typeof parsed?.equipe === "string" ? parsed.equipe : defaults.equipe,
      frota: typeof parsed?.frota === "string" ? parsed.frota : defaults.frota,
    };
  } catch {
    return defaults;
  }
}

export default function GestaoFrotasHome() {
  const navigate = useNavigate();
  const { trail, goTo } = useNavigationTrail({ label: "WF Gestão de Frotas", resetToHome: true });
  const { toast } = useToast();
  const { categorias, loading: loadingTipos } = useEquipamentoTipos();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [medidoresMap, setMedidoresMap] = useState<Record<string, any>>({});
  const [aba, setAba] = useState<"frotas" | "documentos">("frotas");
  const [docsVencendo, setDocsVencendo] = useState<any[]>([]);
  const [equipesCadastro, setEquipesCadastro] = useState<string[]>([]);
  const [historicoTrocaEquipe, setHistoricoTrocaEquipe] = useState<any[]>([]);
  const [loadingHistoricoTrocaEquipe, setLoadingHistoricoTrocaEquipe] = useState(false);
  const [filtroAuditEquipe, setFiltroAuditEquipe] = useState<string>("todas");
  const [filtroAuditUsuario, setFiltroAuditUsuario] = useState<string>("todos");
  const [filtroAuditPeriodo, setFiltroAuditPeriodo] = useState<string>("30d");
  const [filtroAuditFrota, setFiltroAuditFrota] = useState<string>("");
  const [auditVisibleCount, setAuditVisibleCount] = useState<number>(AUDIT_PAGE_SIZE);
  const [mostrarHistoricoAuditoria, setMostrarHistoricoAuditoria] = useState(false);
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);
  const [mostrarBlocosAuxiliares, setMostrarBlocosAuxiliares] = useState(false);

  const [consumoRows, setConsumoRows] = useState<ConsumoRow[]>([]);
  const [consumoLoading, setConsumoLoading] = useState(false);
  const [consumoPeriodo, setConsumoPeriodo] = useState<ConsumoPeriodo>("30d");
  const [consumoBusca, setConsumoBusca] = useState("");
  const [consumoSortBy, setConsumoSortBy] = useState<ConsumoSortBy>("litros");
  const [consumoSortDir, setConsumoSortDir] = useState<ConsumoSortDir>("desc");

  const filtrosIniciais = useMemo(() => carregarFiltrosIniciais(), []);

  // Filtros da nova visualização (fase 10.3)
  const [filtroCategoria, setFiltroCategoria] = useState<string>(filtrosIniciais.categoria);
  const [filtroTipo, setFiltroTipo] = useState<string>(filtrosIniciais.tipo);
  const [filtroSubtipo, setFiltroSubtipo] = useState<string>(filtrosIniciais.subtipo);
  const [filtroEquipe, setFiltroEquipe] = useState<string>(filtrosIniciais.equipe);
  const [filtroFrota, setFiltroFrota] = useState<string>(filtrosIniciais.frota);
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");

  useEffect(() => {
    buscarTodos();
    carregarEquipesCadastro();
    carregarHistoricoTrocaEquipe({ silencioso: true });

    try {
      const params = new URLSearchParams(window.location.search);
      const equipeUrl = params.get("auditEquipe");
      const usuarioUrl = params.get("auditUsuario");
      const periodoUrl = params.get("auditPeriodo");
      const frotaUrl = params.get("auditFrota");

      if (equipeUrl) setFiltroAuditEquipe(equipeUrl);
      if (usuarioUrl) setFiltroAuditUsuario(usuarioUrl);
      if (periodoUrl && ["7d", "30d", "90d", "todos"].includes(periodoUrl)) setFiltroAuditPeriodo(periodoUrl);
      if (frotaUrl) setFiltroAuditFrota(frotaUrl);
    } catch {}
  }, []);

  useEffect(() => {
    setAuditVisibleCount(AUDIT_PAGE_SIZE);
  }, [filtroAuditEquipe, filtroAuditUsuario, filtroAuditPeriodo, filtroAuditFrota]);

  useEffect(() => {
    (supabase as any).from("manutencao_documentos")
      .select("*").not("data_vencimento", "is", null)
      .then(({ data }: any) => {
        if (!data) return;
        const agora = new Date();
        const vencendo = data
          .map((d: any) => ({
            ...d,
            dias_restantes: Math.ceil((new Date(`${d.data_vencimento}T12:00:00`).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)),
          }))
          .filter((d: any) => d.dias_restantes <= 30)
          .sort((a: any, b: any) => a.dias_restantes - b.dias_restantes);
        setDocsVencendo(vencendo);
      });
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        GF_FILTROS_KEY,
        JSON.stringify({
          categoria: filtroCategoria,
          tipo: filtroTipo,
          subtipo: filtroSubtipo,
          equipe: filtroEquipe,
          frota: filtroFrota,
        })
      );
    } catch {}
  }, [filtroCategoria, filtroTipo, filtroSubtipo, filtroEquipe, filtroFrota]);

  async function buscarTodos() {
    setLoading(true);
    const { data } = await (supabase as any).from("equipamentos").select("*").order("tipo,frota");
    if (data) {
      setTodos(data);
      buscarMedidores(data);
    }
    setLoading(false);
  }

  function inicioPorPeriodoConsumo(periodo: ConsumoPeriodo) {
    const hoje = new Date();
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    const inicio = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
    return inicio.toISOString().slice(0, 10);
  }

  async function carregarConsumo(periodo: ConsumoPeriodo) {
    setConsumoLoading(true);
    try {
      const dataInicio = inicioPorPeriodoConsumo(periodo);
      const { data, error } = await (supabase as any)
        .from("abastecimentos")
        .select("id, equipment_fleet, equipment_type, litros, data, fonte, ogs")
        .gte("data", dataInicio)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) {
        toast({
          title: "Falha ao carregar consumo",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setConsumoRows((data || []) as ConsumoRow[]);
    } finally {
      setConsumoLoading(false);
    }
  }

  async function carregarEquipesCadastro() {
    const { data, error } = await (supabase as any)
      .from("ci_equipes")
      .select("nome, ativa")
      .eq("ativa", true)
      .order("nome");

    if (error) return;

    const nomes = (data || [])
      .map((e: any) => (e?.nome || "").trim())
      .filter(Boolean);

    setEquipesCadastro(nomes);
  }

  async function buscarMedidores(veiculos: any[]) {
    if (!veiculos.length) return;
    const frotasSet = new Set(veiculos.map((v: any) => v.frota || v.placa).filter(Boolean));
    const [{ data: diarios }, { data: abastecs }] = await Promise.all([
      (supabase as any).from("equipment_diaries").select("equipment_fleet,equipment_type,meter_final,odometer_final,date").order("date", { ascending: false }).limit(3000),
      (supabase as any).from("abastecimentos").select("equipment_fleet,horimetro,km_odometro,data").order("data", { ascending: false }).limit(3000),
    ]);
    const map: Record<string, any> = {};
    (diarios || []).forEach((d: any) => {
      const frota = d.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const usaOdometro = ["Carreta", "Caminhões", "Veículo", "Comboio"].includes(d.equipment_type || "");
      const valor = usaOdometro ? d.odometer_final : d.meter_final;
      if (valor == null) return;
      if (!map[frota] || d.date > map[frota].data) map[frota] = { valor: Number(valor), tipo: usaOdometro ? "odômetro" : "horímetro", data: d.date };
    });
    (abastecs || []).forEach((a: any) => {
      const frota = a.equipment_fleet;
      if (!frota || !frotasSet.has(frota)) return;
      const temKm = a.km_odometro != null;
      const valor = temKm ? a.km_odometro : a.horimetro;
      if (valor == null) return;
      if (!map[frota] || a.data > map[frota].data) map[frota] = { valor: Number(valor), tipo: temKm ? "odômetro" : "horímetro", data: a.data };
    });
    setMedidoresMap(map);
  }

  async function carregarHistoricoTrocaEquipe(options?: { silencioso?: boolean }) {
    const silencioso = options?.silencioso ?? true;
    setLoadingHistoricoTrocaEquipe(true);

    const { data, error } = await (supabase as any)
      .from("audit_log")
      .select("id, created_at, user_nome, registro_id, dados_antes, dados_depois")
      .eq("acao", "ALTERACAO_EQUIPE_RAPIDA")
      .eq("tabela", "equipamentos")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      if (!silencioso) {
        toast({
          title: "Falha ao carregar histórico",
          description: error.message,
          variant: "destructive",
        });
      }
      setLoadingHistoricoTrocaEquipe(false);
      return;
    }

    setHistoricoTrocaEquipe(data || []);
    setLoadingHistoricoTrocaEquipe(false);
  }

  // Mapa de tipo -> metadados (categoria/subtipo)
  const tipoMetaMap = useMemo(() => {
    const map = new Map<string, { categoria: string; subtipo: string }>();
    categorias.forEach((cat) => {
      cat.tipos.forEach((t) => {
        map.set((t.tipoValor || "").toUpperCase(), {
          categoria: cat.key,
          subtipo: t.subtipo || "",
        });
      });
    });
    return map;
  }, [categorias]);

  // Categorias com contagem real
  const categoriasComCount = useMemo(() => {
    return categorias
      .map((cat) => {
        const tiposNaCat = cat.tipos.map((t) => t.tipoValor.toUpperCase());
        const count = todos.filter((v) => tiposNaCat.includes((v.tipo || "").toUpperCase())).length;
        return { ...cat, count };
      })
      .filter((c) => c.count > 0);
  }, [categorias, todos]);

  const tiposDisponiveis = useMemo(() => {
    if (filtroCategoria === "todos") {
      const unicos = Array.from(new Set(todos.map((v) => (v.tipo || "").trim()).filter(Boolean)));
      return unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    const cat = categorias.find((c) => c.key === filtroCategoria);
    if (!cat) return [];

    const tiposDaCategoria = cat.tipos.map((t) => t.tipoValor.toUpperCase());
    return Array.from(
      new Set(
        todos
          .filter((v) => tiposDaCategoria.includes((v.tipo || "").toUpperCase()))
          .map((v) => (v.tipo || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [filtroCategoria, categorias, todos]);

  const subtiposDisponiveis = useMemo(() => {
    const tiposBase = filtroTipo !== "todos" ? [filtroTipo.toUpperCase()] : tiposDisponiveis.map((t) => t.toUpperCase());
    const subtipos = new Set<string>();

    tiposBase.forEach((tipo) => {
      const meta = tipoMetaMap.get(tipo);
      if (meta?.subtipo) subtipos.add(meta.subtipo);
    });

    return Array.from(subtipos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [filtroTipo, tiposDisponiveis, tipoMetaMap]);

  const equipesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();

    const adicionar = (valor: string) => {
      const limpo = (valor || "").trim();
      if (!limpo) return;
      const chave = limpo.toLocaleLowerCase("pt-BR");
      if (!map.has(chave)) map.set(chave, limpo);
    };

    todos.forEach((v) => adicionar(v.setor || ""));
    equipesCadastro.forEach((nome) => adicionar(nome));

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [todos, equipesCadastro]);

  // Higieniza filtros persistidos quando opções deixam de existir
  useEffect(() => {
    if (filtroTipo !== "todos" && !tiposDisponiveis.includes(filtroTipo)) {
      setFiltroTipo("todos");
      setFiltroSubtipo("todos");
    }
  }, [filtroTipo, tiposDisponiveis]);

  useEffect(() => {
    if (filtroSubtipo !== "todos" && !subtiposDisponiveis.includes(filtroSubtipo)) {
      setFiltroSubtipo("todos");
    }
  }, [filtroSubtipo, subtiposDisponiveis]);

  useEffect(() => {
    if (filtroEquipe !== "todas" && !equipesDisponiveis.includes(filtroEquipe)) {
      setFiltroEquipe("todas");
    }
  }, [filtroEquipe, equipesDisponiveis]);

  function limparFiltros() {
    setFiltroCategoria("todos");
    setFiltroTipo("todos");
    setFiltroSubtipo("todos");
    setFiltroEquipe("todas");
    setFiltroFrota("");
    setFiltroRapido("todos");
  }

  // Lista de equipamentos filtrada (tipo/subtipo/frota/equipe + filtros rápidos)
  const listaFiltrada = useMemo(() => {
    const filtrados = todos.filter((v) => {
      const tipo = (v.tipo || "").toUpperCase();
      const equipe = (v.setor || "").trim();
      const meta = tipoMetaMap.get(tipo);
      const condicaoNorm = (v.condicao || (v.categoria === "locado" ? "TERCEIRO" : "PROPRIO")).toUpperCase();
      const placaLimpa = (v.placa || "").trim();

      if (filtroCategoria !== "todos" && meta?.categoria !== filtroCategoria) return false;
      if (filtroTipo !== "todos" && tipo !== filtroTipo.toUpperCase()) return false;
      if (filtroSubtipo !== "todos" && (meta?.subtipo || "") !== filtroSubtipo) return false;
      if (filtroEquipe !== "todas" && equipe !== filtroEquipe) return false;

      if (filtroRapido === "sem_equipe" && equipe) return false;
      if (filtroRapido === "terceiro" && condicaoNorm !== "TERCEIRO") return false;
      if (filtroRapido === "proprio" && condicaoNorm === "TERCEIRO") return false;
      if (filtroRapido === "sem_placa" && placaLimpa) return false;

      if (filtroFrota.trim()) {
        const q = filtroFrota.trim().toLowerCase();
        const alvoBusca = [
          v.centro_custo,
          v.frota,
          v.placa,
          v.marca,
          v.modelo_completo,
          v.nome,
          v.tipo,
          v.setor,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!alvoBusca.includes(q)) return false;
      }

      return true;
    });

    // Ordem padrão: Equipe/Setor -> Frota (ou Placa)
    return filtrados.sort((a, b) => {
      const equipeA = (a.setor || "").trim();
      const equipeB = (b.setor || "").trim();
      const cmpEquipe = equipeA.localeCompare(equipeB, "pt-BR", { sensitivity: "base" });
      if (cmpEquipe !== 0) return cmpEquipe;

      const frotaA = (a.frota || a.placa || "").trim();
      const frotaB = (b.frota || b.placa || "").trim();
      return frotaA.localeCompare(frotaB, "pt-BR", { sensitivity: "base", numeric: true });
    });
  }, [todos, tipoMetaMap, filtroCategoria, filtroTipo, filtroSubtipo, filtroEquipe, filtroFrota, filtroRapido]);

  const filtrosAtivos = useMemo(() => {
    const chips: string[] = [];
    if (filtroCategoria !== "todos") {
      const cat = categoriasComCount.find((c) => c.key === filtroCategoria);
      chips.push(`Categoria: ${cat?.label || filtroCategoria}`);
    }
    if (filtroTipo !== "todos") chips.push(`Tipo: ${filtroTipo}`);
    if (filtroSubtipo !== "todos") chips.push(`Subtipo: ${filtroSubtipo}`);
    if (filtroEquipe !== "todas") chips.push(`Equipe: ${filtroEquipe}`);
    if (filtroFrota.trim()) chips.push(`Frota: ${filtroFrota.trim()}`);
    if (filtroRapido === "sem_equipe") chips.push("Rápido: Sem equipe");
    if (filtroRapido === "terceiro") chips.push("Rápido: Terceiros");
    if (filtroRapido === "proprio") chips.push("Rápido: Próprios");
    if (filtroRapido === "sem_placa") chips.push("Rápido: Sem placa");
    return chips;
  }, [filtroCategoria, filtroTipo, filtroSubtipo, filtroEquipe, filtroFrota, filtroRapido, categoriasComCount]);

  const contagemPorEquipe = useMemo(() => {
    const map = new Map<string, number>();
    listaFiltrada.forEach((v) => {
      const equipe = (v.setor || "").trim() || "Sem equipe";
      map.set(equipe, (map.get(equipe) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([equipe, total]) => ({ equipe, total }))
      .sort((a, b) => a.equipe.localeCompare(b.equipe, "pt-BR", { sensitivity: "base" }));
  }, [listaFiltrada]);

  const historicoTrocaEquipeNormalizado = useMemo(() => {
    return historicoTrocaEquipe.map((item) => {
      const antes = (item?.dados_antes as any)?.valor || null;
      const depois = (item?.dados_depois as any)?.valor || null;
      const frota =
        (item?.dados_depois as any)?.frota ||
        (item?.dados_antes as any)?.frota ||
        item?.registro_id ||
        "Equipamento";

      return {
        id: item?.id,
        created_at: item?.created_at || null,
        user_nome: item?.user_nome || "Usuário",
        registro_id: item?.registro_id || null,
        frota,
        equipe_antes: antes,
        equipe_depois: depois,
      };
    });
  }, [historicoTrocaEquipe]);

  const opcoesEquipeAuditoria = useMemo(() => {
    const set = new Set<string>();
    historicoTrocaEquipeNormalizado.forEach((h) => {
      if (h.equipe_antes) set.add(h.equipe_antes);
      if (h.equipe_depois) set.add(h.equipe_depois);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [historicoTrocaEquipeNormalizado]);

  const opcoesUsuarioAuditoria = useMemo(() => {
    return Array.from(new Set(historicoTrocaEquipeNormalizado.map((h) => h.user_nome).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [historicoTrocaEquipeNormalizado]);

  const historicoTrocaEquipeFiltrado = useMemo(() => {
    const agora = new Date();
    let dataCorte: Date | null = null;

    if (filtroAuditPeriodo === "7d") dataCorte = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filtroAuditPeriodo === "30d") dataCorte = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (filtroAuditPeriodo === "90d") dataCorte = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);

    return historicoTrocaEquipeNormalizado.filter((h) => {
      if (filtroAuditUsuario !== "todos" && h.user_nome !== filtroAuditUsuario) return false;
      if (filtroAuditEquipe !== "todas" && h.equipe_antes !== filtroAuditEquipe && h.equipe_depois !== filtroAuditEquipe) return false;

      if (filtroAuditFrota.trim()) {
        const q = filtroAuditFrota.trim().toLowerCase();
        const alvo = `${h.frota || ""} ${h.registro_id || ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }

      if (dataCorte && h.created_at) {
        const dataMov = new Date(h.created_at);
        if (!Number.isNaN(dataMov.getTime()) && dataMov < dataCorte) return false;
      }

      return true;
    });
  }, [historicoTrocaEquipeNormalizado, filtroAuditUsuario, filtroAuditEquipe, filtroAuditPeriodo, filtroAuditFrota]);

  const historicoTrocaEquipePaginado = useMemo(() => {
    return historicoTrocaEquipeFiltrado.slice(0, auditVisibleCount);
  }, [historicoTrocaEquipeFiltrado, auditVisibleCount]);

  const aindaTemMaisHistorico = historicoTrocaEquipePaginado.length < historicoTrocaEquipeFiltrado.length;

  function copiarLinkFiltrosAuditoria() {
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      if (filtroAuditEquipe !== "todas") params.set("auditEquipe", filtroAuditEquipe); else params.delete("auditEquipe");
      if (filtroAuditUsuario !== "todos") params.set("auditUsuario", filtroAuditUsuario); else params.delete("auditUsuario");
      if (filtroAuditPeriodo !== "30d") params.set("auditPeriodo", filtroAuditPeriodo); else params.delete("auditPeriodo");
      if (filtroAuditFrota.trim()) params.set("auditFrota", filtroAuditFrota.trim()); else params.delete("auditFrota");

      url.search = params.toString();
      const link = url.toString();

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(link);
      } else {
        const aux = document.createElement("textarea");
        aux.value = link;
        document.body.appendChild(aux);
        aux.select();
        document.execCommand("copy");
        document.body.removeChild(aux);
      }

      toast({
        title: "Link copiado",
        description: "Link com os filtros da auditoria copiado para a área de transferência.",
      });
    } catch {
      toast({
        title: "Falha ao copiar link",
        description: "Não foi possível copiar o link agora.",
        variant: "destructive",
      });
    }
  }

  function exportarHistoricoTrocaEquipeCsv() {
    if (historicoTrocaEquipeFiltrado.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Ajuste os filtros do histórico e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["DataHora", "Usuario", "Frota", "EquipeAnterior", "EquipeNova", "RegistroID"].join(";");
    const linhas = historicoTrocaEquipeFiltrado.map((h) =>
      [
        esc(fmtDateTime(h.created_at)),
        esc(h.user_nome || ""),
        esc(h.frota || ""),
        esc(h.equipe_antes || "Sem equipe"),
        esc(h.equipe_depois || "Sem equipe"),
        esc(h.registro_id || ""),
      ].join(";")
    );

    const csv = [header, ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-troca-equipe-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado",
      description: `${historicoTrocaEquipeFiltrado.length} movimentação(ões) exportadas.`,
    });
  }

  const consumoFiltrado = useMemo(() => {
    const q = consumoBusca.trim().toLowerCase();
    if (!q) return consumoRows;

    return consumoRows.filter((row) => {
      const alvo = `${row.equipment_fleet || ""} ${row.equipment_type || ""} ${row.ogs || ""}`.toLowerCase();
      return alvo.includes(q);
    });
  }, [consumoRows, consumoBusca]);

  const resumoConsumo = useMemo(() => {
    const totalLitros = consumoFiltrado.reduce((acc, row) => acc + (Number(row.litros) || 0), 0);
    const totalLancamentos = consumoFiltrado.length;
    const frotasUnicas = new Set(consumoFiltrado.map((row) => row.equipment_fleet).filter(Boolean)).size;
    return { totalLitros, totalLancamentos, frotasUnicas };
  }, [consumoFiltrado]);

  const consumoPorFonte = useMemo(() => {
    const map = new Map<string, { fonte: string; litros: number; lancamentos: number }>();
    consumoFiltrado.forEach((row) => {
      const fonte = (row.fonte || "manual").toLowerCase();
      const atual = map.get(fonte) || { fonte, litros: 0, lancamentos: 0 };
      atual.litros += Number(row.litros) || 0;
      atual.lancamentos += 1;
      map.set(fonte, atual);
    });

    return Array.from(map.values()).sort((a, b) => b.litros - a.litros);
  }, [consumoFiltrado]);

  const consumoPorFrota = useMemo(() => {
    const map = new Map<string, { frota: string; tipo: string; litros: number; lancamentos: number; ultimaData: string }>();

    consumoFiltrado.forEach((row) => {
      const frota = (row.equipment_fleet || "Sem Frota").trim() || "Sem Frota";
      const atual = map.get(frota) || {
        frota,
        tipo: row.equipment_type || "-",
        litros: 0,
        lancamentos: 0,
        ultimaData: row.data || "",
      };

      atual.litros += Number(row.litros) || 0;
      atual.lancamentos += 1;
      if ((row.data || "") > atual.ultimaData) atual.ultimaData = row.data || "";
      if (!atual.tipo || atual.tipo === "-") atual.tipo = row.equipment_type || "-";

      map.set(frota, atual);
    });

    return Array.from(map.values());
  }, [consumoFiltrado]);

  const consumoPorFrotaOrdenado = useMemo(() => {
    const rows = [...consumoPorFrota];
    const dir = consumoSortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (consumoSortBy === "frota") return a.frota.localeCompare(b.frota, "pt-BR", { sensitivity: "base", numeric: true }) * dir;
      if (consumoSortBy === "tipo") return (a.tipo || "").localeCompare((b.tipo || ""), "pt-BR", { sensitivity: "base", numeric: true }) * dir;
      if (consumoSortBy === "litros") return (a.litros - b.litros) * dir;
      if (consumoSortBy === "lancamentos") return (a.lancamentos - b.lancamentos) * dir;
      return (a.ultimaData || "").localeCompare(b.ultimaData || "") * dir;
    });

    return rows;
  }, [consumoPorFrota, consumoSortBy, consumoSortDir]);

  function alternarOrdenacaoConsumo(coluna: ConsumoSortBy) {
    if (consumoSortBy === coluna) {
      setConsumoSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setConsumoSortBy(coluna);
    setConsumoSortDir(coluna === "frota" || coluna === "tipo" || coluna === "ultimaData" ? "asc" : "desc");
  }

  function marcadorOrdenacao(coluna: ConsumoSortBy) {
    if (consumoSortBy !== coluna) return "";
    return consumoSortDir === "asc" ? "↑" : "↓";
  }

  function labelPeriodoConsumo() {
    if (consumoPeriodo === "7d") return "7d";
    if (consumoPeriodo === "30d") return "30d";
    return "90d";
  }

  function exportarConsumoCsv() {
    if (consumoPorFrotaOrdenado.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Ajuste os filtros do consumo e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Frota", "Tipo", "Litros", "Lancamentos", "UltimaData"].join(";");
    const linhas = consumoPorFrotaOrdenado.map((item) => [
      esc(item.frota),
      esc(item.tipo || "-"),
      esc(formatLitros(item.litros)),
      esc(item.lancamentos),
      esc(fmtDate(item.ultimaData) || "-"),
    ].join(";"));

    const csv = [header, ...linhas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-frotas-${labelPeriodoConsumo()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado",
      description: `${consumoPorFrotaOrdenado.length} frotas exportadas.`,
    });
  }


  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Gestão de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">
            {todos.length} equipamentos cadastrados • {listaFiltrada.length} no filtro
          </span>
        </div>
      </header>

      <div className="px-4 pb-2 bg-header-gradient">
        <NavigationTrail trail={trail} onSelect={goTo} />
      </div>

      {/* Abas */}
      <div className="flex border-b border-border bg-white">
        <button
          onClick={() => setAba("frotas")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "frotas" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          <Wrench className="w-4 h-4" /> Frotas
        </button>
        <button
          onClick={() => setAba("documentos")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${aba === "documentos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
        >
          <FileText className="w-4 h-4" /> Documentos
          {docsVencendo.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {docsVencendo.length}
            </span>
          )}
        </button>
      </div>

      {aba === "frotas" && (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="sticky top-2 z-20 space-y-2">
            <div className="rdo-card space-y-2 border border-primary/10 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Busca rápida de equipamento</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setMostrarFiltrosAvancados((prev) => !prev)}
                >
                  {mostrarFiltrosAvancados ? "Ocultar filtros avançados" : "Mostrar filtros avançados"}
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Digite frota, placa, modelo ou nome"
                  value={filtroFrota}
                  onChange={(e) => setFiltroFrota(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select value={filtroCategoria} onValueChange={(valor) => {
                  setFiltroCategoria(valor);
                  setFiltroTipo("todos");
                  setFiltroSubtipo("todos");
                }}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as categorias</SelectItem>
                    {categoriasComCount.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>{cat.label} ({cat.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Equipe/Setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as equipes</SelectItem>
                    {equipesDisponiveis.map((eq) => (
                      <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button type="button" size="sm" variant={filtroRapido === "todos" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setFiltroRapido("todos")}>Todos</Button>
                <Button type="button" size="sm" variant={filtroRapido === "sem_equipe" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setFiltroRapido("sem_equipe")}>Sem equipe</Button>
                <Button type="button" size="sm" variant={filtroRapido === "terceiro" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setFiltroRapido("terceiro")}>Terceiros</Button>
                <Button type="button" size="sm" variant={filtroRapido === "proprio" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setFiltroRapido("proprio")}>Próprios</Button>
                <Button type="button" size="sm" variant={filtroRapido === "sem_placa" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-[11px]" onClick={() => setFiltroRapido("sem_placa")}>Sem placa</Button>
              </div>
            </div>

            <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setMostrarBlocosAuxiliares((prev) => !prev)}
            >
              {mostrarBlocosAuxiliares ? "Ocultar atalhos e auditoria" : "Mostrar atalhos e auditoria"}
            </Button>
          </div>
          </div>

          {mostrarBlocosAuxiliares && (
            <>
              <ProgramacoesDoDia />

              {/* Dashboards auxiliares */}
          <button onClick={() => navigate("/gestao-frotas/dashboard")} className="w-full rdo-card border-l-4 border-l-blue-400 hover:shadow-md transition-all flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-sm">Dashboard por Equipe / Tipo</p>
              <p className="text-xs text-muted-foreground">Visão detalhada com tabelas para apresentação</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </button>

          <button onClick={() => navigate("/gestao-frotas/dashboard-rdo")} className="w-full rdo-card border-l-4 border-l-green-400 hover:shadow-md transition-all flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-sm">Localização das Frotas (RDO)</p>
              <p className="text-xs text-muted-foreground">Onde cada equipamento estava — via apontamento</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </button>

          <button onClick={() => navigate("/gestao-frotas/rastreamento")} className="w-full rdo-card border-l-4 border-l-orange-400 hover:shadow-md transition-all flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-sm">Rastreamento em Tempo Real</p>
              <p className="text-xs text-muted-foreground">Onde está cada equipamento hoje — diário + transporte + pátio auto</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </button>

          <div className="rdo-card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Histórico de movimentação (filtros)</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  const proximo = !mostrarHistoricoAuditoria;
                  setMostrarHistoricoAuditoria(proximo);
                  if (proximo) carregarHistoricoTrocaEquipe({ silencioso: false });
                }}
              >
                {mostrarHistoricoAuditoria ? "Ocultar histórico" : "Mostrar histórico"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={filtroAuditEquipe} onValueChange={setFiltroAuditEquipe}>
                <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Equipe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas equipes</SelectItem>
                  {opcoesEquipeAuditoria.map((eq) => (
                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroAuditUsuario} onValueChange={setFiltroAuditUsuario}>
                <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Usuário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos usuários</SelectItem>
                  {opcoesUsuarioAuditoria.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroAuditPeriodo} onValueChange={setFiltroAuditPeriodo}>
                <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="todos">Todo período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={filtroAuditFrota}
                onChange={(e) => setFiltroAuditFrota(e.target.value)}
                placeholder="Filtrar histórico por frota/placa"
                className="h-8 rounded-lg text-xs pl-8"
              />
            </div>

            {!mostrarHistoricoAuditoria ? (
              <p className="text-[11px] text-muted-foreground">A lista de movimentações está oculta. Use “Mostrar histórico” quando precisar auditar.</p>
            ) : loadingHistoricoTrocaEquipe ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : historicoTrocaEquipeFiltrado.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma alteração encontrada para os filtros selecionados.</p>
            ) : (
              <div className="space-y-2">
                {historicoTrocaEquipePaginado.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-xs text-slate-800">
                      <strong>{item.frota}</strong>: {item.equipe_antes || "Sem equipe"} → {item.equipe_depois || "Sem equipe"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.user_nome || "Usuário"} • {fmtDateTime(item.created_at) || "Sem data"}
                    </p>
                  </div>
                ))}

                {aindaTemMaisHistorico && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs rounded-lg"
                      onClick={() => setAuditVisibleCount((prev) => prev + AUDIT_PAGE_SIZE)}
                    >
                      Ver mais ({historicoTrocaEquipeFiltrado.length - historicoTrocaEquipePaginado.length} restantes)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          )}

          {mostrarFiltrosAvancados && (
            <div className="rdo-card space-y-3">
            <p className="text-xs text-muted-foreground font-semibold">Filtros rápidos (Tipo / Subtipo / Frota / Equipe)</p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select value={filtroCategoria} onValueChange={(valor) => {
                setFiltroCategoria(valor);
                setFiltroTipo("todos");
                setFiltroSubtipo("todos");
              }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as categorias</SelectItem>
                  {categoriasComCount.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>{cat.label} ({cat.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroTipo} onValueChange={(valor) => {
                setFiltroTipo(valor);
                setFiltroSubtipo("todos");
              }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {tiposDisponiveis.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroSubtipo} onValueChange={setFiltroSubtipo}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Subtipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os subtipos</SelectItem>
                  {subtiposDisponiveis.map((subtipo) => (
                    <SelectItem key={subtipo} value={subtipo}>{subtipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Equipe/Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as equipes</SelectItem>
                  {equipesDisponiveis.map((eq) => (
                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por frota ou placa"
                value={filtroFrota}
                onChange={(e) => setFiltroFrota(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </div>
          </div>
          )}

          <p className="text-xs text-muted-foreground px-1">{listaFiltrada.length} resultado{listaFiltrada.length !== 1 ? "s" : ""} — toque no card para abrir ficha completa</p>

          {mostrarFiltrosAvancados && filtrosAtivos.length > 0 && (
            <div className="px-1 flex flex-wrap gap-1.5">
              {filtrosAtivos.map((chip) => (
                <span key={chip} className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                  {chip}
                </span>
              ))}
            </div>
          )}

          {mostrarFiltrosAvancados && contagemPorEquipe.length > 0 && (
            <div className="px-1">
              <p className="text-[11px] text-muted-foreground mb-1">Contagem por equipe (resultado atual):</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {contagemPorEquipe.map((item) => (
                  <span key={item.equipe} className="whitespace-nowrap inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                    {item.equipe}: <strong className="ml-1">{item.total}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(loading || loadingTipos) ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : listaFiltrada.map(v => {
            return (
              <div
                key={v.id}
                className="w-full rdo-card hover:shadow-md transition-all space-y-2"
              >
                <button onClick={() => navigate(`/gestao-frotas/veiculo/${v.id}`)} className="w-full text-left flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    <Car className={`w-5 h-5 ${(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'text-blue-600' : 'text-green-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-sm">{v.centro_custo || v.frota || v.placa}</span>
                      {v.placa && v.placa !== v.frota && <span className="text-xs text-muted-foreground">{v.placa}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        (v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {(v.condicao || (v.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO')) === 'TERCEIRO' ? 'Terceiro' : 'Próprio'}
                      </span>
                      {v.status && v.status !== 'ativo' && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          v.status === 'em_manutencao' ? 'bg-orange-100 text-orange-700' :
                          v.status === 'inativo'       ? 'bg-red-100 text-red-600' :
                          v.status === 'disposicao'    ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {v.status === 'em_manutencao' ? '🔧 Manutenção' :
                            v.status === 'inativo'       ? '🚫 Inativo' :
                            v.status === 'disposicao'    ? '📦 Disposição' : v.status}
                        </span>
                      )}
                      {v.locadora && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {v.locadora}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{[v.marca || v.tipo_veiculo, v.modelo_completo || v.nome].filter(Boolean).join(" ") || v.modelo_completo || v.nome}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {v.tipo && <span>🏷️ {v.tipo}</span>}
                      {v.setor && <span>🏢 {v.setor}</span>}
                      {v.condutor_atual && <span>👤 {v.condutor_atual}</span>}
                      {v.valor_mensal > 0 && <span className="text-orange-600 font-semibold">{formatBRL(v.valor_mensal)}/mês</span>}
                    </div>
                    {(() => {
                      const frotaBase = v.frota || v.placa;
                      const med = medidoresMap[frotaBase];
                      if (!med) return null;
                      return (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {med.tipo === "odômetro" ? "📍" : "⏱"} {med.tipo === "odômetro" ? `${med.valor.toLocaleString("pt-BR")} km` : `${med.valor.toLocaleString("pt-BR")} h`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">em {fmtDate(med.data)}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                </button>

                <div className="pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Equipe: <strong className="text-foreground">{v.setor || "Sem equipe"}</strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground/80">Edição restrita</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ABA DOCUMENTOS */}
      {aba === "documentos" && (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {docsVencendo.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-sm font-bold text-orange-700 mb-2">⚠️ {docsVencendo.length} documento{docsVencendo.length !== 1 ? "s" : ""} vencendo em breve</p>
              {docsVencendo.slice(0, 3).map((d, i) => (
                <p key={i} className="text-xs text-orange-600">
                  {d.equipment_fleet} — {d.tipo_documento}: {d.dias_restantes <= 0 ? "⛔ VENCIDO" : `${d.dias_restantes} dias`}
                </p>
              ))}
            </div>
          )}
          <Button onClick={() => navigate("/gestao-frotas/documentos?origem=gestao-frotas")} className="w-full h-11 gap-2 rounded-xl font-display font-bold">
            <Plus className="w-4 h-4" /> Adicionar Documento
          </Button>
          <Button onClick={() => navigate("/gestao-frotas/documentos?origem=gestao-frotas")} variant="outline" className="w-full h-11 gap-2 rounded-xl font-semibold">
            <FileText className="w-4 h-4" /> Ver Todos os Documentos
          </Button>
        </div>
      )}
    </div>
  );
}
