import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Demanda } from "@/hooks/useDemandas";

const TITULOS = [
  "Carregar emulsão asfáltica",
  "Buscar gás",
  "Buscar material (Suprimentos)",
  "Levar material",
  "Ir carregar caminhão pipa",
  "Levar caminhão pipa para usinagem",
  "Transporte de equipamento",
  "Outro",
];

const DEPARTAMENTOS = ["Engenharia", "Suprimentos", "Manutenção", "Financeiro", "RH", "Outro"];
const CENTROS_CUSTO = ["Engenharia", "Suprimentos", "Manutenção", "Financeiro", "RH"];

// Tipos de frota relevantes para demandas
const TIPOS_FROTA_RELEVANTES = [
  "CAMINHÃO ESPARGIDOR",
  "CAMINHÃO PIPA",
  "CAMINHÃO CARROCERIA",
  "CAMINHÃO BASCULANTE",
  "CAMINHÃO COMBOIO",
  "CAMINHÃO PLATAFORMA",
  "CAVALO MECANICO",
  "VAN",
  "MICROONIBUS",
];

interface Funcionario { id: string; name: string; matricula: string | null; }
interface Veiculo { id: string; frota: string; tipo: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (demanda: Omit<Demanda, "id" | "created_at">) => Promise<boolean>;
}

export default function NovaDemandaModal({ open, onClose, onCreate }: Props) {
  const [saving, setSaving] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [todaFrota, setTodaFrota] = useState<Veiculo[]>([]);

  const empty = {
    titulo: "", titulo_outro: "", descricao: "",
    solicitante_nome: "", solicitante_departamento: "",
    funcionario_id: "", funcionario_nome: "",
    veiculo_id: "", equipamento: "",
    centro_de_custo: "", data_prevista: "", observacoes: "",
    // Transporte de equipamento
    equip_transportar: "", origem: "", destino: "",
  };
  const [form, setForm] = useState(empty);

  const isTransporte = form.titulo === "Transporte de equipamento";
  const isOutro = form.titulo === "Outro";

  useEffect(() => {
    if (!open) return;
    // Funcionários
    supabase.from("employees").select("id, name, matricula").order("name").then(({ data }) => {
      if (data) setFuncionarios(data as Funcionario[]);
    });
    // Veículos filtrados (para campo "Veículo/Motorista")
    (supabase as any).from("maquinas_frota")
      .select("id, frota, tipo")
      .in("tipo", TIPOS_FROTA_RELEVANTES)
      .order("tipo").order("frota")
      .then(({ data }: any) => { if (data) setVeiculos(data as Veiculo[]); });
    // Toda a frota (para campo "Equipamento a transportar")
    (supabase as any).from("maquinas_frota")
      .select("id, frota, tipo")
      .order("tipo").order("frota")
      .then(({ data }: any) => { if (data) setTodaFrota(data as Veiculo[]); });
  }, [open]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFuncionario = (id: string) => {
    const f = funcionarios.find(f => f.id === id);
    setForm(prev => ({ ...prev, funcionario_id: id, funcionario_nome: f?.name ?? "" }));
  };

  const handleVeiculo = (id: string) => {
    const v = veiculos.find(v => v.id === id);
    setForm(prev => ({ ...prev, veiculo_id: id, equipamento: v ? `${v.frota} (${v.tipo})` : "" }));
  };

  const handleEquipTransportar = (id: string) => {
    const v = todaFrota.find(v => v.id === id);
    setForm(prev => ({ ...prev, equip_transportar: v ? `${v.frota} (${v.tipo})` : "" }));
  };

  const tituloFinal = form.titulo === "Outro" ? form.titulo_outro : form.titulo;

  const handleSubmit = async () => {
    if (!tituloFinal || !form.solicitante_nome || !form.solicitante_departamento || !form.centro_de_custo) return;
    setSaving(true);

    let descricaoFinal = form.descricao;
    if (isTransporte && (form.equip_transportar || form.origem || form.destino)) {
      const partes = [];
      if (form.equip_transportar) partes.push(`Equipamento: ${form.equip_transportar}`);
      if (form.origem) partes.push(`Origem: ${form.origem}`);
      if (form.destino) partes.push(`Destino: ${form.destino}`);
      descricaoFinal = partes.join(" | ") + (form.descricao ? `\n${form.descricao}` : "");
    }

    const payload: any = {
      titulo: tituloFinal,
      descricao: descricaoFinal || undefined,
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

  const canSubmit = tituloFinal && form.solicitante_nome && form.solicitante_departamento && form.centro_de_custo;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-lg">Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Tipo de demanda *</Label>
            <Select value={form.titulo} onValueChange={v => set("titulo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TITULOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {isOutro && (
              <Input placeholder="Descreva o tipo de demanda" value={form.titulo_outro} onChange={e => set("titulo_outro", e.target.value)} />
            )}
          </div>

          {/* Campos extras para Transporte de Equipamento */}
          {isTransporte && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dados do Transporte</p>
              <div className="space-y-1.5">
                <Label>Equipamento a transportar</Label>
                <Select onValueChange={handleEquipTransportar}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    {todaFrota.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.frota} — {v.tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Origem</Label>
                  <Input placeholder="De onde?" value={form.origem} onChange={e => set("origem", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Destino</Label>
                  <Input placeholder="Para onde?" value={form.destino} onChange={e => set("destino", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição / Observações</Label>
            <Textarea placeholder="Detalhes da demanda..." value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} />
          </div>

          {/* Solicitante */}
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

          {/* Funcionário */}
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

          {/* Veículo */}
          <div className="space-y-1.5">
            <Label>Veículo / Equipamento</Label>
            <Select value={form.veiculo_id} onValueChange={handleVeiculo}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {veiculos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.frota} — {v.tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Centro de custo + Data */}
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

        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
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
