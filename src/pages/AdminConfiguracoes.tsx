import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

export default function AdminConfiguracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [emails, setEmails] = useState<string[]>([""]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("configuracoes_relatorio")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        const arr = (data.emails_destino as string[]) || [];
        setEmails(arr.length > 0 ? arr : [""]);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const validEmails = emails.filter(e => e.trim().length > 0);
    try {
      if (configId) {
        const { error } = await supabase
          .from("configuracoes_relatorio")
          .update({ emails_destino: validEmails, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_relatorio")
          .insert({ emails_destino: validEmails });
        if (error) throw error;
      }
      toast({ title: "✅ Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">⚙️ Configurações</h1>
            <p className="text-xs text-muted-foreground">Destinatários de Relatório</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-base font-bold text-foreground">📧 E-mails para Relatório RDO</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre os e-mails que receberão o relatório automaticamente ao enviar um RDO.
          </p>

          {emails.map((email, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail {idx + 1}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => {
                    const updated = [...emails];
                    updated[idx] = e.target.value;
                    setEmails(updated);
                  }}
                  className="h-11 bg-secondary border-border"
                  placeholder="exemplo@empresa.com.br"
                />
              </div>
              {emails.length > 1 && (
                <button
                  onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                  className="text-destructive p-2 mt-5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() => setEmails([...emails, ""])}
            className="w-full h-11 gap-2"
          >
            <Plus className="w-4 h-4" /> Adicionar E-mail
          </Button>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 text-base gap-2 font-semibold"
        >
          <Save className="w-5 h-5" /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
