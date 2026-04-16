import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TIPOS = ["Corretiva", "Preventiva", "Preditiva"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];
const ORIGENS = ["Operador", "Encarregado", "Coordenador", "Checklist", "Programada"];
const MECANICO_TIPOS = ["Interno (Oficina)", "Campo"];

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
    origem: "Operador",
    solicitante_nome: "",
    mecanico_nome: "",
    mecanico_tipo: "",
    data_prevista: "",
    horimetro_abertura: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!form.equipment_fleet || !form.titulo) {
      setErro("Frota e título são obrigatórios.");
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("manutencao_os").insert({
        equipment_fleet: form.equipment_fleet,
        equipment_type: form.equipment_type || null,
        tipo: form.tipo.toLowerCase(),
        prioridade: form.prioridade.toLowerCase(),
        titulo: form.titulo,
        descricao: form.descricao || null,
        origem: form.origem.toLowerCase(),
        solicitante_nome: form.solicitante_nome || null,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Frota *</span>
              <Input value={form.equipment_fleet} onChange={e => f("equipment_fleet", e.target.value)} placeholder="Ex: FA14" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo Equip.</span>
              <Input value={form.equipment_type} onChange={e => f("equipment_type", e.target.value)} placeholder="Ex: Fresadora" className="h-11 rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Título *</span>
            <Input value={form.titulo} onChange={e => f("titulo", e.target.value)} placeholder="Resumo do problema" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Descrição</span>
            <Textarea value={form.descricao} onChange={e => f("descricao", e.target.value)} placeholder="Descreva o problema com detalhes..." className="min-h-[70px] rounded-xl" />
          </div>

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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Origem</span>
              <Select value={form.origem} onValueChange={v => f("origem", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Solicitante</span>
              <Input value={form.solicitante_nome} onChange={e => f("solicitante_nome", e.target.value)} placeholder="Nome" className="h-11 rounded-xl" />
            </div>
          </div>

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
