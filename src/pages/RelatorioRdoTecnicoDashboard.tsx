import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  AlertTriangle,
  CloudRain,
  Gauge,
  Loader2,
  Download,
  BarChart3,
  Building2,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  SlidersHorizontal,
  RefreshCw,
  ClipboardCheck,
  ShieldCheck,
  Bell,
  Star,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { buildEngineeringMonitoring } from "@/lib/engineeringMonitoring";
import { getEngineeringMonitoringRoster } from "@/lib/engineeringMonitoringRoster";
import { ENGINEERING_VALIDATION_START, loadEngineeringQueue, filterEngineeringQueue } from "@/lib/engineeringQueue";
import { toSaoPauloISODate } from "@/lib/date-local";
import { classifyUnlinkedValidationRdos } from "@/lib/validationUnlinked";
import { NOTA_BAIXA, computeApoioMetrics } from "@/lib/rdoTecnicoApoioMetrics";
import { ENSAIOS_SERVICE, INFRA_SERVICE, TECHNICAL_QUANTITIES, hasServiceToken } from "@/lib/technicalProduction";
import { Interpretar, Previa, TabelaPaginada, type Coluna } from "./rdoTecnicoDashboard/Tabela";

interface RdoTecnicoRow {
  id: string;
  ogs_number: string | null;
  data: string;
  status: string;
  equipe: string | null;
  localizacao: string | null;
  engenheiro_id: string | null;
  houve_producao: boolean;
  motivo_sem_producao: string | null;
  outro_motivo_sem_producao: string | null;
  choveu: boolean | null;
  intensidade_chuva: string | null;
  tipo_servico: string | null;
  infra_descricao: string | null;
  usina_programada: string | null;
  usina_atendeu: boolean | null;
  usina_nao_atendeu_motivo: string | null;
  equipamentos_conforme: boolean | null;
  equipamentos_nao_conformes: string | null;
  houve_ocorrencia: boolean;
  descricao_ocorrencia: string | null;
  observacoes: string | null;
  fresagem_m2: number | null;
  rap_espumado_m2: number | null;
  binder_ton: number | null;
  cbuq_fx3_ton: number | null;
  gap_ton: number | null;
  bgs_ton: number | null;
  geogrelha_m2: number | null;
  bgtc_m3: number | null;
  macadame_m3: number | null;
  sma_ton: number | null;
  cauq_rima_ton: number | null;
  bm25_ton: number | null;
  egl_ton: number | null;
  rachao_ton: number | null;
  fx_c_ton: number | null;
  demolicao_m: number | null;
  nivelamento_pv_un: number | null;
  retrabalho: boolean | null;
  retrabalho_oficio: string | null;
  qtd_caminhoes_basculante: number | null;
  autorizacao_no_horario: boolean | null;
  autorizacao_atraso_detalhe: string | null;
  sinalizacao_presente: boolean | null;
  sinalizacao_nota: number | null;
  controle_tecnologico_presente: boolean | null;
  sinalizacao_vertical_nota: number | null;
  perc_conclusao_via: number | null;
}

interface EngenheiroIdentificado {
  user_id: string;
  nome_completo: string | null;
  email: string | null;
  status: string | null;
}

interface RdoApontador {
  id: string;
  data: string;
  obra_nome: string | null;
  status_validacao: string | null;
  engenheiro_responsavel_user_id: string | null;
  engenheiro_responsavel: string | null;
  encarregado: string | null;
  encarregado_employee_id: string | null;
  validado_encarregado: boolean;
  nao_aprovado_encarregado: boolean;
  validado_por: string | null;
  validado_em: string | null;
}

// Páginas estáveis: o limite padrão da API não pode virar um total gerencial parcial.
async function carregarTodas(queryPage: (inicio: number, fim: number) => any) {
  const resultado: any[] = [];
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await queryPage(inicio, inicio + tamanho - 1);
    if (error) throw error;
    resultado.push(...(data || []));
    if (!data || data.length < tamanho) break;
  }
  return resultado;
}

interface FiltroOption {
  value: string;
  label: string;
}

interface AlertaOperacional {
  id: string;
  prioridade: "Alta" | "Média";
  prioridadePeso: number;
  assunto: string;
  detalhe: string;
  tabDestino: AssuntoTab;
  rdo: RdoTecnicoRow;
}

type AssuntoTab =
  | "geral"
  | "producao"
  | "meteo"
  | "usina"
  | "equipamentos"
  | "apoio"
  | "ocorrencias"
  | "sem_producao";

type Secao = AssuntoTab | "preenchimento" | "validacoes" | "alertas";

const SECOES_META: { id: Secao; label: string; icon: any }[] = [
  { id: "geral", label: "Visão geral", icon: BarChart3 },
  { id: "producao", label: "Produção", icon: Activity },
  { id: "preenchimento", label: "Preenchimento", icon: ClipboardCheck },
  { id: "validacoes", label: "Validações", icon: ShieldCheck },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "meteo", label: "Clima", icon: CloudRain },
  { id: "usina", label: "Usina", icon: Building2 },
  { id: "equipamentos", label: "Equipamentos", icon: Gauge },
  { id: "apoio", label: "Apoio e Qualidade", icon: Star },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertTriangle },
  { id: "sem_producao", label: "Sem produção", icon: FileText },
];

const TITULO_ASSUNTO: Record<string, string> = {
  producao: "Produção",
  meteo: "Clima",
  usina: "Usina",
  equipamentos: "Equipamentos",
  apoio: "Apoio e Qualidade na Obra",
  ocorrencias: "Ocorrências",
  sem_producao: "Sem produção",
};

const RESUMO_ASSUNTO: Record<string, string> = {
  producao: "RDOs com produção lançada",
  meteo: "RDOs com chuva registrada",
  usina: "RDOs com informação de usina",
  equipamentos: "RDOs com avaliação de conformidade",
  apoio: "RDOs com retrabalho, caminhões ou avaliação de apoio",
  ocorrencias: "RDOs com ocorrência reportada",
  sem_producao: "RDOs sem produção no período",
};

function isFolgaFeriado(row: Pick<RdoTecnicoRow, "houve_producao" | "motivo_sem_producao">) {
  return !row.houve_producao && row.motivo_sem_producao?.trim().toLocaleLowerCase("pt-BR") === "folga / feriado";
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function fmtNum(v: number | null | undefined, max = 0) {
  if (v == null || Number.isNaN(v)) return "0";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: max });
}

function csvEscape(val: unknown) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPeriodoAnterior(dataIni: string, dataFim: string) {
  const ini = parseIsoDate(dataIni);
  const fim = parseIsoDate(dataFim);
  const diffDias = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1);

  const fimAnt = new Date(ini);
  fimAnt.setDate(fimAnt.getDate() - 1);
  const iniAnt = new Date(fimAnt);
  iniAnt.setDate(iniAnt.getDate() - (diffDias - 1));

  return {
    atualDias: diffDias,
    anteriorIni: toIsoDate(iniAnt),
    anteriorFim: toIsoDate(fimAnt),
  };
}

function motivoSemProducao(r: RdoTecnicoRow) {
  return r.motivo_sem_producao === "Outro"
    ? (r.outro_motivo_sem_producao || "Outro")
    : (r.motivo_sem_producao || "Sem motivo");
}

function estrelas(n: number | null | undefined) {
  return n ? `${"★".repeat(n)}${"☆".repeat(5 - n)} (${n}/5)` : "Não avaliado";
}

function usinaNaoAtendeuSemProducao(r: Pick<RdoTecnicoRow, "houve_producao" | "motivo_sem_producao">) {
  return !r.houve_producao && r.motivo_sem_producao === "Usina Não Atendeu";
}

function temApoio(r: RdoTecnicoRow) {
  return r.houve_producao && (!!r.retrabalho || r.qtd_caminhoes_basculante != null || r.autorizacao_no_horario != null
    || r.sinalizacao_presente != null || r.controle_tecnologico_presente != null || !!r.sinalizacao_vertical_nota);
}

function simNao(v: boolean | null | undefined) {
  return v == null ? "Não avaliado" : v ? "Sim" : "Não";
}

interface CampoDetalhe { label: string; value: string; testId?: string; aviso?: boolean }

