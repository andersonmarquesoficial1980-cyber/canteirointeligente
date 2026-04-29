import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { NovaDemandaPayload } from "@/hooks/useDemandas";
import { EQUIPMENT_TYPES, TRANSPORTE_HORARIOS, URGENCIAS_FASE1, type TipoDemanda, type UrgenciaDemanda } from "@/lib/demandas";
import { useToast } from "@/hooks/use-toast";

type NovoTipo = "manutencao" | "transporte" | "rh" | "material" | "tarefa";
type SetorOrigemBase = "Obra" | "Engenharia";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (demanda: NovaDemandaPayload) => Promise<boolean>;
  onCreateMany: (demandas: NovaDemandaPayload[]) => Promise<boolean>;
}

interface Maquina {
  id: string;
  frota: string;
  tipo: string | null;
  status: string;
  nome: string;
}

interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
}

interface ManutencaoItem {
  tipoEquipamento: string;
  maquinaId: string;
  problema: string;
  fotoUrl?: string;
}

interface MaterialItem {
  item: string;
  quantidade: string;
  unidade: "un" | "cx" | "kg" | "L" | "m" | "par";
}

const DEFAULT_URGENCIA: UrgenciaDemanda = "normal";
const RH_TIPOS = [
  { id: "demissao", label: "Demissão" },
  { id: "admissao", label: "Admissão" },
  { id: "reajuste", label: "Classificação/Reajuste" },
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeStatus(status?: string | null) {
  const s = (status || "").trim().toLowerCase();
  return s;
}

function isMaquinaAtiva(status?: string | null) {
  const s = normalizeStatus(status);
  return s === "ativo" || s === "operando";
}

function blankManutencaoItem(): ManutencaoItem {
  return {
    tipoEquipamento: "",
    maquinaId: "",
    problema: "",
  };
}

function blankMaterialItem(): MaterialItem {
  return {
    item: "",
    quantidade: "",
    unidade: "un",
  };
}

export default function NovaDemandaModal({ open, onClose, onCreate, onCreateMany }: Props) {
  const { toast } = useToast();
  const [loadingBase, setLoadingBase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<NovoTipo | null>(null);

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [userNome, setUserNome] = useState("Usuário");
  const [userPerfil, setUserPerfil] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [urgencia, setUrgencia] = useState<UrgenciaDemanda>(DEFAULT_URGENCIA);

  const [setorOrigem, setSetorOrigem] = useState("");
  const [setorOrigemTransporte, setSetorOrigemTransporte] = useState("");
  const [setorOrigemMaterial, setSetorOrigemMaterial] = useState("");

  const [manutencaoItens, setManutencaoItens] = useState<ManutencaoItem[]>([blankManutencaoItem()]);

  const [transporteEquipamentos, setTransporteEquipamentos] = useState<string[]>([]);
  const [origem, setOrigem] = useState("");
  const [origemMaps, setOrigemMaps] = useState("");
  const [destino, setDestino] = useState("");
  const [destinoMaps, setDestinoMaps] = useState("");
  const [horarioTransporte, setHorarioTransporte] = useState(TRANSPORTE_HORARIOS[0]);
  const [horarioLivre, setHorarioLivre] = useState("");
  const [obsTransporte, setObsTransporte] = useState("");

  const [rhTipo, setRhTipo] = useState<(typeof RH_TIPOS)[number]["id"] | "">("");
  const [rhFuncionarioId, setRhFuncionarioId] = useState("");
  const [rhFuncaoDesejada, setRhFuncaoDesejada] = useState("");
  const [rhJustificativa, setRhJustificativa] = useState("");
  const [rhMotivoDemissao, setRhMotivoDemissao] = useState("");
  const [rhReajusteTipo, setRhReajusteTipo] = useState("");

  const [materialDestino, setMaterialDestino] = useState<"suprimentos" | "programador">("suprimentos");
  const [materialItens, setMaterialItens] = useState<MaterialItem[]>([blankMaterialItem()]);
  const [materialFuncionarioId, setMaterialFuncionarioId] = useState("");
  const [materialObs, setMaterialObs] = useState("");

  const [tarefaFuncionarioId, setTarefaFuncionarioId] = useState("");
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaDescricao, setTarefaDescricao] = useState("");
  const [tarefaData, setTarefaData] = useState("");
  const [tarefaHorario, setTarefaHorario] = useState(TRANSPORTE_HORARIOS[0]);
  const [tarefaHorarioLivre, setTarefaHorarioLivre] = useState("");

  const canCreateTarefa = useMemo(() => {
    const p = (userPerfil || "").toLowerCase();
    return p.includes("programador") || p.includes("administrador");
  }, [userPerfil]);

  const funcoesRh = useMemo(() => {
    return [...new Set(funcionarios.map((f) => f.funcao).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [funcionarios]);

  const funcionariosEquipe = useMemo(() => {
    return funcionarios.filter((f) => {
      const funcao = (f.funcao || "").toLowerCase();
      return funcao.includes("motorista") || funcao.includes("operador") || funcao.includes("ajudante");
    });
  }, [funcionarios]);

  const maquinasAtivas = useMemo(() => maquinas.filter((m) => isMaquinaAtiva(m.status)), [maquinas]);

  const maquinasAgrupadasPorTipo = useMemo(() => {
    const agrupado: Record<string, Maquina[]> = {};
    maquinasAtivas.forEach((m) => {
      const tipo = m.tipo || "Sem tipo";
      if (!agrupado[tipo]) agrupado[tipo] = [];
      agrupado[tipo].push(m);
    });

    Object.keys(agrupado).forEach((tipo) => {
      agrupado[tipo] = agrupado[tipo].sort((a, b) => a.frota.localeCompare(b.frota, "pt-BR"));
    });

    return agrupado;
  }, [maquinasAtivas]);

  useEffect(() => {
    if (!open) return;

    const loadBase = async () => {
      setLoadingBase(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id);

      const [profileRes, maquinasRes, funcionariosRes] = await Promise.all([
        user?.id
          ? supabase.from("profiles").select("nome_completo, perfil, company_id").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        (supabase as any).from("maquinas_frota").select("id, frota, tipo, status, nome").order("tipo").order("frota"),
        (supabase as any).from("funcionarios").select("id, nome, funcao").order("nome"),
      ]);

      if (profileRes?.data) {
        setUserNome((profileRes.data as any).nome_completo || user?.email || "Usuário");
        setUserPerfil((profileRes.data as any).perfil || "");
        setCompanyId((profileRes.data as any).company_id || null);
        if (!solicitanteNome) setSolicitanteNome((profileRes.data as any).nome_completo || "");
      } else if (user?.email) {
        setUserNome(user.email);
        if (!solicitanteNome) setSolicitanteNome(user.email.split("@")[0]);
      }

      if (!maquinasRes.error && maquinasRes.data) setMaquinas(maquinasRes.data as Maquina[]);
      if (!funcionariosRes.error && funcionariosRes.data) setFuncionarios(funcionariosRes.data as Funcionario[]);

      if (maquinasRes.error) {
        toast({ title: "Erro ao carregar equipamentos", description: maquinasRes.error.message, variant: "destructive" });
      }

      if (funcionariosRes.error) {
        toast({ title: "Erro ao carregar funcionários", description: funcionariosRes.error.message, variant: "destructive" });
      }

      setLoadingBase(false);
    };

    loadBase();
  }, [open]);

  useEffect(() => {
    if (open) return;
    setTipoSelecionado(null);
    setUrgencia(DEFAULT_URGENCIA);
    setSetorOrigem("");
    setSetorOrigemTransporte("");
    setSetorOrigemMaterial("");

    setManutencaoItens([blankManutencaoItem()]);
    setTransporteEquipamentos([]);
    setOrigem("");
    setOrigemMaps("");
    setDestino("");
    setDestinoMaps("");
    setHorarioTransporte(TRANSPORTE_HORARIOS[0]);
    setHorarioLivre("");
    setObsTransporte("");

    setRhTipo("");
    setRhFuncionarioId("");
    setRhFuncaoDesejada("");
    setRhJustificativa("");
    setRhMotivoDemissao("");
    setRhReajusteTipo("");

    setMaterialDestino("suprimentos");
    setMaterialItens([blankMaterialItem()]);
    setMaterialFuncionarioId("");
    setMaterialObs("");

    setTarefaFuncionarioId("");
    setTarefaTitulo("");
    setTarefaDescricao("");
    setTarefaData("");
    setTarefaHorario(TRANSPORTE_HORARIOS[0]);
    setTarefaHorarioLivre("");
  }, [open]);

  const getFuncionarioById = (id: string) => funcionarios.find((f) => f.id === id);
  const getMaquinaById = (id: string) => maquinas.find((m) => m.id === id);

  const setManutencaoItem = (idx: number, patch: Partial<ManutencaoItem>) => {
    setManutencaoItens((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const addManutencaoItem = () => {
    setManutencaoItens((prev) => {
      if (prev.length >= 6) return prev;
      return [...prev, blankManutencaoItem()];
    });
  };

  const removeManutencaoItem = (idx: number) => {
    setManutencaoItens((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const setMaterialItem = (idx: number, patch: Partial<MaterialItem>) => {
    setMaterialItens((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const addMaterialItem = () => {
    setMaterialItens((prev) => [...prev, blankMaterialItem()]);
  };

  const removeMaterialItem = (idx: number) => {
    setMaterialItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const toggleEquipamentoTransporte = (maquinaId: string) => {
    setTransporteEquipamentos((prev) => {
      if (prev.includes(maquinaId)) return prev.filter((id) => id !== maquinaId);
      return [...prev, maquinaId];
    });
  };

  const submitManutencao = async () => {
    if (!solicitanteNome.trim()) {
      toast({ title: "Informe o solicitante" });
      return;
    }

    if (!setorOrigem) {
      toast({ title: "Selecione o setor de origem" });
      return;
    }

    if (manutencaoItens.length === 0) {
      toast({ title: "Adicione pelo menos um equipamento" });
      return;
    }

    for (const item of manutencaoItens) {
      if (!item.tipoEquipamento || !item.maquinaId || !item.problema.trim()) {
        toast({ title: "Preencha tipo, frota e problema em todos os equipamentos" });
        return;
      }
    }

    const payloads = manutencaoItens.map((item) => {
      const maquina = getMaquinaById(item.maquinaId);
      const equipamentoLabel = maquina ? `${maquina.frota} - ${maquina.nome}` : item.maquinaId;
      const titulo = `Manutenção - ${item.tipoEquipamento} ${maquina?.frota || ""}`.trim();

      return {
        titulo,
        descricao: item.problema.trim(),
        solicitante_nome: solicitanteNome.trim(),
        solicitante_departamento: setorOrigem,
        setor_origem: setorOrigem,
        equipamento: equipamentoLabel,
        centro_de_custo: "Demandas Internas",
        status: "pendente",
        tipo: "manutencao",
        destinatario_setor: "manutencao",
        urgencia,
        created_by: userId,
        company_id: companyId || undefined,
        foto_url: item.fotoUrl || undefined,
        equipamentos_ids: [item.maquinaId],
        equipamentos_json: maquina ? [maquina] : [],
      } satisfies NovaDemandaPayload;
    });

    setSaving(true);
    const ok = await onCreateMany(payloads);
    setSaving(false);
    if (ok) onClose();
  };

  const submitTransporte = async () => {
    if (!solicitanteNome.trim()) {
      toast({ title: "Informe o solicitante" });
      return;
    }

    if (!setorOrigemTransporte) {
      toast({ title: "Selecione o setor de origem" });
      return;
    }

    if (transporteEquipamentos.length === 0) {
      toast({ title: "Selecione ao menos um equipamento" });
      return;
    }

    if (!origem.trim() || !destino.trim()) {
      toast({ title: "Origem e destino são obrigatórios" });
      return;
    }

    const equipamentosSelecionados = transporteEquipamentos
      .map((id) => getMaquinaById(id))
      .filter(Boolean) as Maquina[];

    const horarioFinal = horarioTransporte === "Horário específico..." ? horarioLivre.trim() : horarioTransporte;

    if (!horarioFinal) {
      toast({ title: "Informe o horário do transporte" });
      return;
    }

    const equipamentosTexto = equipamentosSelecionados.map((m) => `${m.frota} (${m.tipo || "-"})`).join(", ");
    const descricaoLegada = [
      "Viagem",
      `Origem: ${origem.trim()}`,
      origemMaps.trim() ? `Maps: ${origemMaps.trim()}` : "",
      `Destino: ${destino.trim()}`,
      destinoMaps.trim() ? `Maps: ${destinoMaps.trim()}` : "",
      `Equipamentos: ${equipamentosTexto}`,
      `Horário: ${horarioFinal}`,
      obsTransporte.trim() ? `Observações: ${obsTransporte.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload: NovaDemandaPayload = {
      titulo: `Transporte de ${equipamentosSelecionados.length} equipamento(s)`,
      descricao: descricaoLegada,
      solicitante_nome: solicitanteNome.trim(),
      solicitante_departamento: setorOrigemTransporte,
      setor_origem: setorOrigemTransporte,
      centro_de_custo: "Demandas Internas",
      status: "pendente",
      tipo: "transporte",
      destinatario_setor: "programador",
      urgencia,
      created_by: userId,
      company_id: companyId || undefined,
      equipamentos_ids: equipamentosSelecionados.map((m) => m.id),
      equipamentos_json: equipamentosSelecionados,
      origem: origem.trim(),
      origem_maps: origemMaps.trim() || undefined,
      destino: destino.trim(),
      destino_maps: destinoMaps.trim() || undefined,
      horario_transporte: horarioFinal,
      observacoes: obsTransporte.trim() || undefined,
      sub_tipo: /OGS/i.test(origem + destino) ? "viagem_ogs" : "viagem",
    };

    setSaving(true);
    const ok = await onCreate(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const submitRh = async () => {
    if (!solicitanteNome.trim()) {
      toast({ title: "Informe o solicitante" });
      return;
    }

    if (!setorOrigem) {
      toast({ title: "Selecione o setor de origem" });
      return;
    }

    if (!rhTipo) {
      toast({ title: "Selecione o sub-tipo RH" });
      return;
    }

    const base: NovaDemandaPayload = {
      titulo: "Solicitação RH",
      descricao: "",
      solicitante_nome: solicitanteNome.trim(),
      solicitante_departamento: setorOrigem,
      setor_origem: setorOrigem,
      centro_de_custo: "Demandas Internas",
      status: "pendente",
      tipo: "rh",
      destinatario_setor: "programador",
      urgencia,
      created_by: userId,
      company_id: companyId || undefined,
      sub_tipo: rhTipo,
    };

    if (rhTipo === "demissao") {
      const funcionario = getFuncionarioById(rhFuncionarioId);
      if (!funcionario || !rhMotivoDemissao.trim()) {
        toast({ title: "Selecione o funcionário e informe o motivo da demissão" });
        return;
      }
      base.titulo = `RH - Demissão - ${funcionario.nome}`;
      base.funcionario_id = funcionario.id;
      base.funcionario_nome = funcionario.nome;
      base.descricao = rhMotivoDemissao.trim();
    }

    if (rhTipo === "admissao") {
      if (!rhFuncaoDesejada.trim() || !rhJustificativa.trim()) {
        toast({ title: "Preencha função desejada e justificativa" });
        return;
      }
      base.titulo = `RH - Admissão - ${rhFuncaoDesejada.trim()}`;
      base.funcao_solicitada = rhFuncaoDesejada.trim();
      base.descricao = rhJustificativa.trim();
    }

    if (rhTipo === "reajuste") {
      const funcionario = getFuncionarioById(rhFuncionarioId);
      if (!funcionario || !rhReajusteTipo || !rhJustificativa.trim()) {
        toast({ title: "Preencha funcionário, tipo e justificativa" });
        return;
      }
      base.titulo = `RH - ${rhReajusteTipo.includes("Reajuste") ? "Reajuste" : "Classificação"} - ${funcionario.nome}`;
      base.funcionario_id = funcionario.id;
      base.funcionario_nome = funcionario.nome;
      base.sub_tipo = rhReajusteTipo.includes("Reajuste") ? "reajuste" : "classificacao";
      base.descricao = rhJustificativa.trim();
      base.observacoes = rhReajusteTipo;
    }

    setSaving(true);
    const ok = await onCreate(base);
    setSaving(false);
    if (ok) onClose();
  };

  const submitMaterial = async () => {
    if (!solicitanteNome.trim()) {
      toast({ title: "Informe o solicitante" });
      return;
    }

    if (!setorOrigemMaterial) {
      toast({ title: "Selecione o setor de origem" });
      return;
    }

    const itensValidos = materialItens.filter((item) => item.item.trim() && Number(item.quantidade) > 0);
    if (itensValidos.length === 0) {
      toast({ title: "Informe ao menos um item com quantidade" });
      return;
    }

    const funcionarioDestino = materialFuncionarioId ? getFuncionarioById(materialFuncionarioId) : undefined;

    const payload: NovaDemandaPayload = {
      titulo: `Material / Acessório (${itensValidos.length} item(ns))`,
      descricao: itensValidos.map((i) => `${i.item} - ${i.quantidade} ${i.unidade}`).join("\n"),
      solicitante_nome: solicitanteNome.trim(),
      solicitante_departamento: setorOrigemMaterial,
      setor_origem: setorOrigemMaterial,
      centro_de_custo: "Demandas Internas",
      status: "pendente",
      tipo: "material",
      destinatario_setor: materialDestino,
      urgencia,
      created_by: userId,
      company_id: companyId || undefined,
      itens_material: itensValidos,
      observacoes: materialObs.trim() || undefined,
      funcionario_solicitado_id: funcionarioDestino?.id,
      funcionario_solicitado_nome: funcionarioDestino?.nome,
    };

    setSaving(true);
    const ok = await onCreate(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const submitTarefa = async () => {
    if (!canCreateTarefa) {
      toast({ title: "Apenas Programador/Administrador pode criar tarefa" });
      return;
    }

    if (!tarefaFuncionarioId || !tarefaTitulo.trim()) {
      toast({ title: "Selecione o funcionário e informe o título da tarefa" });
      return;
    }

    const funcionario = getFuncionarioById(tarefaFuncionarioId);
    if (!funcionario) {
      toast({ title: "Funcionário inválido" });
      return;
    }

    const horarioFinal = tarefaHorario === "Horário específico..." ? tarefaHorarioLivre.trim() : tarefaHorario;

    const payload: NovaDemandaPayload = {
      titulo: tarefaTitulo.trim(),
      descricao: tarefaDescricao.trim() || undefined,
      solicitante_nome: solicitanteNome.trim() || userNome,
      solicitante_departamento: "Programação",
      setor_origem: "Programação",
      centro_de_custo: "Demandas Internas",
      status: "pendente",
      tipo: "tarefa",
      destinatario_setor: "equipe",
      urgencia,
      created_by: userId,
      company_id: companyId || undefined,
      funcionario_id: funcionario.id,
      funcionario_nome: funcionario.nome,
      data_prevista: tarefaData || undefined,
      horario_transporte: horarioFinal || undefined,
      sub_tipo: "tarefa_programador",
    };

    setSaving(true);
    const ok = await onCreate(payload);
    setSaving(false);
    if (ok) onClose();
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (tipoSelecionado === "manutencao") return submitManutencao();
    if (tipoSelecionado === "transporte") return submitTransporte();
    if (tipoSelecionado === "rh") return submitRh();
    if (tipoSelecionado === "material") return submitMaterial();
    if (tipoSelecionado === "tarefa") return submitTarefa();
  };

  const title = tipoSelecionado
    ? {
        manutencao: "Nova Demanda - Manutenção",
        transporte: "Nova Demanda - Transporte",
        rh: "Nova Demanda - RH",
        material: "Nova Demanda - Material",
        tarefa: "Nova Demanda - Tarefa",
      }[tipoSelecionado]
    : "Nova Demanda";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {tipoSelecionado && (
              <Button variant="ghost" size="icon" onClick={() => setTipoSelecionado(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingBase ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando dados...
            </div>
          ) : !tipoSelecionado ? (
            <div className="grid grid-cols-1 gap-3">
              <button type="button" onClick={() => setTipoSelecionado("manutencao")} className="rounded-2xl border p-4 text-left hover:border-primary">
                <p className="text-lg font-bold">🔧 Manutenção de Equipamento</p>
              </button>
              <button type="button" onClick={() => setTipoSelecionado("transporte")} className="rounded-2xl border p-4 text-left hover:border-primary">
                <p className="text-lg font-bold">🚛 Transporte de Equipamento</p>
              </button>
              <button type="button" onClick={() => setTipoSelecionado("rh")} className="rounded-2xl border p-4 text-left hover:border-primary">
                <p className="text-lg font-bold">👷 Solicitação RH</p>
              </button>
              <button type="button" onClick={() => setTipoSelecionado("material")} className="rounded-2xl border p-4 text-left hover:border-primary">
                <p className="text-lg font-bold">📦 Material / Acessório</p>
              </button>
              {canCreateTarefa && (
                <button type="button" onClick={() => setTipoSelecionado("tarefa")} className="rounded-2xl border p-4 text-left hover:border-primary">
                  <p className="text-lg font-bold">📋 Tarefa</p>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Solicitante nome *</Label>
                <Input value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} className="h-11" placeholder="Nome completo" />
              </div>

              <div className="space-y-2">
                <Label>Urgência *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {URGENCIAS_FASE1.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setUrgencia(u.value)}
                      className={`h-11 rounded-xl border font-semibold text-sm ${
                        urgencia === u.value ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipoSelecionado === "manutencao" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Setor origem *</Label>
                    <Select value={setorOrigem} onValueChange={setSetorOrigem}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Obra">Obra</SelectItem>
                        <SelectItem value="Engenharia">Engenharia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {manutencaoItens.map((item, idx) => {
                    const opcoesFrota = maquinasAtivas.filter((m) => (m.tipo || "") === item.tipoEquipamento);
                    return (
                      <div key={idx} className="rounded-2xl border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">Equipamento {idx + 1}</p>
                          {manutencaoItens.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeManutencaoItem(idx)}>Remover</Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Tipo de equipamento *</Label>
                          <Select
                            value={item.tipoEquipamento}
                            onValueChange={(v) => setManutencaoItem(idx, { tipoEquipamento: v, maquinaId: "" })}
                          >
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_TYPES.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Frota *</Label>
                          <Select value={item.maquinaId} onValueChange={(v) => setManutencaoItem(idx, { maquinaId: v })}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {opcoesFrota.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.frota} - {m.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Descreva o problema *</Label>
                          <Textarea
                            rows={3}
                            value={item.problema}
                            onChange={(e) => setManutencaoItem(idx, { problema: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Foto (opcional)</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const base64 = await fileToBase64(file);
                              setManutencaoItem(idx, { fotoUrl: base64 });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="outline" className="w-full h-11" onClick={addManutencaoItem} disabled={manutencaoItens.length >= 6}>
                    + Adicionar outro equipamento
                  </Button>
                </div>
              )}

              {tipoSelecionado === "transporte" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Setor origem *</Label>
                    <Select value={setorOrigemTransporte} onValueChange={setSetorOrigemTransporte}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Obra">Obra</SelectItem>
                        <SelectItem value="Engenharia">Engenharia</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Equipamentos (múltipla seleção) *</Label>
                    <div className="rounded-2xl border p-3 max-h-64 overflow-y-auto space-y-3">
                      {Object.keys(maquinasAgrupadasPorTipo).map((tipo) => (
                        <div key={tipo}>
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">{tipo}</p>
                          <div className="space-y-1">
                            {maquinasAgrupadasPorTipo[tipo].map((m) => (
                              <label key={m.id} className="flex items-center gap-2 text-sm py-1">
                                <input
                                  type="checkbox"
                                  checked={transporteEquipamentos.includes(m.id)}
                                  onChange={() => toggleEquipamentoTransporte(m.id)}
                                />
                                <span>{m.frota} - {m.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label>Origem *</Label>
                      <Input className="h-11" value={origem} onChange={(e) => setOrigem(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Link Maps origem</Label>
                      <Input className="h-11" value={origemMaps} onChange={(e) => setOrigemMaps(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Destino *</Label>
                      <Input className="h-11" value={destino} onChange={(e) => setDestino(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Link Maps destino</Label>
                      <Input className="h-11" value={destinoMaps} onChange={(e) => setDestinoMaps(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário *</Label>
                    <Select value={horarioTransporte} onValueChange={(v) => setHorarioTransporte(v as (typeof TRANSPORTE_HORARIOS)[number])}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TRANSPORTE_HORARIOS.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {horarioTransporte === "Horário específico..." && (
                      <Input className="h-11" placeholder="Ex.: 21h30" value={horarioLivre} onChange={(e) => setHorarioLivre(e.target.value)} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={obsTransporte} onChange={(e) => setObsTransporte(e.target.value)} rows={3} />
                  </div>
                </div>
              )}

              {tipoSelecionado === "rh" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Setor origem *</Label>
                    <Select value={setorOrigem} onValueChange={setSetorOrigem}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Obra">Obra</SelectItem>
                        <SelectItem value="Engenharia">Engenharia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sub-tipo *</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {RH_TIPOS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setRhTipo(t.id)}
                          className={`h-12 rounded-xl border font-bold ${rhTipo === t.id ? "border-primary bg-primary/10" : "border-border"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(rhTipo === "demissao" || rhTipo === "reajuste") && (
                    <div className="space-y-2">
                      <Label>Funcionário *</Label>
                      <Select value={rhFuncionarioId} onValueChange={setRhFuncionarioId}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {funcionarios.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome} - {f.funcao}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {rhTipo === "demissao" && (
                    <div className="space-y-2">
                      <Label>Motivo da demissão *</Label>
                      <Textarea rows={4} value={rhMotivoDemissao} onChange={(e) => setRhMotivoDemissao(e.target.value)} />
                    </div>
                  )}

                  {rhTipo === "admissao" && (
                    <>
                      <div className="space-y-2">
                        <Label>Função desejada *</Label>
                        <Input list="funcoes-rh" value={rhFuncaoDesejada} onChange={(e) => setRhFuncaoDesejada(e.target.value)} className="h-11" />
                        <datalist id="funcoes-rh">
                          {funcoesRh.map((f) => (
                            <option key={f} value={f} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label>Justificativa *</Label>
                        <Textarea rows={4} value={rhJustificativa} onChange={(e) => setRhJustificativa(e.target.value)} />
                      </div>
                    </>
                  )}

                  {rhTipo === "reajuste" && (
                    <>
                      <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select value={rhReajusteTipo} onValueChange={setRhReajusteTipo}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Classificação (promoção de cargo)">Classificação (promoção de cargo)</SelectItem>
                            <SelectItem value="Reajuste Salarial">Reajuste Salarial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Justificativa *</Label>
                        <Textarea rows={4} value={rhJustificativa} onChange={(e) => setRhJustificativa(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {tipoSelecionado === "material" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Setor origem *</Label>
                    <Select value={setorOrigemMaterial} onValueChange={setSetorOrigemMaterial}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Obra">Obra</SelectItem>
                        <SelectItem value="Engenharia">Engenharia</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Segurança">Segurança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Destinatário *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMaterialDestino("suprimentos")}
                        className={`h-11 rounded-xl border font-bold ${materialDestino === "suprimentos" ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        Suprimentos
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterialDestino("programador")}
                        className={`h-11 rounded-xl border font-bold ${materialDestino === "programador" ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        Programador
                      </button>
                    </div>
                  </div>

                  {materialItens.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border p-3 space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <Input
                          className="h-11"
                          placeholder="Item/material"
                          value={item.item}
                          onChange={(e) => setMaterialItem(idx, { item: e.target.value })}
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            className="h-11 col-span-2"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Quantidade"
                            value={item.quantidade}
                            onChange={(e) => setMaterialItem(idx, { quantidade: e.target.value })}
                          />
                          <Select value={item.unidade} onValueChange={(v) => setMaterialItem(idx, { unidade: v as MaterialItem["unidade"] })}>
                            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="un">un</SelectItem>
                              <SelectItem value="cx">cx</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="L">L</SelectItem>
                              <SelectItem value="m">m</SelectItem>
                              <SelectItem value="par">par</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {materialItens.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => removeMaterialItem(idx)}>Remover item</Button>
                      )}
                    </div>
                  ))}

                  <Button variant="outline" className="w-full h-11" onClick={addMaterialItem}>+ Adicionar item</Button>

                  <div className="space-y-2">
                    <Label>Funcionário destinatário (opcional)</Label>
                    <Select value={materialFuncionarioId} onValueChange={setMaterialFuncionarioId}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {funcionarios.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome} - {f.funcao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea rows={3} value={materialObs} onChange={(e) => setMaterialObs(e.target.value)} />
                  </div>
                </div>
              )}

              {tipoSelecionado === "tarefa" && (
                <div className="space-y-4">
                  {!canCreateTarefa ? (
                    <p className="text-sm text-destructive">Seu perfil não pode criar tarefas.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Funcionário da equipe *</Label>
                        <Select value={tarefaFuncionarioId} onValueChange={setTarefaFuncionarioId}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {funcionariosEquipe.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.nome} - {f.funcao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Título da tarefa *</Label>
                        <Input className="h-11" value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição detalhada</Label>
                        <Textarea rows={4} value={tarefaDescricao} onChange={(e) => setTarefaDescricao(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Data prevista</Label>
                        <Input className="h-11" type="date" value={tarefaData} onChange={(e) => setTarefaData(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Select value={tarefaHorario} onValueChange={(v) => setTarefaHorario(v as (typeof TRANSPORTE_HORARIOS)[number])}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRANSPORTE_HORARIOS.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {tarefaHorario === "Horário específico..." && (
                          <Input className="h-11" value={tarefaHorarioLivre} onChange={(e) => setTarefaHorarioLivre(e.target.value)} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-4 flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={saving}>Cancelar</Button>
          {tipoSelecionado && (
            <Button className="flex-1 h-11" onClick={handleSubmit} disabled={saving || loadingBase}>
              {saving ? "Salvando..." : "Criar demanda"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
