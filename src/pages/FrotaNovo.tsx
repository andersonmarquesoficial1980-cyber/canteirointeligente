import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Truck, Save } from "lucide-react";

const TIPOS = ["Pavimentação", "Compactação", "Eletrônicos", "Veículos", "Outros"];
const STATUS_OPTIONS = [
  { value: "ativo", label: "Operando" },
  { value: "parado", label: "Parado" },
  { value: "manutencao", label: "Manutenção" },
];

export default function FrotaNovo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [frota, setFrota] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("ativo");

  const handleSave = async () => {
    if (!nome.trim() || !frota.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e o prefixo/frota.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("maquinas_frota" as any)
        .insert({ nome: nome.trim(), frota: frota.trim(), tipo: tipo || null, status } as any);

      if (error) throw error;

      toast({ title: "✅ Sucesso!", description: `Equipamento "${nome}" cadastrado com sucesso.` });
      setNome("");
      setFrota("");
      setTipo("");
      setStatus("ativo");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px]">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Novo Equipamento</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4 pb-32">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">Dados do Equipamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Nome */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Nome do Equipamento *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Fresadora Wirtgen W200"
                className="min-h-[48px] text-base bg-secondary border-border"
              />
            </div>

            {/* Frota */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Prefixo / Frota *</Label>
              <Input
                value={frota}
                onChange={(e) => setFrota(e.target.value)}
                placeholder="Ex: FR-001"
                className="min-h-[48px] text-base bg-secondary border-border"
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="min-h-[48px] text-base bg-secondary border-border">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t} className="min-h-[44px] text-base">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="min-h-[48px] text-base bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="min-h-[44px] text-base">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full min-h-[56px] text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? "Salvando..." : "Salvar Equipamento"}
        </Button>
      </div>
    </div>
  );
}
