import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Truck, Search, Cog, CircleDot } from "lucide-react";

const TIPOS = ["Pavimentação", "Compactação", "Fresagem", "Transporte", "Usina", "Apoio", "Outros"];
const STATUS_OPTIONS = [
  { value: "ativo", label: "Operando", color: "text-success" },
  { value: "parado", label: "Parado", color: "text-muted-foreground" },
  { value: "manutencao", label: "Manutenção", color: "text-accent" },
];

function statusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  const label = opt?.label ?? status;
  const variant = status === "ativo" ? "default" : status === "manutencao" ? "secondary" : "outline";
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

export default function FrotaNovo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [frota, setFrota] = useState("");
  const [tipo, setTipo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [status, setStatus] = useState("ativo");

  // Fetch all equipment
  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ["maquinas_frota_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota" as any)
        .select("*")
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = equipamentos.filter((eq: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      eq.nome?.toLowerCase().includes(s) ||
      eq.frota?.toLowerCase().includes(s) ||
      eq.tipo?.toLowerCase().includes(s) ||
      eq.empresa?.toLowerCase().includes(s)
    );
  });

  const resetForm = () => {
    setNome("");
    setFrota("");
    setTipo("");
    setEmpresa("");
    setStatus("ativo");
  };

  const handleSave = async () => {
    if (!nome.trim() || !frota.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e o prefixo/frota.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("maquinas_frota" as any)
        .insert({ nome: nome.trim(), frota: frota.trim(), tipo: tipo || null, status, empresa: empresa.trim() || null } as any);
      if (error) throw error;
      toast({ title: "✅ Equipamento cadastrado!", description: `"${nome}" adicionado com sucesso.` });
      resetForm();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["maquinas_frota_all"] });
      queryClient.invalidateQueries({ queryKey: ["maquinas_frota"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const countByStatus = (s: string) => equipamentos.filter((e: any) => e.status === s).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Cog className="w-6 h-6 text-primary" />
            Gestão de Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro e controle da frota</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-semibold">
              <Plus className="w-4 h-4" /> Novo Equipamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> Cadastrar Equipamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Fresadora Wirtgen W200" className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Prefixo / Frota *</Label>
                  <Input value={frota} onChange={(e) => setFrota(e.target.value)} placeholder="FR-001" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Empresa</Label>
                  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Fremix" className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full font-bold mt-2">
                {saving ? "Salvando..." : "Salvar Equipamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: equipamentos.length, icon: Truck },
          { label: "Operando", value: countByStatus("ativo"), icon: CircleDot },
          { label: "Manutenção", value: countByStatus("manutencao"), icon: Cog },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, frota, tipo..."
          className="pl-9 bg-secondary border-border"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando equipamentos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {search ? "Nenhum equipamento encontrado." : "Nenhum equipamento cadastrado ainda."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((eq: any) => (
            <Card key={eq.id} className="border-border bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{eq.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Frota: <span className="text-foreground font-medium">{eq.frota}</span>
                    {eq.tipo && <> · {eq.tipo}</>}
                    {eq.empresa && <> · {eq.empresa}</>}
                  </p>
                </div>
                {statusBadge(eq.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
