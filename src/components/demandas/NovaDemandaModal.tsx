import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Demanda } from "@/hooks/useDemandas";
import { SETORES_DESTINATARIOS, TIPOS_DEMANDA, URGENCIAS, type UrgenciaDemanda } from "@/lib/demandas";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (demanda: Omit<Demanda, "id" | "created_at">) => Promise<boolean>;
}

interface FormState {
  tipo: Demanda["tipo"];
  destinatario_setor: Demanda["destinatario_setor"];
  urgencia: UrgenciaDemanda;
  titulo: string;
  descricao: string;
  equipamento: string;
  funcionario_nome: string;
  solicitante_nome: string;
  solicitante_departamento: string;
  data_prevista: string;
}

const URGENCIA_BUTTON_CLASS: Record<UrgenciaDemanda, string> = {
  baixa: "border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100",
  normal: "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100",
  alta: "border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100",
  urgente: "border-red-300 text-red-700 bg-red-50 hover:bg-red-100",
};

const initialState: FormState = {
  tipo: "geral",
  destinatario_setor: undefined,
  urgencia: "normal",
  titulo: "",
  descricao: "",
  equipamento: "",
  funcionario_nome: "",
  solicitante_nome: "",
  solicitante_departamento: "",
  data_prevista: "",
};

export default function NovaDemandaModal({ open, onClose, onCreate }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit =
    Boolean(form.tipo) &&
    Boolean(form.destinatario_setor) &&
    Boolean(form.descricao.trim()) &&
    Boolean(form.solicitante_nome.trim()) &&
    Boolean(form.solicitante_departamento.trim());

  const handleSubmit = async () => {
    if (!canSubmit || !form.destinatario_setor) return;

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const tipoMeta = TIPOS_DEMANDA.find((t) => t.value === form.tipo);

    const payload: Omit<Demanda, "id" | "created_at"> = {
      titulo: form.titulo.trim() || tipoMeta?.label || "Demanda interna",
      descricao: form.descricao.trim(),
      solicitante_nome: form.solicitante_nome.trim(),
      solicitante_departamento: form.solicitante_departamento.trim(),
      funcionario_nome: form.funcionario_nome.trim() || undefined,
      equipamento: form.equipamento.trim() || undefined,
      centro_de_custo: "Demandas Internas",
      data_prevista: form.data_prevista || undefined,
      status: "pendente",
      tipo: form.tipo,
      destinatario_setor: form.destinatario_setor,
      urgencia: form.urgencia,
      created_by: user?.id,
      observacoes: undefined,
      funcionario_id: undefined,
      company_id: undefined,
      resposta: undefined,
      respondido_por: undefined,
      respondido_at: undefined,
      viewed_by: [],
    };

    const ok = await onCreate(payload);
    if (ok) {
      setForm(initialState);
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-lg">Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={form.tipo ?? "geral"} onValueChange={(v) => set("tipo", v as Demanda["tipo"])}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DEMANDA.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.icon} {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Setor destinatário *</Label>
            <Select
              value={form.destinatario_setor}
              onValueChange={(v) => set("destinatario_setor", v as Demanda["destinatario_setor"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {SETORES_DESTINATARIOS.map((setor) => (
                  <SelectItem key={setor.value} value={setor.value}>
                    {setor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Urgência *</Label>
            <div className="grid grid-cols-2 gap-2">
              {URGENCIAS.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => set("urgencia", u.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${URGENCIA_BUTTON_CLASS[u.value]} ${
                    form.urgencia === u.value ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título (opcional)</Label>
            <Input
              placeholder="Resumo curto da solicitação"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Equipamento</Label>
            <Input
              placeholder="Ex.: Rolo Compactador 12T"
              value={form.equipamento}
              onChange={(e) => set("equipamento", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva a necessidade com detalhes"
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Solicitante *</Label>
              <Input
                placeholder="Nome"
                value={form.solicitante_nome}
                onChange={(e) => set("solicitante_nome", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento *</Label>
              <Input
                placeholder="Setor de origem"
                value={form.solicitante_departamento}
                onChange={(e) => set("solicitante_departamento", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Funcionário (opcional)</Label>
              <Input
                placeholder="Nome do funcionário"
                value={form.funcionario_nome}
                onChange={(e) => set("funcionario_nome", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data prevista</Label>
              <Input type="date" value={form.data_prevista} onChange={(e) => set("data_prevista", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="bg-header-gradient text-white font-bold rounded-xl hover:opacity-90"
          >
            {saving ? "Criando..." : "Criar Demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
