import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MapPin } from "lucide-react";
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

const TIPOS_VEICULO = [
  "CAMINHÃO ESPARGIDOR", "CAMINHÃO PIPA", "CAMINHÃO CARROCERIA",
  "CAMINHÃO BASCULANTE", "CAMINHÃO COMBOIO", "CAMINHÃO PLATAFORMA",
  "CAVALO MECANICO", "VAN", "MICROONIBUS",
];

interface Funcionario { id: string; name: string; matricula: string | null; }
interface Veiculo { id: string; frota: string; tipo: string; }
interface Ogs { id: string; ogs_number: string; client_name: string; location_address: string; }

interface EquipViagem { tipo: string; frota: string; }
interface Viagem {
  id: string;
  origem_ogs: string;
  origem_maps: string;
  destino_ogs: string;
  destino_maps: string;
  equipamentos: EquipViagem[];
}

function novaViagem(): Viagem {
  return {
    id: crypto.randomUUID(),
    origem_ogs: "", origem_maps: "",
    destino_ogs: "", destino_maps: "",
    equipamentos: [{ tipo: "", frota: "" }, { tipo: "", frota: "" }, { tipo: "", frota: "" }],
  };
}

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
  const [ogsList, setOgsList] = useState<Ogs[]>([]);

  const emptyForm = () => ({
    titulo: "", titulo_outro: "", descricao: "",
    solicitante_nome: "", solicitante_departamento: "",
    funcionario_id: "", funcionario_nome: "",
    veiculo_id: "", equipamento: "",
    centro_de_custo: "", data_prevista: "", observacoes: "",
    viagens: [novaViagem()],
  });
  const [form, setForm] = useState(emptyForm());

  const isTransporte = form.titulo === "Transporte de equipamento";
  const isOutro = form.titulo === "Outro";

  useEffect(() => {
    if (!open) return;
    supabase.from("employees").select("id, name, matricula").order("name").then(({ data }) => {
      if (data) setFuncionarios(data as Funcionario[]);
    });
    (supabase as any).from("maquinas_frota").select("id, frota, tipo")
      .in("tipo", TIPOS_VEICULO).order("tipo").order("frota")
      .then(({ data }: any) => { if (data) setVeiculos(data); });
    (supabase as any).from("maquinas_frota").select("id, frota, tipo")
      .order("tipo").order("frota")
      .then(({ data }: any) => { if (data) setTodaFrota(data); });
    (supabase as any).from("ogs_reference").select("id, ogs_number, client_name, location_address")
      .order("ogs_number")
      .then(({ data }: any) => { if (data) setOgsList(data); });
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

  // Viagens
  const addViagem = () => setForm(prev => ({ ...prev, viagens: [...prev.viagens, novaViagem()] }));
  const removeViagem = (id: string) => setForm(prev => ({ ...prev, viagens: prev.viagens.filter(v => v.id !== id) }));

  const updateViagem = (id: string, field: keyof Viagem, value: any) => {
    setForm(prev => ({
      ...prev,
      viagens: prev.viagens.map(v => v.id === id ? { ...v, [field]: value } : v),
    }));
  };

  const updateEquip = (viagemId: string, idx: number, field: keyof EquipViagem, value: string) => {
    setForm(prev => ({
      ...prev,
      viagens: prev.viagens.map(v => {
        if (v.id !== viagemId) return v;
        const equipamentos = [...v.equipamentos];
        equipamentos[idx] = { ...equipamentos[idx], [field]: value };
        // Se mudou o tipo, limpa a frota
        if (field === "tipo") equipamentos[idx].frota = "";
        return { ...v, equipamentos };
      }),
    }));
  };

  const frotaPorTipo = (tipo: string) => todaFrota.filter(v => v.tipo === tipo);
  const tiposUnicos = [...new Set(todaFrota.map(v => v.tipo))].sort();

  const ogsLabel = (ogs: Ogs) => `OGS ${ogs.ogs_number} — ${ogs.client_name}`;
  const ogsEndereco = (ogsNumber: string) => {
    const o = ogsList.find(o => o.ogs_number === ogsNumber);
    return o?.location_address ?? "";
  };

  const buildDescricaoTransporte = () => {
    const linhas: string[] = [];
    form.viagens.forEach((v, i) => {
      linhas.push(`\nViagem ${i + 1}:`);
      const origemOgs = ogsList.find(o => o.ogs_number === v.origem_ogs);
      const destinoOgs = ogsList.find(o => o.ogs_number === v.destino_ogs);
      if (origemOgs) linhas.push(`  Origem: OGS ${origemOgs.ogs_number} - ${origemOgs.client_name} | ${origemOgs.location_address}`);
      if (v.origem_maps) linhas.push(`  Maps origem: ${v.origem_maps}`);
      if (destinoOgs) linhas.push(`  Destino: OGS ${destinoOgs.ogs_number} - ${destinoOgs.client_name} | ${destinoOgs.location_address}`);
      if (v.destino_maps) linhas.push(`  Maps destino: ${v.destino_maps}`);
      v.equipamentos.forEach((eq, j) => {
        if (eq.frota) linhas.push(`  Equip ${j + 1}: ${eq.frota} (${eq.tipo})`);
      });
    });
    return linhas.join("\n").trim();
  };

  const tituloFinal = isOutro ? form.titulo_outro : form.titulo;

  const handleSubmit = async () => {
    if (!tituloFinal || !form.solicitante_nome || !form.solicitante_departamento || !form.centro_de_custo) return;
    setSaving(true);

    let descricaoFinal = form.descricao;
    if (isTransporte) {
      const transpDesc = buildDescricaoTransporte();
      descricaoFinal = transpDesc + (form.descricao ? `\n\n${form.descricao}` : "");
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
    if (ok) { setForm(emptyForm()); onClose(); }
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

          {/* BLOCO TRANSPORTE DE EQUIPAMENTO */}
          {isTransporte && (
            <div className="space-y-4">
              {form.viagens.map((viagem, vIdx) => (
                <div key={viagem.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary uppercase tracking-wide">Viagem {vIdx + 1}</span>
                    {form.viagens.length > 1 && (
                      <button onClick={() => removeViagem(viagem.id)} className="text-destructive hover:text-destructive/80 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Origem */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Origem</Label>
                    <Select value={viagem.origem_ogs} onValueChange={v => updateViagem(viagem.id, "origem_ogs", v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione a OGS de origem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASE">BASE (Pátio)</SelectItem>
                        {ogsList.map(o => <SelectItem key={o.id} value={o.ogs_number}>{ogsLabel(o)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {viagem.origem_ogs && viagem.origem_ogs !== "BASE" && (
                      <p className="text-xs text-muted-foreground pl-1">📍 {ogsEndereco(viagem.origem_ogs)}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <Input
                        placeholder="Link Google Maps (opcional)"
                        value={viagem.origem_maps}
                        onChange={e => updateViagem(viagem.id, "origem_maps", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Destino */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Destino</Label>
                    <Select value={viagem.destino_ogs} onValueChange={v => updateViagem(viagem.id, "destino_ogs", v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione a OGS de destino" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASE">BASE (Pátio)</SelectItem>
                        {ogsList.map(o => <SelectItem key={o.id} value={o.ogs_number}>{ogsLabel(o)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {viagem.destino_ogs && viagem.destino_ogs !== "BASE" && (
                      <p className="text-xs text-muted-foreground pl-1">📍 {ogsEndereco(viagem.destino_ogs)}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <Input
                        placeholder="Link Google Maps (opcional)"
                        value={viagem.destino_maps}
                        onChange={e => updateViagem(viagem.id, "destino_maps", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Equipamentos */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Equipamentos</Label>
                    {viagem.equipamentos.map((eq, eIdx) => (
                      <div key={eIdx} className="grid grid-cols-2 gap-2">
                        <Select value={eq.tipo} onValueChange={v => updateEquip(viagem.id, eIdx, "tipo", v)}>
                          <SelectTrigger className="text-xs h-8"><SelectValue placeholder={`Tipo ${eIdx + 1}`} /></SelectTrigger>
                          <SelectContent>
                            {tiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={eq.frota} onValueChange={v => updateEquip(viagem.id, eIdx, "frota", v)} disabled={!eq.tipo}>
                          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Frota" /></SelectTrigger>
                          <SelectContent>
                            {frotaPorTipo(eq.tipo).map(v => <SelectItem key={v.id} value={v.frota}>{v.frota}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addViagem}
                className="w-full border-dashed text-sm gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar viagem
              </Button>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Observações{isTransporte ? " adicionais" : ""}</Label>
            <Textarea placeholder="Informações adicionais..." value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} />
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
            <Label>{isTransporte ? "Motorista carreteiro" : "Funcionário atribuído"}</Label>
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

          {/* Veículo — só mostra se não for transporte (transporte usa as viagens) */}
          {!isTransporte && (
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
          )}

          {/* Carreta (só transporte) */}
          {isTransporte && (
            <div className="space-y-1.5">
              <Label>Carreta / Cavalo mecânico</Label>
              <Select value={form.veiculo_id} onValueChange={handleVeiculo}>
                <SelectTrigger><SelectValue placeholder="Selecione a carreta" /></SelectTrigger>
                <SelectContent>
                  {veiculos.filter(v => v.tipo === "CAVALO MECANICO").map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.frota}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
