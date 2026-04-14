import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Demanda } from "@/hooks/useDemandas";

const DEPARTAMENTOS = ["Engenharia", "Suprimentos", "Manutenção", "Financeiro", "RH", "Outro"];
const CENTROS_CUSTO = ["Engenharia", "Suprimentos", "Manutenção", "Financeiro", "RH"];

interface Funcionario { id: string; name: string; matricula: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (demanda: Omit<Demanda, "id" | "created_at">) => Promise<boolean>;
}

export default function NovaDemandaModal({ open, onClose, onCreate }: Props) {
  const [saving, setSaving] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  const empty = {
    titulo: "", descricao: "", solicitante_nome: "", solicitante_departamento: "",
    funcionario_id: "", funcionario_nome: "", equipamento: "",
    centro_de_custo: "", data_prevista: "", observacoes: "",
    status: "pendente" as const,
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    supabase.from("employees").select("id, name, matricula").order("name").then(({ data }) => {
      if (data) setFuncionarios(data as Funcionario[]);
    });
  }, [open]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFuncionario = (id: string) => {
    const f = funcionarios.find(f => f.id === id);
    setForm(prev => ({ ...prev, funcionario_id: id, funcionario_nome: f?.name ?? "" }));
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.solicitante_nome || !form.solicitante_departamento || !form.centro_de_custo) return;
    setSaving(true);
    const payload: any = {
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      solicitante_nome: form.solicitante_nome,
      solicitante_departamento: form.solicitante_departamento,
      funcionario_id: form.funcionario_id || undefined,
      funcionario_nome: form.funcionario_nome || undefined,
      equipamento: form.equipamento || undefined,
      centro_de_custo: form.centro_de_custo,
      data_prevista: form.data_prevista || undefined,
      observacoes: form.observacoes || undefined,
      status: "pendente",
    };
    const ok = await onCreate(payload);
    if (ok) { setForm(empty); onClose(); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-lg">Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input placeholder="Ex: Carregar emulsão asfáltica" value={form.titulo} onChange={e => set("titulo", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Detalhes da demanda..." value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Solicitante *</Label>
              <Input placeholder="Nome" value={form.solicitante_nome} onChange={e => set("solicitante_nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento *</Label>
              <Select value={form.solicitante_departamento} onValueChange={v => set("solicitante_departamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Funcionário atribuído</Label>
            <Select value={form.funcionario_id} onValueChange={handleFuncionario}>
              <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
              <SelectContent>
                {funcionarios.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.matricula ? `[${f.matricula}] ` : ""}{f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Equipamento / Veículo</Label>
            <Input placeholder="Ex: Caminhão VW, Carro Cobalt..." value={form.equipamento} onChange={e => set("equipamento", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Centro de Custo *</Label>
              <Select value={form.centro_de_custo} onValueChange={v => set("centro_de_custo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CENTROS_CUSTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data prevista</Label>
              <Input type="date" value={form.data_prevista} onChange={e => set("data_prevista", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea placeholder="Informações adicionais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.titulo || !form.solicitante_nome || !form.solicitante_departamento || !form.centro_de_custo}
            className="bg-header-gradient text-white font-bold rounded-xl hover:opacity-90"
          >
            {saving ? "Criando..." : "Criar Demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
