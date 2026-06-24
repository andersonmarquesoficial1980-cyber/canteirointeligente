import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";

const TITULOS_MANUTENCAO = [
  "Elétrica",
  "Troca de Pneu",
  "Troca de Óleo",
  "Troca de Filtro",
  "Troca de Correia",
  "Troca de Bateria",
  "Troca de Freio",
  "Troca de Peça",
  "Reparo Hidráulico",
  "Reparo Mecânico",
  "Revisão Geral",
  "Regulagem",
  "Vazamento",
  "Superaquecimento",
  "Falha no Motor",
  "Problema de Transmissão",
  "NC Checklist",
  "Outro",
];

const TIPOS = ["Corretiva", "Preventiva", "Preditiva"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];
const MECANICO_TIPOS = ["Interno (Oficina)", "Campo"];

interface Equipamento {
  id: string;
  frota: string;
  tipo: string;
  nome?: string;
  status?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  equipmentFleet?: string;
  equipmentType?: string;
  checklistItem?: string;
}

export default function NovaOSModal({ open, onClose, onSaved, equipmentFleet = "", equipmentType = "", checklistItem = "" }: Props) {
  const [form, setForm] = useState({
    equipment_fleet: equipmentFleet,
    equipment_type: equipmentType,
    tipo: "Corretiva",
    prioridade: "Normal",
    titulo: checklistItem ? `NC Checklist: ${checklistItem}` : "",
    descricao: "",
    local_ogs: "",
    mecanico_nome: "",
    mecanico_tipo: "",
    data_prevista: "",
    horimetro_abertura: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [tituloCustom, setTituloCustom] = useState("");
  const [mostrarTituloCustom, setMostrarTituloCustom] = useState(false);

  const { data: ogsData = [] } = useOgsReference();

  // Busca equipamentos ao abrir o modal
  useEffect(() => {
    if (!open) return;
    setLoadingEquip(true);
    (supabase as any)
      .from("equipamentos")
      .select("id, frota, tipo, nome, status")
      .order("tipo")
      .order("frota")
      .then(({ data }: { data: Equipamento[] | null }) => {
        setEquipamentos(data || []);
        setLoadingEquip(false);
      });
  }, [open]);

  // Reset form quando abre
  useEffect(() => {
    if (open) {
      setForm({
        equipment_fleet: equipmentFleet,
        equipment_type: equipmentType,
        tipo: "Corretiva",
        prioridade: "Normal",
        titulo: checklistItem ? `NC Checklist: ${checklistItem}` : "",
        descricao: "",
        local_ogs: "",
        mecanico_nome: "",
        mecanico_tipo: "",
        data_prevista: "",
        horimetro_abertura: "",
      });
      setTituloCustom("");
      setMostrarTituloCustom(false);
      setErro("");
    }
  }, [open, equipmentFleet, equipmentType, checklistItem]);

  function handleTituloChange(value: string) {
    if (value === "Outro") {
      setMostrarTituloCustom(true);
      setForm(p => ({ ...p, titulo: "" }));
    } else {
      setMostrarTituloCustom(false);
      setForm(p => ({ ...p, titulo: value }));
    }
  }

  async function salvar() {
    const tituloFinal = mostrarTituloCustom ? tituloCustom : form.titulo;
    if (!form.equipment_fleet || !tituloFinal) {
      setErro("Frota e título são obrigatórios.");
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("manutencao_os").insert({
        equipment_fleet: form.equipment_fleet,
        equipment_type: form.equipment_type || null,
        tipo: form.tipo.toLowerCase(),
        prioridade: form.prioridade.toLowerCase(),
        titulo: tituloFinal,
        descricao: form.descricao || null,
        origem: "operador",
        solicitante_nome: null,
        local_ogs: form.local_ogs || null,
        mecanico_nome: form.mecanico_nome || null,
        mecanico_tipo: form.mecanico_tipo ? (form.mecanico_tipo.includes("Interno") ? "interno" : "campo") : null,
        data_abertura: new Date().toISOString().split("T")[0],
        data_prevista: form.data_prevista || null,
        horimetro_abertura: form.horimetro_abertura ? parseFloat(form.horimetro_abertura) : null,
        checklist_item: checklistItem || null,
        created_by: user?.id,
      });
      if (error) throw error;
      onSaved();
      onClose();
    } catch (e: any) {
      setErro("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const f = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  // Agrupa equipamentos por tipo para o select
  const tiposEquip = [...new Set(equipamentos.map(e => e.tipo))].sort();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">

          {/* TIPO EQUIP — vem primeiro, filtra as frotas disponíveis */}
          <div className="space-y-1.5">
            <span className="rdo-label">Tipo Equip. *</span>
            <Select
              value={form.equipment_type}
              onValueChange={v => {
                // ao trocar tipo, limpa a frota selecionada
                setForm(p => ({ ...p, equipment_type: v, equipment_fleet: "" }));
              }}
              disabled={loadingEquip}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder={loadingEquip ? "Carregando..." : "Selecione o tipo"} />
              </SelectTrigger>
              <SelectContent>
                {tiposEquip.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FROTA — filtrada pelo tipo selecionado acima */}
          <div className="space-y-1.5">
            <span className="rdo-label">Frota *</span>
            <Select
              value={form.equipment_fleet}
              onValueChange={v => f("equipment_fleet", v)}
              disabled={loadingEquip || !form.equipment_type}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder={
                  loadingEquip ? "Carregando..." :
                  !form.equipment_type ? "Selecione o tipo primeiro" :
                  "Selecione a frota"
                } />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {equipamentos
                  .filter(e => e.tipo === form.equipment_type)
                  .map(e => (
                    <SelectItem key={e.id} value={e.frota}>
                      {e.frota}{e.nome ? ` — ${e.nome}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* TÍTULO — select com opções pré-definidas + campo livre para "Outro" */}
          <div className="space-y-1.5">
            <span className="rdo-label">Título *</span>
            <Select
              value={mostrarTituloCustom ? "Outro" : form.titulo}
              onValueChange={handleTituloChange}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione o tipo de manutenção" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TITULOS_MANUTENCAO.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mostrarTituloCustom && (
              <Input
                value={tituloCustom}
                onChange={e => setTituloCustom(e.target.value)}
                placeholder="Descreva o título da manutenção"
                className="h-11 rounded-xl mt-1.5"
                autoFocus
              />
            )}
          </div>

          {/* DESCRIÇÃO */}
          <div className="space-y-1.5">
            <span className="rdo-label">Descrição</span>
            <Textarea
              value={form.descricao}
              onChange={e => f("descricao", e.target.value)}
              placeholder="Descreva o problema com detalhes..."
              className="min-h-[70px] rounded-xl"
            />
          </div>

          {/* TIPO OS + PRIORIDADE */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo OS</span>
              <Select value={form.tipo} onValueChange={v => f("tipo", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Prioridade</span>
              <Select value={form.prioridade} onValueChange={v => f("prioridade", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* LOCAL (OGS) — substitui Origem + Solicitante */}
          <div className="space-y-1.5">
            <span className="rdo-label">Local (OGS)</span>
            <Select value={form.local_ogs} onValueChange={v => f("local_ogs", v)}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecione a obra / pátio" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {ogsData.map((obra: any) => (
                  <SelectItem key={obra.id} value={obra.ogs_number}>
                    {obra.ogs_number === "000"
                      ? "000 — Pátio Central"
                      : `${obra.ogs_number} — ${obra.client_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MECÂNICO + TIPO MECÂNICO */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Mecânico</span>
              <Input value={form.mecanico_nome} onChange={e => f("mecanico_nome", e.target.value)} placeholder="Nome" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo Mecânico</span>
              <Select value={form.mecanico_tipo} onValueChange={v => f("mecanico_tipo", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{MECANICO_TIPOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* DATA PREVISTA + HORÍMETRO */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Data Prevista</span>
              <Input type="date" value={form.data_prevista} onChange={e => f("data_prevista", e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Horímetro</span>
              <Input type="number" value={form.horimetro_abertura} onChange={e => f("horimetro_abertura", e.target.value)} placeholder="0" className="h-11 rounded-xl" />
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button onClick={salvar} disabled={salvando} className="w-full h-11 rounded-xl font-display font-bold gap-2">
            {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Abrir OS"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