function camposDetalhe(r: RdoTecnicoRow, assunto: AssuntoTab, engMap: Record<string, string>, alerta?: AlertaOperacional): CampoDetalhe[] {
  const campos: CampoDetalhe[] = [
    { label: "ID do RDO", value: r.id },
    { label: "Data", value: fmtDate(r.data) },
    { label: "OGS", value: r.ogs_number || "-" },
    { label: "Autor (engenheiro)", value: r.engenheiro_id ? (engMap[r.engenheiro_id] || "-") : "-" },
    { label: "Equipe / Setor", value: r.equipe || "-" },
    { label: "Localização", value: r.localizacao || "-" },
    { label: "Status", value: r.status === "enviado" ? "Enviado" : "Rascunho" },
  ];
  if (alerta) {
    campos.push({ label: "Alerta", value: `${alerta.prioridade} · ${alerta.assunto}` }, { label: "Detalhe do alerta", value: alerta.detalhe });
  }
  if (assunto === "producao") {
    campos.push({ label: "Tipo de serviço", value: r.tipo_servico || "Sem tipo" }, { label: "Conclusão da via", value: r.perc_conclusao_via != null ? `${r.perc_conclusao_via}%` : "-" });
    if (hasServiceToken(r.tipo_servico, INFRA_SERVICE)) {
      const informada = !!r.infra_descricao?.trim();
      campos.push({ label: "Descrição de INFRA", value: informada ? r.infra_descricao! : "Descrição de INFRA não informada", testId: `infra-descricao-${r.id}`, aviso: !informada });
    }
    TECHNICAL_QUANTITIES.forEach(({ field, label }) => {
      const v = r[field as keyof RdoTecnicoRow] as number | null | undefined;
      if (v != null) campos.push({ label, value: String(v).replace(".", ",") });
    });
  } else if (assunto === "meteo") {
    campos.push({ label: "Choveu", value: simNao(r.choveu) }, { label: "Intensidade da chuva", value: r.intensidade_chuva || "Não informada" });
  } else if (assunto === "usina") {
    campos.push({ label: "Usina programada", value: r.usina_programada || "Sem usina" }, { label: "Usina atendeu", value: simNao(r.usina_atendeu) }, { label: "Motivo de não atendimento", value: r.usina_nao_atendeu_motivo || "-" });
  } else if (assunto === "equipamentos") {
    campos.push({ label: "Equipamentos conformes", value: simNao(r.equipamentos_conforme) }, { label: "Não conformidades", value: r.equipamentos_nao_conformes || "-" });
  } else if (assunto === "apoio") {
    campos.push(
      { label: "Retrabalho", value: r.retrabalho ? `Sim — ofício ${r.retrabalho_oficio || "não informado"}` : "Não" },
      { label: "Caminhão basculante (exceto massa)", value: r.qtd_caminhoes_basculante != null ? String(r.qtd_caminhoes_basculante) : "Não informado" },
      { label: "Autorização no horário previsto", value: simNao(r.autorizacao_no_horario) },
      { label: "Detalhes do atraso", value: r.autorizacao_atraso_detalhe || "-" },
      { label: "Sinalização presente no horário", value: simNao(r.sinalizacao_presente) },
      { label: "Qualidade da sinalização", value: estrelas(r.sinalizacao_nota) },
      { label: "Controle tecnológico no horário", value: simNao(r.controle_tecnologico_presente) },
      { label: "Sinalização vertical", value: estrelas(r.sinalizacao_vertical_nota) },
    );
  } else if (assunto === "ocorrencias") {
    campos.push({ label: "Houve ocorrência", value: simNao(r.houve_ocorrencia) }, { label: "Descrição da ocorrência", value: r.descricao_ocorrencia || "Sem descrição" });
  } else if (assunto === "sem_producao") {
    campos.push({ label: "Houve produção", value: simNao(r.houve_producao) }, { label: "Motivo", value: r.motivo_sem_producao || "Sem motivo" }, { label: "Outro motivo", value: r.outro_motivo_sem_producao || "-" });
  }
  campos.push({ label: "Observações", value: r.observacoes || "-", testId: `detalhe-observacoes-${r.id}` });
  return campos;
}

function detalheAssunto(tab: AssuntoTab, r: RdoTecnicoRow) {
  return tab === "producao"
    ? `${r.tipo_servico || "Sem tipo"} • Conclusão: ${r.perc_conclusao_via != null ? `${r.perc_conclusao_via}%` : "-"}`
    : tab === "meteo"
      ? `Chuva ${r.intensidade_chuva || "não informada"}`
      : tab === "usina"
        ? `${r.usina_programada || "Sem usina"} • ${r.usina_atendeu === false ? `Não atendeu (${r.usina_nao_atendeu_motivo || "sem motivo"})` : "Atendeu/sem avaliação"}`
        : tab === "apoio"
          ? [r.retrabalho ? `Retrabalho (ofício ${r.retrabalho_oficio || "s/ nº"})` : null,
              r.qtd_caminhoes_basculante != null ? `${r.qtd_caminhoes_basculante} basculante(s)` : null,
              r.autorizacao_no_horario === false ? "Autorização fora do horário" : null,
              r.sinalizacao_presente === false ? "Sinalização ausente" : r.sinalizacao_nota ? `Sinalização ${r.sinalizacao_nota}/5` : null,
              r.controle_tecnologico_presente === false ? "Controle tecnológico ausente" : null,
              r.sinalizacao_vertical_nota ? `Vertical ${r.sinalizacao_vertical_nota}/5` : null].filter(Boolean).join(" • ") || "Sem registros de apoio"
        : tab === "equipamentos"
          ? r.equipamentos_conforme
            ? "Conforme"
            : `Não conforme: ${r.equipamentos_nao_conformes || "sem descrição"}`
          : tab === "ocorrencias"
            ? r.descricao_ocorrencia || "Sem descrição"
            : !r.houve_producao
              ? motivoSemProducao(r)
              : "-";
}

export default function RelatorioRdoTecnicoDashboard() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();

  const hojeISO = toSaoPauloISODate();
  const primeiroDiaMes = `${hojeISO.slice(0, 7)}-01`;

  const [dataIni, setDataIni] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hojeISO);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroOgs, setFiltroOgs] = useState("");
  const [filtroEng, setFiltroEng] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [busca, setBusca] = useState("");
  const [periodoFila, setPeriodoFila] = useState("acumulado");
  const [obraFila, setObraFila] = useState("");
  const [engenheiroFila, setEngenheiroFila] = useState("");
  const [buscaFila, setBuscaFila] = useState("");

  const [secao, setSecao] = useState<Secao>("geral");
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{ rdo: RdoTecnicoRow; assunto: AssuntoTab; alerta?: AlertaOperacional } | null>(null);
  const [dialogoEng, setDialogoEng] = useState<{ tipo: "registros" | "pendentes"; id: string } | null>(null);
  const [dialogoVinculo, setDialogoVinculo] = useState<"encarregado" | "engenharia" | null>(null);
  const [distribuicaoAberta, setDistribuicaoAberta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RdoTecnicoRow[]>([]);
  const [rowsPrev, setRowsPrev] = useState<RdoTecnicoRow[]>([]);
  const [ogsOptions, setOgsOptions] = useState<FiltroOption[]>([]);
  const [engMap, setEngMap] = useState<Record<string, string>>({});
  const [equipesCadastro, setEquipesCadastro] = useState<string[]>([]);
  const [engenheirosIdentificados, setEngenheirosIdentificados] = useState<EngenheiroIdentificado[]>([]);
  const [rdosApontador, setRdosApontador] = useState<RdoApontador[]>([]);
  const [erroCarga, setErroCarga] = useState("");
  const [periodoCarregado, setPeriodoCarregado] = useState({ inicio: "", fim: "", filaInicio: "" });
  const requisicaoAtual = useRef(0);
  const painelRef = useRef<HTMLElement>(null);

  const periodoAnterior = useMemo(() => getPeriodoAnterior(dataIni, dataFim), [dataIni, dataFim]);

  const companyId = profile?.company_id;
  const acompanhamentoRoster = getEngineeringMonitoringRoster(companyId);
  const inicioFila = periodoFila === "periodo" && dataIni > ENGINEERING_VALIDATION_START ? dataIni : ENGINEERING_VALIDATION_START;

  const buscarDados = async () => {
    if (!companyId) return;
    const requisicao = ++requisicaoAtual.current;
    setLoading(true);
    setErroCarga("");
    try {
      if (!dataIni || !dataFim || dataIni > dataFim) throw new Error("Período técnico inválido");
      const [lista, listaPrev, diariosApontador] = await Promise.all([
        carregarTodas((inicio, fim) => (supabase as any)
          .from("rdo_engenheiro")
          .select(`
          id, ogs_number, data, status, equipe, localizacao, engenheiro_id,
          houve_producao, motivo_sem_producao, outro_motivo_sem_producao,
          choveu, intensidade_chuva, tipo_servico, infra_descricao,
          usina_programada, usina_atendeu, usina_nao_atendeu_motivo,
          equipamentos_conforme, equipamentos_nao_conformes,
          houve_ocorrencia, descricao_ocorrencia, observacoes,
          fresagem_m2, rap_espumado_m2, binder_ton, cbuq_fx3_ton,
          gap_ton, bgs_ton, sma_ton, cauq_rima_ton, bm25_ton, egl_ton, rachao_ton,
          fx_c_ton, demolicao_m, nivelamento_pv_un,
          retrabalho, retrabalho_oficio, qtd_caminhoes_basculante, autorizacao_no_horario, autorizacao_atraso_detalhe,
          sinalizacao_presente, sinalizacao_nota, controle_tecnologico_presente, sinalizacao_vertical_nota,
          geogrelha_m2, bgtc_m3, macadame_m3,
          perc_conclusao_via
        `)
          .eq("company_id", companyId)
          .gte("data", dataIni)
          .lte("data", dataFim)
          .order("data", { ascending: false })
          .order("id", { ascending: false })
          .range(inicio, fim)),
        carregarTodas((inicio, fim) => (supabase as any)
          .from("rdo_engenheiro")
          .select(`
          id, ogs_number, data, status, equipe, localizacao, engenheiro_id,
          houve_producao, motivo_sem_producao, outro_motivo_sem_producao,
          choveu, intensidade_chuva, tipo_servico, infra_descricao,
          usina_programada, usina_atendeu, usina_nao_atendeu_motivo,
          equipamentos_conforme, equipamentos_nao_conformes,
          houve_ocorrencia, descricao_ocorrencia, observacoes,
          fresagem_m2, rap_espumado_m2, binder_ton, cbuq_fx3_ton,
          gap_ton, bgs_ton, sma_ton, cauq_rima_ton, bm25_ton, egl_ton, rachao_ton,
          fx_c_ton, demolicao_m, nivelamento_pv_un,
          retrabalho, retrabalho_oficio, qtd_caminhoes_basculante, autorizacao_no_horario, autorizacao_atraso_detalhe,
          sinalizacao_presente, sinalizacao_nota, controle_tecnologico_presente, sinalizacao_vertical_nota,
          geogrelha_m2, bgtc_m3, macadame_m3,
          perc_conclusao_via
        `)
          .eq("company_id", companyId)
          .gte("data", periodoAnterior.anteriorIni)
          .lte("data", periodoAnterior.anteriorFim)
          .order("data", { ascending: false })
          .order("id", { ascending: false })
          .range(inicio, fim)),
        dataFim < ENGINEERING_VALIDATION_START ? Promise.resolve([])
          : loadEngineeringQueue(supabase, companyId, { from: inicioFila, to: dataFim }),
      ]);
      const { data: eqsCad, error: erroEquipes } = await (supabase as any)
        .from("ci_equipes")
        .select("nome")
        .eq("ativa", true)
        .order("nome");
      if (erroEquipes) throw erroEquipes;
      const ogsUniques = [...new Set(lista.map(r => r.ogs_number).filter(Boolean) as string[])];

      const engIds = [...new Set([
        ...acompanhamentoRoster.includeUserIds,
        ...[...lista, ...listaPrev].map(r => r.engenheiro_id),
        ...diariosApontador.map(r => r.engenheiro_responsavel_user_id),
      ].filter(Boolean) as string[])];
      let perfis: EngenheiroIdentificado[] = [];
      if (engIds.length > 0) {
        const { data, error: erroPerfis } = await supabase
          .from("profiles")
          .select("user_id,nome_completo,email,status")
          .eq("company_id", companyId)
          .in("user_id", engIds);
        if (erroPerfis) throw erroPerfis;
        perfis = (data || []) as EngenheiroIdentificado[];
      }
      if (requisicao !== requisicaoAtual.current) return;
      setRows(lista as RdoTecnicoRow[]);
      setRowsPrev(listaPrev as RdoTecnicoRow[]);
      setRdosApontador(diariosApontador as RdoApontador[]);
      setEquipesCadastro((eqsCad || []).map((e: any) => (e.nome || "").trim()).filter(Boolean));
      setOgsOptions(ogsUniques.sort((a, b) => Number(b) - Number(a)).map(o => ({ value: o, label: `OGS ${o}` })));
      setEngenheirosIdentificados(perfis);
      setEngMap(Object.fromEntries(perfis.map(p => [p.user_id, p.nome_completo || p.email || "Sem nome"])));
      setPeriodoCarregado({ inicio: dataIni, fim: dataFim, filaInicio: inicioFila });
    } catch (e) {
      if (requisicao !== requisicaoAtual.current) return;
      console.error("[RelatorioRdoTecnicoDashboard]", e);
      setErroCarga("Não foi possível carregar o painel completo. Nenhum total parcial foi exibido; tente atualizar.");
      setRows([]);
      setRowsPrev([]);
      setEngenheirosIdentificados([]);
      setRdosApontador([]);
      setOgsOptions([]);
      setEngMap({});
      setEquipesCadastro([]);
    }
    if (requisicao === requisicaoAtual.current) setLoading(false);
  };

  useEffect(() => {
    if (companyId) buscarDados();
  }, [companyId, dataIni, dataFim, inicioFila]);

  // Trocar de seção sempre começa pelo topo do painel único.
  useEffect(() => {
    if (painelRef.current) painelRef.current.scrollTop = 0;
  }, [secao]);

  const irSecao = (destino: Secao, focoId: string | null = null) => {
    setSecao(destino);
    setFoco(focoId);
  };

  const equipesFiltro = useMemo(() => {
    const doHistorico = rows.map((r) => (r.equipe || "").trim()).filter(Boolean);
    const base = [...equipesCadastro, ...doHistorico];

    if (filtroEquipe && !base.some((e) => e.toLowerCase() === filtroEquipe.toLowerCase())) {
      base.push(filtroEquipe);
    }

    return [...new Set(base)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, equipesCadastro, filtroEquipe]);

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return rows.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroOgs && r.ogs_number !== filtroOgs) return false;
      if (filtroEng && r.engenheiro_id !== filtroEng) return false;
      if (filtroEquipe && (r.equipe || "") !== filtroEquipe) return false;

      if (!q) return true;

      const nomeEng = r.engenheiro_id ? engMap[r.engenheiro_id] || "" : "";
      const texto = [
        r.ogs_number,
        r.equipe,
        r.localizacao,
        r.tipo_servico,
        r.infra_descricao,
        r.status,
        nomeEng,
        r.motivo_sem_producao,
        r.outro_motivo_sem_producao,
        r.descricao_ocorrencia,
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [rows,filtroStatus, filtroOgs, filtroEng, filtroEquipe, busca, engMap]);

  const linhasPrevFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return rowsPrev.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroOgs && r.ogs_number !== filtroOgs) return false;
      if (filtroEng && r.engenheiro_id !== filtroEng) return false;
      if (filtroEquipe && (r.equipe || "") !== filtroEquipe) return false;

      if (!q) return true;

      const nomeEng = r.engenheiro_id ? engMap[r.engenheiro_id] || "" : "";
      const texto = [
        r.ogs_number,
        r.equipe,
        r.localizacao,
        r.tipo_servico,
        r.infra_descricao,
        r.status,
        nomeEng,
        r.motivo_sem_producao,
        r.outro_motivo_sem_producao,
        r.descricao_ocorrencia,
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [rowsPrev,filtroStatus, filtroOgs, filtroEng, filtroEquipe, busca, engMap]);

  const kpis = useMemo(() => {
    const total = linhasFiltradas.length;
    const enviados = linhasFiltradas.filter(r => r.status === "enviado").length;
    const rascunhos = linhasFiltradas.filter(r => r.status !== "enviado").length;
    const comProducao = linhasFiltradas.filter(r => r.houve_producao).length;
    const semProducao = total - comProducao;
    const folgasFeriados = linhasFiltradas.filter(isFolgaFeriado).length;
    const comOcorrencia = linhasFiltradas.filter(r => r.houve_ocorrencia).length;
    const comChuva = linhasFiltradas.filter(r => r.choveu).length;
    const usinaNaoAtendeu = linhasFiltradas.filter(r => r.usina_atendeu === false || usinaNaoAtendeuSemProducao(r)).length;
    const naoConformeEquip = linhasFiltradas.filter(r => r.equipamentos_conforme === false).length;

    const conformeCount = linhasFiltradas.filter(r => r.equipamentos_conforme === true).length;
    const avaliadosEquip = linhasFiltradas.filter(r => r.equipamentos_conforme !== null).length;
    const percConformeEquip = avaliadosEquip > 0 ? (conformeCount / avaliadosEquip) * 100 : 0;

    const toneladas = linhasFiltradas.reduce((acc, r) => acc
      + (r.binder_ton || 0)
      + (r.cbuq_fx3_ton || 0)
      + (r.gap_ton || 0)
      + (r.bgs_ton || 0)
      + (r.sma_ton || 0)
      + (r.cauq_rima_ton || 0)
      + (r.bm25_ton || 0)
      + (r.egl_ton || 0)
      + (r.rachao_ton || 0)
      + (r.fx_c_ton || 0), 0);

    const areaM2 = linhasFiltradas.reduce((acc, r) => acc
      + (r.fresagem_m2 || 0)
      + (r.rap_espumado_m2 || 0)
      + (r.geogrelha_m2 || 0), 0);

    const volumeM3 = linhasFiltradas.reduce((acc, r) => acc
      + (r.bgtc_m3 || 0)
      + (r.macadame_m3 || 0), 0);

    const semNomeEng = linhasFiltradas.filter((r) => !r.engenheiro_id || !engMap[r.engenheiro_id]).length;

    return {
      total,
      enviados,
      rascunhos,
      comProducao,
      semProducao,
      folgasFeriados,
      outrosMotivosSemProducao: semProducao - folgasFeriados,
      comOcorrencia,
      comChuva,
      usinaNaoAtendeu,
      naoConformeEquip,
      percConformeEquip,
      toneladas,
      areaM2,
      volumeM3,
      semNomeEng,
    };
  }, [linhasFiltradas, engMap]);

  const kpisPrev = useMemo(() => {
    const total = linhasPrevFiltradas.length;
    const enviados = linhasPrevFiltradas.filter(r => r.status === "enviado").length;
    const rascunhos = linhasPrevFiltradas.filter(r => r.status !== "enviado").length;
    const comProducao = linhasPrevFiltradas.filter(r => r.houve_producao).length;
    const semProducao = total - comProducao;
    const comOcorrencia = linhasPrevFiltradas.filter(r => r.houve_ocorrencia).length;
    const comChuva = linhasPrevFiltradas.filter(r => r.choveu).length;
    const usinaNaoAtendeu = linhasPrevFiltradas.filter(r => r.usina_atendeu === false || usinaNaoAtendeuSemProducao(r)).length;
    const naoConformeEquip = linhasPrevFiltradas.filter(r => r.equipamentos_conforme === false).length;

    const conformeCount = linhasPrevFiltradas.filter(r => r.equipamentos_conforme === true).length;
    const avaliadosEquip = linhasPrevFiltradas.filter(r => r.equipamentos_conforme !== null).length;
    const percConformeEquip = avaliadosEquip > 0 ? (conformeCount / avaliadosEquip) * 100 : 0;

    const toneladas = linhasPrevFiltradas.reduce((acc, r) => acc
      + (r.binder_ton || 0)
      + (r.cbuq_fx3_ton || 0)
      + (r.gap_ton || 0)
      + (r.bgs_ton || 0)
      + (r.sma_ton || 0)
      + (r.cauq_rima_ton || 0)
      + (r.bm25_ton || 0)
      + (r.egl_ton || 0)
      + (r.rachao_ton || 0)
      + (r.fx_c_ton || 0), 0);

    const areaM2 = linhasPrevFiltradas.reduce((acc, r) => acc
      + (r.fresagem_m2 || 0)
      + (r.rap_espumado_m2 || 0)
      + (r.geogrelha_m2 || 0), 0);

    const volumeM3 = linhasPrevFiltradas.reduce((acc, r) => acc
      + (r.bgtc_m3 || 0)
      + (r.macadame_m3 || 0), 0);

    return {
      total,
      enviados,
      rascunhos,
      comProducao,
      semProducao,
      comOcorrencia,
      comChuva,
      usinaNaoAtendeu,
      naoConformeEquip,
      percConformeEquip,
      toneladas,
      areaM2,
      volumeM3,
    };
  }, [linhasPrevFiltradas]);

  const comparativo = useMemo(() => {
    const calc = (atual: number, anterior: number) => {
      const delta = atual - anterior;
      const perc = anterior === 0 ? null : (delta / anterior) * 100;
      return { atual, anterior, delta, perc };
    };

    return {
      total: calc(kpis.total, kpisPrev.total),
      comProducao: calc(kpis.comProducao, kpisPrev.comProducao),
      semProducao: calc(kpis.semProducao, kpisPrev.semProducao),
      naoConforme: calc(kpis.naoConformeEquip, kpisPrev.naoConformeEquip),
      toneladas: calc(kpis.toneladas, kpisPrev.toneladas),
      areaM2: calc(kpis.areaM2, kpisPrev.areaM2),
      volumeM3: calc(kpis.volumeM3, kpisPrev.volumeM3),
      chuva: calc(kpis.comChuva, kpisPrev.comChuva),
      ocorrencias: calc(kpis.comOcorrencia, kpisPrev.comOcorrencia),
      conformidade: calc(kpis.percConformeEquip, kpisPrev.percConformeEquip),
    };
  }, [kpis, kpisPrev]);

  // Explicit independent filters: technical authorship is not validation responsibility.
  const filaFiltrada = useMemo(() => filterEngineeringQueue(rdosApontador,
    { obra: obraFila, engineer: engenheiroFila, search: buscaFila }, engMap),
    [rdosApontador, obraFila, engenheiroFila, buscaFila, engMap]);
  const obrasFila = useMemo(() => [...new Set(rdosApontador.map(r => r.obra_nome).filter(Boolean))]
    .sort((a, b) => a!.localeCompare(b!, "pt-BR")), [rdosApontador]);
  const monitoramento = useMemo(() => buildEngineeringMonitoring(
    engenheirosIdentificados, linhasFiltradas, filaFiltrada,
    { from: dataIni, to: dataFim }, { from: inicioFila, to: dataFim },
  ), [engenheirosIdentificados, linhasFiltradas, filaFiltrada, dataIni, dataFim, inicioFila]);
  const pendenciasSemVinculo = useMemo(() => classifyUnlinkedValidationRdos(filaFiltrada), [filaFiltrada]);
  const lancamentosEngenheiros = monitoramento.launchRows.filter(p =>
    !acompanhamentoRoster.excludeLaunchUserIds.includes(p.id) && (!filtroEng || p.id === filtroEng));
  const validacoesPendentes = monitoramento.pendingRows;

  const serieEngenheiro = useMemo(() => {
    const map: Record<string, number> = {};
    engenheirosIdentificados.forEach((p) => { map[p.user_id] = 0; });
    linhasFiltradas.filter(r => r.status === "enviado").forEach((r) => {
      if (r.engenheiro_id) map[r.engenheiro_id] = (map[r.engenheiro_id] || 0) + 1;
    });

    return Object.entries(map)
      .map(([id, value]) => ({ name: engMap[id] || engenheirosIdentificados.find(p => p.user_id === id)?.nome_completo || `Sem cadastro (${id.slice(0, 6)})`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [linhasFiltradas, engMap, engenheirosIdentificados]);

  const cardsAssunto = useMemo(() => {
    return {
      producao: linhasFiltradas.filter(r => r.houve_producao),
      meteo: linhasFiltradas.filter(r => r.choveu),
      usina: linhasFiltradas.filter(r => r.usina_programada || r.usina_atendeu === false || usinaNaoAtendeuSemProducao(r)),
      equipamentos: linhasFiltradas.filter(r => r.equipamentos_conforme !== null),
      apoio: linhasFiltradas.filter(temApoio),
      ocorrencias: linhasFiltradas.filter(r => r.houve_ocorrencia),
      sem_producao: linhasFiltradas.filter(r => !r.houve_producao),
    };
  }, [linhasFiltradas]);

  const apoioMetrics = useMemo(() => computeApoioMetrics(linhasFiltradas), [linhasFiltradas]);

  const atividadesQualitativas = useMemo(() => {
    const produtivas = linhasFiltradas.filter(r => r.houve_producao);
    return {
      infra: produtivas.filter(r => hasServiceToken(r.tipo_servico, INFRA_SERVICE)).length,
      ensaios: produtivas.filter(r => hasServiceToken(r.tipo_servico, ENSAIOS_SERVICE)).length,
    };
  }, [linhasFiltradas]);

  const alertasOperacionais = useMemo(() => {
    const itens: AlertaOperacional[] = [];

    linhasFiltradas.forEach((r) => {
      if (r.status !== "enviado") return;
      if (!r.houve_producao && !isFolgaFeriado(r)) {
        const motivo = r.motivo_sem_producao === "Outro"
          ? (r.outro_motivo_sem_producao || "Outro")
          : (r.motivo_sem_producao || "Sem motivo informado");
        itens.push({
          id: `${r.id}-sem-producao`,
          prioridade: "Alta",
          prioridadePeso: 1,
          assunto: "Sem produção",
          detalhe: motivo,
          tabDestino: "sem_producao",
          rdo: r,
        });
      }

      if (r.usina_atendeu === false) {
        itens.push({
          id: `${r.id}-usina`,
          prioridade: "Alta",
          prioridadePeso: 1,
          assunto: "Usina não atendeu",
          detalhe: r.usina_nao_atendeu_motivo || "Sem motivo informado",
          tabDestino: "usina",
          rdo: r,
        });
      }

      if (r.equipamentos_conforme === false) {
        itens.push({
          id: `${r.id}-equip`,
          prioridade: "Alta",
          prioridadePeso: 1,
          assunto: "Não conformidade de equipamentos",
          detalhe: r.equipamentos_nao_conformes || "Sem descrição",
          tabDestino: "equipamentos",
          rdo: r,
        });
      }

      if (r.houve_producao) {
        const apoio = (id: string, assunto: string, detalhe: string) => itens.push({
          id: `${r.id}-${id}`, prioridade: "Média", prioridadePeso: 2, assunto, detalhe, tabDestino: "apoio", rdo: r,
        });
        if (r.autorizacao_no_horario === false) apoio("autorizacao", "Autorização fora do horário", r.autorizacao_atraso_detalhe || "Sem detalhes informados");
        if (r.sinalizacao_presente === false) apoio("sinalizacao-ausente", "Sinalização ausente no horário", "Equipe de sinalização não estava presente");
        else if (r.sinalizacao_nota && r.sinalizacao_nota <= NOTA_BAIXA) apoio("sinalizacao-nota", "Sinalização com nota baixa", `Nota ${r.sinalizacao_nota}/5`);
        if (r.controle_tecnologico_presente === false) apoio("ct", "Controle tecnológico ausente", "Equipe de controle tecnológico não esteve presente no horário");
        if (r.sinalizacao_vertical_nota && r.sinalizacao_vertical_nota <= NOTA_BAIXA) apoio("vertical", "Sinalização vertical com nota baixa", `Nota ${r.sinalizacao_vertical_nota}/5`);
        if (r.retrabalho) apoio("retrabalho", "Retrabalho", `Ofício ${r.retrabalho_oficio || "não informado"}`);
      }

      if (r.houve_ocorrencia) {
        itens.push({
          id: `${r.id}-ocorrencia`,
          prioridade: "Média",
          prioridadePeso: 2,
          assunto: "Ocorrência",
          detalhe: r.descricao_ocorrencia || "Sem descrição",
          tabDestino: "ocorrencias",
          rdo: r,
        });
      }
    });

    return itens
      .sort((a, b) => {
        if (a.prioridadePeso !== b.prioridadePeso) return a.prioridadePeso - b.prioridadePeso;
        return b.rdo.data.localeCompare(a.rdo.data);
      });
  }, [linhasFiltradas]);

  const engenheiroOptions = useMemo(() => {
    const nomes = new Map<string, string>();
    engenheirosIdentificados.forEach(p => nomes.set(p.user_id, p.nome_completo || p.email || "Sem nome"));
    Object.entries(engMap).forEach(([id, nome]) => nomes.set(id, nome));
    return [...nomes]
      .map(([id, nome]) => ({ value: id, label: nome }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [engMap, engenheirosIdentificados]);

  const exportarCsv = () => {
    const head = [
      "Data",
      "OGS",
      "Status",
      "Engenheiro",
      "Equipe",
      "Localização",
      "Houve produção",
      "Tipo serviço",
      "Usina",
      "Usina atendeu",
      "Equipamentos conformes",
      "Houve ocorrência",
      "Motivo sem produção",
      "Descrição ocorrência",
      "Observações",
      "ID do RDO",
      "Descrição de INFRA",
      ...TECHNICAL_QUANTITIES.map(q => q.label),
      "Retrabalho",
      "Ofício do retrabalho",
      "Caminhão basculante (exceto massa)",
      "Autorização no horário",
      "Detalhes do atraso na autorização",
      "Sinalização presente",
      "Nota sinalização (1-5)",
      "Controle tecnológico presente",
      "Nota sinalização vertical (1-5)",
    ];

    const linhas = linhasFiltradas.map((r) => [
      fmtDate(r.data),
      r.ogs_number || "",
      r.status,
      r.engenheiro_id ? engMap[r.engenheiro_id] || "" : "",
      r.equipe || "",
      r.localizacao || "",
      r.houve_producao ? "Sim" : "Não",
      r.tipo_servico || "",
      r.usina_programada || "",
      r.usina_atendeu == null ? "" : r.usina_atendeu ? "Sim" : "Não",
      r.equipamentos_conforme == null ? "" : r.equipamentos_conforme ? "Sim" : "Não",
      r.houve_ocorrencia ? "Sim" : "Não",
      !r.houve_producao ? (r.motivo_sem_producao === "Outro" ? (r.outro_motivo_sem_producao || "Outro") : (r.motivo_sem_producao || "")) : "",
      r.descricao_ocorrencia || "",
      r.observacoes || "",
      r.id,
      r.infra_descricao ?? "",
      ...TECHNICAL_QUANTITIES.map(({ field }) => {
        const valor = r[field as keyof RdoTecnicoRow] as number | null | undefined;
        return valor == null ? "" : String(valor).replace(".", ",");
      }),
      r.houve_producao ? (r.retrabalho ? "Sim" : "Não") : "",
      r.retrabalho_oficio || "",
      r.qtd_caminhoes_basculante == null ? "" : String(r.qtd_caminhoes_basculante),
      r.autorizacao_no_horario == null ? "" : r.autorizacao_no_horario ? "Sim" : "Não",
      r.autorizacao_atraso_detalhe || "",
      r.sinalizacao_presente == null ? "" : r.sinalizacao_presente ? "Sim" : "Não",
      r.sinalizacao_nota == null ? "" : String(r.sinalizacao_nota),
      r.controle_tecnologico_presente == null ? "" : r.controle_tecnologico_presente ? "Sim" : "Não",
      r.sinalizacao_vertical_nota == null ? "" : String(r.sinalizacao_vertical_nota),
    ]);

    const csv = "﻿" + [head, ...linhas].map((l) => l.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WF_RDO_Tecnico_${dataIni}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarCsvExecutivo = () => {
    const linhasResumo = [
      ["Métrica", "Período Atual", "Período Anterior", "Variação Absoluta", "Variação %"],
      ["RDOs registrados (inclui rascunhos)", kpis.total, kpisPrev.total, comparativo.total.delta, comparativo.total.perc ?? "Sem base percentual"],
      ["RDOs com produção", kpis.comProducao, kpisPrev.comProducao, comparativo.comProducao.delta, comparativo.comProducao.perc ?? "Sem base percentual"],
      ["RDOs sem produção", kpis.semProducao, kpisPrev.semProducao, comparativo.semProducao.delta, comparativo.semProducao.perc ?? "Sem base percentual"],
      ["RDOs não conformes (equipamentos)", kpis.naoConformeEquip, kpisPrev.naoConformeEquip, comparativo.naoConforme.delta, comparativo.naoConforme.perc ?? "Sem base percentual"],
      ["Produção (t)", kpis.toneladas, kpisPrev.toneladas, comparativo.toneladas.delta, comparativo.toneladas.perc ?? "Sem base percentual"],
      ["Produção (m²)", kpis.areaM2, kpisPrev.areaM2, comparativo.areaM2.delta, comparativo.areaM2.perc ?? "Sem base percentual"],
      ["Produção (m³)", kpis.volumeM3, kpisPrev.volumeM3, comparativo.volumeM3.delta, comparativo.volumeM3.perc ?? "Sem base percentual"],
      ["RDOs com chuva", kpis.comChuva, kpisPrev.comChuva, comparativo.chuva.delta, comparativo.chuva.perc ?? "Sem base percentual"],
      ["RDOs com ocorrência", kpis.comOcorrencia, kpisPrev.comOcorrencia, comparativo.ocorrencias.delta, comparativo.ocorrencias.perc ?? "Sem base percentual"],
      ["Conformidade dos equipamentos (%)", kpis.percConformeEquip, kpisPrev.percConformeEquip, comparativo.conformidade.delta, comparativo.conformidade.perc ?? "Sem base percentual"],
    ];

    const linhasAlertas = [
      [],
      ["Alertas operacionais", "Prioridade", "Data", "OGS", "Engenheiro", "Equipe", "Assunto", "Detalhe"],
      ...alertasOperacionais.map((p) => [
        "",
        p.prioridade,
        fmtDate(p.rdo.data),
        p.rdo.ogs_number || "",
        p.rdo.engenheiro_id ? (engMap[p.rdo.engenheiro_id] || "") : "",
        p.rdo.equipe || "",
        p.assunto,
        p.detalhe,
      ]),
    ];

    const linhas = [
      ["Dashboard RDO Técnico — Resumo Executivo"],
      ["Período atual", `${fmtDate(dataIni)} a ${fmtDate(dataFim)}`],
      ["Período anterior", `${fmtDate(periodoAnterior.anteriorIni)} a ${fmtDate(periodoAnterior.anteriorFim)}`],
      ["Filtros", `Status=${filtroStatus || "Todos"}; OGS=${filtroOgs || "Todas"}; Engenheiro=${filtroEng ? (engMap[filtroEng] || filtroEng) : "Todos"}; Equipe=${filtroEquipe || "Todas"}; Busca=${busca || "-"}`],
      [],
      ...linhasResumo,
      ...linhasAlertas,
    ];

    const csv = "﻿" + linhas.map((l) => l.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WF_RDO_Tecnico_Resumo_Executivo_${dataIni}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const carregando = loading || (!erroCarga && (periodoCarregado.inicio !== dataIni || periodoCarregado.fim !== dataFim || periodoCarregado.filaInicio !== inicioFila));
  const pronto = !carregando && !erroCarga;
  const chaveTecnica = `${dataIni}|${dataFim}|${filtroStatus}|${filtroOgs}|${filtroEng}|${filtroEquipe}|${busca}`;
  const chaveFila = `${periodoFila}|${obraFila}|${engenheiroFila}|${buscaFila}|${dataIni}|${dataFim}`;
  const maisFiltrosAtivos = [filtroStatus, filtroEng, filtroEquipe].filter(Boolean).length;
  const rotuloFila = periodoFila === "acumulado" ? `acumulada desde ${fmtDate(ENGINEERING_VALIDATION_START)}` : `somente ${fmtDate(inicioFila)} a ${fmtDate(dataFim)}`;

  const contadores: Record<Secao, string> = {
    geral: pronto ? fmtNum(kpis.total) : "—",
    producao: pronto ? String(cardsAssunto.producao.length) : "—",
    preenchimento: pronto ? String(lancamentosEngenheiros.length) : "—",
    validacoes: pronto ? String(filaFiltrada.length) : "—",
    alertas: pronto ? String(alertasOperacionais.length) : "—",
    meteo: pronto ? String(cardsAssunto.meteo.length) : "—",
    usina: pronto ? String(cardsAssunto.usina.length) : "—",
    equipamentos: pronto ? String(cardsAssunto.equipamentos.length) : "—",
    apoio: pronto ? String(cardsAssunto.apoio.length) : "—",
    ocorrencias: pronto ? String(cardsAssunto.ocorrencias.length) : "—",
    sem_producao: pronto ? String(cardsAssunto.sem_producao.length) : "—",
  };

  const nomeEng = (id: string | null) => (id ? (engMap[id] || "-") : "-");
  const abrirDetalhe = (rdo: RdoTecnicoRow, assunto: AssuntoTab, alerta?: AlertaOperacional) => setDetalhe({ rdo, assunto, alerta });

  const botaoDetalhes = (r: RdoTecnicoRow, assunto: AssuntoTab, alerta?: AlertaOperacional) => (
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-label={`Ver detalhes do RDO de ${fmtDate(r.data)}, OGS ${r.ogs_number || "sem OGS"}`}
      onClick={() => abrirDetalhe(r, assunto, alerta)}>Ver detalhes</Button>
  );

  const badgeStatus = (r: RdoTecnicoRow) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === "enviado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
      {r.status === "enviado" ? "Enviado" : "Rascunho"}
    </span>
  );

  const colunasAssunto = (tab: AssuntoTab): Coluna<RdoTecnicoRow>[] => [
    { titulo: "Data", className: "whitespace-nowrap", render: r => fmtDate(r.data) },
    { titulo: "OGS", className: "whitespace-nowrap", render: r => r.ogs_number || "-" },
    { titulo: "Engenheiro", className: "whitespace-nowrap", render: r => nomeEng(r.engenheiro_id) },
    { titulo: "Equipe / Setor", className: "whitespace-nowrap", render: r => r.equipe || "-" },
    { titulo: "Status", className: "whitespace-nowrap", render: badgeStatus },
    {
      titulo: "Detalhes do assunto",
      render: r => (
        <>
          <Previa>{detalheAssunto(tab, r)}</Previa>
          {tab === "producao" && hasServiceToken(r.tipo_servico, INFRA_SERVICE) && (
            <Previa testId={`infra-previa-${r.id}`} className={`mt-1 text-xs ${r.infra_descricao?.trim() ? "text-muted-foreground" : "font-semibold text-amber-700"}`}>
              {r.infra_descricao?.trim() ? r.infra_descricao : "Descrição de INFRA não informada"}
            </Previa>
          )}
        </>
      ),
    },
    { titulo: "Ação", className: "whitespace-nowrap", render: r => botaoDetalhes(r, tab) },
  ];

  const colunasAlertas: Coluna<AlertaOperacional>[] = [
    {
      titulo: "Prioridade", className: "whitespace-nowrap",
      render: p => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${p.prioridade === "Alta" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.prioridade}</span>
      ),
    },
    { titulo: "Data", className: "whitespace-nowrap", render: p => fmtDate(p.rdo.data) },
    { titulo: "OGS", className: "whitespace-nowrap", render: p => p.rdo.ogs_number || "-" },
    { titulo: "Engenheiro", className: "whitespace-nowrap", render: p => nomeEng(p.rdo.engenheiro_id) },
    { titulo: "Equipe", className: "whitespace-nowrap", render: p => p.rdo.equipe || "-" },
    { titulo: "Assunto", className: "whitespace-nowrap", render: p => p.assunto },
    { titulo: "Detalhe", render: p => <Previa>{p.detalhe}</Previa> },
    {
      titulo: "Ação", className: "whitespace-nowrap",
      render: p => (
        <div className="flex gap-1">
          {botaoDetalhes(p.rdo, p.tabDestino, p)}
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
            onClick={() => {
              setBusca((p.rdo.ogs_number || p.rdo.equipe || "").trim());
              irSecao(p.tabDestino, p.rdo.id);
            }}>
            Ver assunto
          </Button>
        </div>
      ),
    },
  ];

  const linhasComparativo: { titulo: string; c: { atual: number; anterior: number; delta: number; perc: number | null }; frac: number; invert?: boolean }[] = [
    { titulo: "Total de RDOs", c: comparativo.total, frac: 0 },
    { titulo: "RDOs com produção", c: comparativo.comProducao, frac: 0 },
    { titulo: "RDOs sem produção", c: comparativo.semProducao, frac: 0, invert: true },
    { titulo: "Produção (t)", c: comparativo.toneladas, frac: 1 },
    { titulo: "Produção (m²)", c: comparativo.areaM2, frac: 1 },
    { titulo: "Produção (m³)", c: comparativo.volumeM3, frac: 1 },
    { titulo: "Conformidade de equipamentos (%)", c: comparativo.conformidade, frac: 1 },
  ];

  const renderGeral = () => (
    <section aria-label="Resumo executivo" className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Lançamentos técnicos de {fmtDate(dataIni)} a {fmtDate(dataFim)} · Fila de validação dos apontadores: {rotuloFila}
      </p>
      <div data-testid="resumo-status" className="divide-y rounded-lg border text-sm">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3 py-1.5">
          <span className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">Lançamento</span>
          <span>Enviados <strong>{fmtNum(kpis.enviados)}</strong></span>
          <span>Rascunhos <strong>{fmtNum(kpis.rascunhos)}</strong></span>
          <span>Com chuva <strong>{fmtNum(kpis.comChuva)}</strong></span>
          <span>Conformidade dos equipamentos <strong>{fmtNum(kpis.percConformeEquip, 1)}%</strong></span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3 py-1.5">
          <span className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sem produção</span>
          <span><strong>{fmtNum(kpis.semProducao)}</strong> RDOs</span>
          <span data-testid="resumo-sem-producao" className="text-muted-foreground">{kpis.folgasFeriados} folga/feriado · {kpis.outrosMotivosSemProducao} outros motivos</span>
          <span>Base/Volume: <strong>{fmtNum(kpis.volumeM3, 1)} m³</strong></span>
        </p>
      </div>
      <div data-testid="chips-operacionais" className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => irSecao("alertas")} className="rounded-lg border border-red-300 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Alertas operacionais: {alertasOperacionais.length}</button>
        <button type="button" onClick={() => irSecao("validacoes")} className="rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50">Validações pendentes ({rotuloFila}): {filaFiltrada.length}</button>
        <button type="button" onClick={() => irSecao("usina")} className="rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50">Usina não atendeu: {kpis.usinaNaoAtendeu}</button>
        <button type="button" onClick={() => irSecao("apoio")} className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50">Apoio e Qualidade: {cardsAssunto.apoio.length}{apoioMetrics.retrabalho.total > 0 ? ` · Retrabalhos: ${apoioMetrics.retrabalho.total}` : ""}</button>
        <button type="button" onClick={() => irSecao("equipamentos")} className="rounded-lg border border-yellow-300 bg-white px-2 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-50">Não conformidade de equipamentos: {kpis.naoConformeEquip}</button>
        <button type="button" onClick={() => irSecao("ocorrencias")} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ocorrências: {kpis.comOcorrencia}</button>
        <span className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Engenheiro sem identificação: {kpis.semNomeEng}</span>
      </div>
      <div>
        <section className="rounded-lg border px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Comparativo com período anterior</h3>
            <p className="text-xs text-muted-foreground">
              Atual: <span className="font-semibold text-foreground">{fmtDate(dataIni)} a {fmtDate(dataFim)}</span> ·
              Anterior: <span className="font-semibold text-foreground"> {fmtDate(periodoAnterior.anteriorIni)} a {fmtDate(periodoAnterior.anteriorFim)}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-0.5 pr-2 font-semibold">Métrica</th><th className="pb-0.5 pr-2 font-semibold">Atual</th><th className="pb-0.5 pr-2 font-semibold">Anterior</th><th className="pb-0.5 font-semibold">Variação</th>
                </tr>
              </thead>
              <tbody>
                {linhasComparativo.map(l => (
                  <tr key={l.titulo} className="border-t">
                    <td className="py-0.5 pr-2">{l.titulo}</td>
                    <td className="py-0.5 pr-2 font-bold">{fmtNum(l.c.atual, l.frac)}</td>
                    <td className="py-0.5 pr-2 text-muted-foreground">{fmtNum(l.c.anterior, l.frac)}</td>
                    <td className="py-0.5"><DeltaPill delta={l.c.delta} perc={l.c.perc} invert={l.invert} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );

  const renderAssunto = (tab: AssuntoTab) => {
    const lista = cardsAssunto[tab as keyof typeof cardsAssunto] || [];
    return (
      <SecaoShell titulo={TITULO_ASSUNTO[tab]} subtitulo={`${lista.length} registro(s) · ${RESUMO_ASSUNTO[tab]}`}>
        {tab === "producao" && (
          <div data-testid="atividades-qualitativas" className="shrink-0 flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-1.5 text-sm">
            <span className="font-semibold">Atividades qualitativas</span>
            <span className="text-muted-foreground">RDOs por atividade:</span>
            <span className="rounded-lg border bg-white px-2 py-0.5">INFRA: <strong data-testid="qualitativa-infra">{atividadesQualitativas.infra}</strong></span>
            <span className="rounded-lg border bg-white px-2 py-0.5">ENSAIOS E EXTRAÇÕES: <strong data-testid="qualitativa-ensaios">{atividadesQualitativas.ensaios}</strong></span>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold">Como interpretar</summary>
              Contagem de RDOs por atividade, nos filtros atuais. Um RDO pode aparecer em mais de uma atividade (os valores podem se sobrepor) e os números não representam t, m² ou m³, nem alteram as somas de medição.
            </details>
          </div>
        )}
        <TabelaPaginada className="lg:flex-1" itens={lista} colunas={colunasAssunto(tab)} getKey={r => r.id}
          resetKey={`${tab}|${chaveTecnica}`} focusKey={foco} vazio="Nenhum lançamento para este assunto com os filtros atuais." rotulo="registros" minWidth={860} />
      </SecaoShell>
    );
  };

  const renderApoio = () => {
    const m = apoioMetrics;
    const pct = (v: number | null) => (v == null ? "—" : `${fmtNum(v, 0)}%`);
    const nota = (v: number | null) => (v == null ? "—" : `${fmtNum(v, 1)} / 5`);
    const lista = cardsAssunto.apoio;
    const semDados = m.notaSinalizacao.avaliados === 0 && m.notaVertical.avaliados === 0;
    const grafDist = (titulo: string, dados: { nota: string; value: number }[], cor: string) => (
      <div className="min-w-0 rounded-xl border bg-white p-2">
        <h3 className="text-xs font-bold text-muted-foreground">{titulo}</h3>
        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nota" tickFormatter={n => `${n}★`} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} RDO(s)`, "Quantidade"]} labelFormatter={n => `Nota ${n}`} />
              <Bar dataKey="value" fill={cor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
    return (
      <SecaoShell titulo={TITULO_ASSUNTO.apoio} subtitulo={`${lista.length} registro(s) · ${RESUMO_ASSUNTO.apoio}`}>
        <div data-testid="apoio-kpis" className="shrink-0 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <KpiCard icon={Activity} titulo="Autorização no horário" valor={pct(m.autorizacao.pct)} cor="text-emerald-600" subtitulo={`${m.autorizacao.nao} fora do horário · ${m.autorizacao.avaliados} avaliados`} />
          <KpiCard icon={Users} titulo="Sinalização presente" valor={pct(m.sinalizacaoPresente.pct)} cor="text-blue-600" subtitulo={`${m.sinalizacaoPresente.nao} ausências · ${m.sinalizacaoPresente.avaliados} avaliados`} />
          <KpiCard icon={Star} titulo="Nota da sinalização" valor={nota(m.notaSinalizacao.media)} cor="text-amber-500" subtitulo={`${m.notaSinalizacao.avaliados} avaliações`} />
          <KpiCard icon={ClipboardCheck} titulo="Controle tecnológico presente" valor={pct(m.controleTecnologico.pct)} cor="text-violet-600" subtitulo={`${m.controleTecnologico.nao} ausências · ${m.controleTecnologico.avaliados} avaliados`} />
          <KpiCard icon={Star} titulo="Nota da sinalização vertical" valor={nota(m.notaVertical.media)} cor="text-amber-500" subtitulo={`${m.notaVertical.avaliados} avaliações`} />
          <KpiCard icon={AlertTriangle} titulo="Retrabalhos" valor={fmtNum(m.retrabalho.total)} cor="text-red-600" subtitulo={m.retrabalho.semOficio > 0 ? `${m.retrabalho.semOficio} sem nº de ofício` : "todos com ofício"} />
          <KpiCard icon={Gauge} titulo="Caminhões basculantes (exceto massa)" valor={fmtNum(m.caminhoes.total)} cor="text-slate-600" subtitulo={m.caminhoes.mediaDia == null ? "sem registros" : `média de ${fmtNum(m.caminhoes.mediaDia, 1)} por RDO`} />
        </div>
        {!semDados && (
          <div data-testid="apoio-graficos" className="shrink-0 grid grid-cols-1 gap-2 md:grid-cols-3">
            {grafDist("Notas da equipe de sinalização", m.notaSinalizacao.distribuicao, "#f59e0b")}
            {grafDist("Notas da sinalização vertical", m.notaVertical.distribuicao, "#2563eb")}
            <div className="min-w-0 rounded-xl border bg-white p-2">
              <h3 className="text-xs font-bold text-muted-foreground">Nota média por OGS</h3>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.notaPorOgs.map(o => ({ ...o, sinalizacao: o.sinalizacao ?? 0, vertical: o.vertical ?? 0 }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => (v ? `${fmtNum(v, 1)} / 5` : "sem nota")} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sinalizacao" name="Sinalização" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vertical" name="Vertical" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        <Interpretar>
          <p>Considera somente RDOs com produção nos filtros atuais; dia sem produção não preenche esta seção. Percentuais usam apenas os RDOs que responderam a pergunta (rascunhos incluídos). Notas de sinalização só existem quando a equipe estava presente. Nota baixa = {NOTA_BAIXA} ou menos e gera alerta, assim como autorização fora do horário, ausência de sinalização ou de controle tecnológico e retrabalho.</p>
        </Interpretar>
        <TabelaPaginada className="lg:flex-1" itens={lista} colunas={colunasAssunto("apoio")} getKey={r => r.id}
          resetKey={`apoio|${chaveTecnica}`} focusKey={foco} vazio="Nenhum RDO com informações de apoio nos filtros atuais." rotulo="registros" minWidth={860} />
      </SecaoShell>
    );
  };

  const renderPreenchimento = () => (
    <SecaoShell titulo="Preenchimento de RDO Técnico pelos engenheiros"
      subtitulo={<>{fmtDate(dataIni)} a {fmtDate(dataFim)} · {lancamentosEngenheiros.reduce((s, p) => s + p.enviados, 0)} enviados · {lancamentosEngenheiros.reduce((s, p) => s + p.rascunhos, 0)} rascunhos</>}>
      <div className="shrink-0">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDistribuicaoAberta(true)}>Distribuição por engenheiro</Button>
      </div>
      <Interpretar>
        <p>Autores e responsáveis do recorte, complementados pela lista de acompanhamento definida pela gestão. Exclusões dessa lista não retiram históricos dos indicadores nem alteram a fila de validação. Sem envio não comprova falta: não há escala por OGS/dia. Status, OGS, engenheiro, equipe e busca acima aplicam-se aos lançamentos técnicos. A fila de validação tem filtros próprios na seção Validações.</p>
      </Interpretar>
      <TabelaPaginada className="lg:flex-1" itens={lancamentosEngenheiros} getKey={p => p.id} resetKey={`prc|${chaveTecnica}`}
        vazio="Nenhum engenheiro identificado." rotulo="engenheiros" minWidth={560}
        colunas={[
          { titulo: "Engenheiro", className: "font-semibold", render: p => (
            <div className="flex flex-wrap items-center gap-2">
              <span>{p.nome}</span>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs font-normal" aria-label={`Ver registros de ${p.nome}`} onClick={() => setDialogoEng({ tipo: "registros", id: p.id })}>Ver registros</Button>
            </div>
          ) },
          { titulo: "Enviados", className: "font-semibold", render: p => p.enviados },
          { titulo: "Rascunhos", render: p => p.rascunhos },
          { titulo: "Último RDO Técnico", render: p => p.registros.length ? fmtDate(p.registros[0].data) : "—" },
        ]} />
    </SecaoShell>
  );

  const renderValidacoes = () => (
    <SecaoShell titulo="Validações pendentes dos RDOs dos apontadores">
      <div className="shrink-0 grid grid-cols-1 gap-2 md:grid-cols-4">
        <label className="text-xs font-semibold text-muted-foreground">Recorte da fila
          <select aria-label="Recorte da fila" value={periodoFila} onChange={e => setPeriodoFila(e.target.value)} className="mt-0.5 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground">
            <option value="acumulado">Acumulada desde 17/07/2026</option><option value="periodo">Somente o período selecionado</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Obra da fila
          <select aria-label="Obra da fila" value={obraFila} onChange={e => setObraFila(e.target.value)} className="mt-0.5 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground">
            <option value="">Todas as obras</option>{obrasFila.map(obra => <option key={obra} value={obra!}>{obra}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Responsável pela validação
          <select aria-label="Responsável pela validação" value={engenheiroFila} onChange={e => setEngenheiroFila(e.target.value)} className="mt-0.5 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground">
            <option value="">Todos os responsáveis</option><option value="__sem_identificacao">Sem identificação por ID</option>
            {engenheiroOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Busca na fila
          <input aria-label="Busca na fila" value={buscaFila} onChange={e => setBuscaFila(e.target.value)} placeholder="Obra ou responsável" className="mt-0.5 h-9 w-full rounded-lg border px-2 text-sm text-foreground" />
        </label>
      </div>
      <p className="shrink-0 text-sm text-muted-foreground" data-testid="total-fila-validacao">{filaFiltrada.length} pendentes no total · {validacoesPendentes.reduce((s, p) => s + p.pendentes.length, 0)} vinculados · {monitoramento.unassigned.length} sem identificação por ID. {dataFim < ENGINEERING_VALIDATION_START ? "Não há fila de validação antes do marco de 17/07/2026." : `RDOs de ${fmtDate(inicioFila)} até ${fmtDate(dataFim)}.`}</p>
      <Interpretar>
        <p>Somente RDOs visíveis ao seu acesso; "mais antigo" indica a data do RDO, não a data do envio para validação. Esta tabela não avalia validações já concluídas.</p>
        {monitoramento.unassigned.length > 0 && <p>{monitoramento.unassigned.length} pendentes sem engenheiro identificado por perfil de usuário — conferir vínculo antes de cobrar alguém.</p>}
      </Interpretar>
      <TabelaPaginada className="lg:flex-1" itens={validacoesPendentes} getKey={p => p.id} resetKey={`val|${chaveFila}`}
        vazio="Nenhum RDO pendente vinculado nos filtros atuais." rotulo="responsáveis" minWidth={560}
        colunas={[
          { titulo: "Engenheiro responsável", className: "font-semibold", render: p => (
            <div className="flex flex-wrap items-center gap-2">
              <span>{p.nome}</span>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs font-normal" aria-label={`Ver pendências de ${p.nome}`} onClick={() => setDialogoEng({ tipo: "pendentes", id: p.id })}>Ver pendências</Button>
            </div>
          ) },
          { titulo: "Aguardando validação", className: "font-bold text-orange-700", render: p => p.pendentes.length },
          { titulo: "Data do RDO mais antigo", render: p => fmtDate(p.pendentes[p.pendentes.length - 1].data) },
        ]} />
      {(pendenciasSemVinculo.encarregado.length > 0 || pendenciasSemVinculo.engenharia.length > 0) && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          <p className="font-semibold">Conferência de vínculos pendentes — não atribuir por semelhança de nome</p>
          <p>Encarregado: {pendenciasSemVinculo.encarregado.length} sem ID · Engenharia: {pendenciasSemVinculo.engenharia.length} sem ID. RDOs pendentes de {fmtDate(inicioFila)} até {fmtDate(dataFim)}.</p>
          <Button type="button" variant="outline" size="sm" className="h-7 bg-white px-2 text-xs" onClick={() => setDialogoVinculo("encarregado")}>Ver RDOs sem encarregado vinculado</Button>
          <Button type="button" variant="outline" size="sm" className="h-7 bg-white px-2 text-xs" onClick={() => setDialogoVinculo("engenharia")}>Ver RDOs sem engenheiro vinculado</Button>
        </div>
      )}
    </SecaoShell>
  );

  const renderAlertas = () => (
    <SecaoShell titulo="Alertas operacionais dos RDOs Técnicos" subtitulo={`${alertasOperacionais.length} alertas nos filtros atuais`}>
      <Interpretar>
        <p>Somente RDOs Técnicos enviados; rascunhos não geram alertas. São sinais registrados, não a fila de aprovação dos apontadores nem comprovação de uma ação ainda em aberto. Folga/feriado, por si só, não gera alerta.</p>
      </Interpretar>
      <TabelaPaginada className="lg:flex-1" itens={alertasOperacionais} colunas={colunasAlertas} getKey={p => p.id} resetKey={`alt|${chaveTecnica}`}
        vazio="Nenhum alerta operacional encontrado nos filtros atuais." rotulo="alertas" minWidth={980} />
    </SecaoShell>
  );

  const renderSecao = () => {
    if (secao === "geral") return renderGeral();
    if (secao === "preenchimento") return renderPreenchimento();
    if (secao === "validacoes") return renderValidacoes();
    if (secao === "alertas") return renderAlertas();
    if (secao === "apoio") return renderApoio();
    return renderAssunto(secao);
  };

  const engDialogo = dialogoEng
    ? (dialogoEng.tipo === "registros" ? lancamentosEngenheiros.find(p => p.id === dialogoEng.id) : validacoesPendentes.find(p => p.id === dialogoEng.id))
    : undefined;
  const listaVinculo = dialogoVinculo ? pendenciasSemVinculo[dialogoVinculo] : [];

  return (
    <div data-testid="dashboard-shell" className="flex min-h-screen flex-col bg-[hsl(210_20%_98%)] lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 bg-header-gradient px-4 py-2 shadow-lg">
        <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-2 text-primary-foreground hover:bg-white/15">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <span className="block font-display text-sm font-extrabold text-primary-foreground">Dashboard RDO Técnico</span>
          <span className="sr-only">CSV exporta todos os RDOs dos filtros gerais, independentemente da aba de assunto.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportarCsvExecutivo} disabled={loading || !!erroCarga || linhasFiltradas.length === 0} variant="outline" className="h-9 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20">
            <Download className="mr-1 h-4 w-4" /> Resumo Exec.
          </Button>
          <Button onClick={exportarCsv} title="CSV exporta todos os RDOs dos filtros gerais, independentemente da aba de assunto." disabled={loading || !!erroCarga || linhasFiltradas.length === 0} className="h-9 rounded-xl bg-white text-primary hover:bg-white/90">
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
        </div>
      </header>

      <div className="shrink-0 space-y-2 border-b bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">De
            <input type="date" aria-label="De" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9 rounded-lg border px-2 text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">Até
            <input type="date" aria-label="Até" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 rounded-lg border px-2 text-sm text-foreground" />
          </label>
          <select aria-label="OGS" value={filtroOgs} onChange={(e) => setFiltroOgs(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-sm">
            <option value="">Todas as OGS</option>
            {ogsOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input aria-label="Busca rápida" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar OGS, equipe, tipo, motivo..." className="h-9 min-w-[140px] flex-1 rounded-lg border px-3 text-sm" />
          <Button variant="outline" onClick={buscarDados} aria-label="Atualizar relatório" title="Atualizar relatório" className="h-9 rounded-lg px-3">
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" aria-expanded={maisFiltros} onClick={() => setMaisFiltros(v => !v)} className="h-9 rounded-lg">
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Mais filtros{maisFiltrosAtivos > 0 ? ` (${maisFiltrosAtivos})` : ""}
            <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${maisFiltros ? "rotate-180" : ""}`} />
          </Button>
        </div>
        {maisFiltros && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">Status
              <select aria-label="Status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-sm text-foreground">
                <option value="">Todos</option>
                <option value="enviado">Enviado</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">Engenheiro
              <select aria-label="Engenheiro" value={filtroEng} onChange={(e) => setFiltroEng(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-sm text-foreground">
                <option value="">Todos</option>
                {engenheiroOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">Equipe / Setor
              <select aria-label="Equipe / Setor" value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} className="h-9 rounded-lg border bg-white px-2 text-sm text-foreground">
                <option value="">Todas</option>
                {equipesFiltro.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <div data-testid="faixa-kpis" className="grid shrink-0 grid-cols-3 gap-1.5 px-3 py-1.5 lg:grid-cols-6 lg:gap-2 lg:py-2">
        <KpiCard icon={ClipboardList} titulo="Total de RDOs" subtitulo={pronto ? <><span className="block">{fmtNum(kpis.enviados)} enviados</span><span className="block">{fmtNum(kpis.rascunhos)} rascunhos</span></> : "—"} valor={pronto ? fmtNum(kpis.total) : "—"} cor="text-slate-700"delta={pronto ? comparativo.total.delta : undefined} deltaPct={pronto ? comparativo.total.perc : undefined} />
        <KpiCard icon={BarChart3} titulo="RDOs com produção" valor={pronto ? fmtNum(kpis.comProducao) : "—"} cor="text-blue-700" delta={pronto ? comparativo.comProducao.delta : undefined} deltaPct={pronto ? comparativo.comProducao.perc : undefined} />
        <KpiCard icon={AlertTriangle} titulo="RDOs sem produção" valor={pronto ? fmtNum(kpis.semProducao) : "—"} cor="text-red-700" delta={pronto ? comparativo.semProducao.delta : undefined} deltaPct={pronto ? comparativo.semProducao.perc : undefined} invert />
        <KpiCard icon={Gauge} titulo="Problemas em equipamentos" subtitulo={pronto ? "Contagem de RDOs" : "—"} valor={pronto ? fmtNum(kpis.naoConformeEquip) : "—"} cor="text-orange-700" delta={pronto ? comparativo.naoConforme.delta : undefined} deltaPct={pronto ? comparativo.naoConforme.perc : undefined} invert />
        <KpiCard icon={Users} titulo="Produção em toneladas" valor={pronto ? fmtNum(kpis.toneladas, 1) : "—"} cor="text-emerald-700" delta={pronto ? comparativo.toneladas.delta : undefined} deltaPct={pronto ? comparativo.toneladas.perc : undefined} />
        <KpiCard icon={Activity} titulo="Área produzida (m²)" valor={pronto ? fmtNum(kpis.areaM2, 1) : "—"} cor="text-indigo-700" delta={pronto ? comparativo.areaM2.delta : undefined} deltaPct={pronto ? comparativo.areaM2.perc : undefined} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 lg:flex-row">
        <label className="shrink-0 text-xs font-semibold text-muted-foreground lg:hidden">Seção
          <select aria-label="Seção do Dashboard" value={secao} onChange={(e) => irSecao(e.target.value as Secao)} className="mt-0.5 h-10 w-full rounded-lg border bg-white px-2 text-sm font-semibold text-foreground">
            {SECOES_META.map(({ id, label }) => <option key={id} value={id}>{`${label} (${contadores[id]})`}</option>)}
          </select>
        </label>
        <nav aria-label="Seções do Dashboard" className="hidden shrink-0 gap-1.5 rounded-xl border bg-white p-2 lg:flex lg:w-56 lg:flex-col lg:flex-nowrap lg:overflow-y-auto">
          {SECOES_META.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => irSecao(id)}
              aria-current={secao === id ? "page" : undefined}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors lg:w-full ${secao === id ? "border-primary bg-primary text-white" : "border-transparent bg-white hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              <span className={`ml-auto rounded-full px-2 text-xs ${secao === id ? "bg-white/25" : "bg-muted text-muted-foreground"}`}>{contadores[id]}</span>
            </button>
          ))}
        </nav>

        <main ref={painelRef} data-testid="painel-secao" className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border bg-white p-3">
          {carregando ? (
            <div className="p-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Carregando dados do RDO Técnico...</p>
            </div>
          ) : erroCarga ? (
            <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">{erroCarga}</div>
          ) : renderSecao()}
        </main>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(aberto) => { if (!aberto) setDetalhe(null); }}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes do RDO Técnico</DialogTitle>
                <DialogDescription>{fmtDate(detalhe.rdo.data)} · OGS {detalhe.rdo.ogs_number || "-"} · somente leitura</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-sm">
                {camposDetalhe(detalhe.rdo, detalhe.assunto, engMap, detalhe.alerta).map(c => (
                  <Fragment key={c.label}>
                    <dt className="text-xs font-semibold text-muted-foreground">{c.label}</dt>
                    <dd data-testid={c.testId} className={`whitespace-pre-wrap break-words ${c.aviso ? "font-semibold text-amber-700" : ""}`}>{c.value}</dd>
                  </Fragment>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!engDialogo} onOpenChange={(aberto) => { if (!aberto) setDialogoEng(null); }}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-hidden">
          {engDialogo && dialogoEng?.tipo === "registros" && (
            <>
              <DialogHeader>
                <DialogTitle>RDOs Técnicos — {(engDialogo as { nome: string }).nome}</DialogTitle>
                <DialogDescription>Registros do engenheiro nos filtros técnicos atuais, somente leitura.</DialogDescription>
              </DialogHeader>
              <TabelaPaginada className="max-h-[50dvh]" tamanho={10} itens={(engDialogo as (typeof lancamentosEngenheiros)[number]).registros} getKey={r => r.id}
                resetKey={`reg|${dialogoEng.id}|${chaveTecnica}`} vazio="Nenhum RDO Técnico nos filtros." rotulo="registros" minWidth={420}
                colunas={[
                  { titulo: "Data", render: r => fmtDate(r.data) },
                  { titulo: "OGS", render: r => r.ogs_number || "—" },
                  { titulo: "Status", render: r => (r.status === "enviado" ? "Enviado" : "Rascunho") },
                  { titulo: "ID do RDO", className: "break-all text-xs", render: r => r.id },
                ]} />
            </>
          )}
          {engDialogo && dialogoEng?.tipo === "pendentes" && (
            <>
              <DialogHeader>
                <DialogTitle>Pendências de validação — {(engDialogo as { nome: string }).nome}</DialogTitle>
                <DialogDescription>RDOs dos apontadores aguardando validação, no recorte da fila ({rotuloFila}). Somente leitura.</DialogDescription>
              </DialogHeader>
              <TabelaPaginada className="max-h-[50dvh]" tamanho={10} itens={(engDialogo as (typeof validacoesPendentes)[number]).pendentes} getKey={r => r.id}
                resetKey={`pen|${dialogoEng.id}|${chaveFila}`} vazio="Nenhum RDO pendente." rotulo="pendências" minWidth={420}
                colunas={[
                  { titulo: "Data", render: r => fmtDate(r.data) },
                  { titulo: "Obra", render: r => r.obra_nome || "Obra não identificada" },
                  { titulo: "ID do RDO", className: "break-all text-xs", render: r => r.id },
                ]} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={distribuicaoAberta} onOpenChange={setDistribuicaoAberta}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Top engenheiros por RDOs enviados</DialogTitle>
            <DialogDescription>RDOs Técnicos enviados nos filtros técnicos atuais (rascunhos não entram). Somente leitura.</DialogDescription>
          </DialogHeader>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieEngenheiro} layout="vertical" margin={{ left: 10, right: 10, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol data-testid="distribuicao-engenheiros" className="space-y-0.5 text-sm">
            {serieEngenheiro.map(s => <li key={s.name} className="flex justify-between gap-3"><span>{s.name}</span><strong>{s.value}</strong></li>)}
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialogoVinculo}onOpenChange={(aberto) => { if (!aberto) setDialogoVinculo(null); }}>
        <DialogContent className="max-h-[85dvh] max-w-3xl overflow-hidden">
          {dialogoVinculo && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogoVinculo === "encarregado" ? "RDOs sem encarregado vinculado" : "RDOs sem engenheiro vinculado"}</DialogTitle>
                <DialogDescription>{listaVinculo.length} RDOs pendentes de {fmtDate(inicioFila)} até {fmtDate(dataFim)}. Não atribuir por semelhança de nome; somente leitura.</DialogDescription>
              </DialogHeader>
              <TabelaPaginada className="max-h-[50dvh]" tamanho={10} itens={listaVinculo} getKey={r => r.id}
                resetKey={`vin|${dialogoVinculo}|${chaveFila}`} vazio="Nenhum RDO nesta conferência." rotulo="RDOs" minWidth={560}
                colunas={[
                  { titulo: "Data", render: r => fmtDate(r.data) },
                  { titulo: "OGS", render: r => r.obra_nome || "—" },
                  dialogoVinculo === "encarregado"
                    ? { titulo: "Encarregado", render: r => r.encarregado || "Sem encarregado informado" }
                    : { titulo: "Engenheiro", render: r => r.engenheiro_responsavel || "Sem engenheiro informado" },
                  { titulo: "ID do RDO", className: "break-all text-xs", render: r => `ID ${r.id}` },
                ]} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Nível de módulo: definido dentro do componente remontaria a seção (e zeraria a paginação) a cada render.
function SecaoShell({ titulo, subtitulo, children }: { titulo: string; subtitulo?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col gap-2 lg:h-full">
      <div className="shrink-0">
        <h2 className="text-base font-bold leading-tight">{titulo}</h2>
        {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  titulo,
  subtitulo,
  valor,
  cor,
  delta,
  deltaPct,
  invert,
}: {
  icon: any;
  titulo: string;
  subtitulo?: ReactNode;
  valor: string;
  cor: string;
  delta?: number;
  deltaPct?: number | null;
  invert?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-white px-2 py-1.5 lg:px-3 lg:py-2">
      <div className="flex items-center justify-between gap-1">
        <span className="line-clamp-2 text-xs font-bold leading-tight text-muted-foreground" title={titulo}>{titulo}</span>
        <Icon className={`hidden h-4 w-4 shrink-0 sm:block ${cor}`} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <p className="text-xl font-black leading-tight text-foreground">{valor}</p>
        {delta != null && deltaPct !== undefined ? <span className="hidden sm:inline-flex"><DeltaPill delta={delta} perc={deltaPct} invert={invert} /></span> : null}
      </div>
      {subtitulo != null ? <p className="whitespace-normal text-xs leading-tight text-muted-foreground">{subtitulo}</p> : null}
    </div>
  );
}

function DeltaPill({ delta, perc, invert }: { delta: number; perc: number | null; invert?: boolean }) {
  const isUp = delta > 0;
  const isNeutral = delta === 0;
  const shouldBeGood = invert ? !isUp : isUp;

  const cls = isNeutral
    ? "bg-slate-100 text-slate-600"
    : shouldBeGood
      ? "bg-emerald-100 text-emerald-700"
      : "bg-rose-100 text-rose-700";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {isNeutral ? <Minus className="w-3 h-3" /> : isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? "+" : ""}{fmtNum(delta, 1)} ({perc === null ? "Sem base percentual" : `${perc > 0 ? "+" : ""}${fmtNum(perc, 1)}%`})
    </span>
  );
}
