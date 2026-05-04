import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Perfil() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    notify_rdo: false,
    notify_diario_equipamento: false,
    notify_diario_carreta: false,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/");
          return;
        }

        setUserId(user.id);

        const { data: myProfile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const myCompanyId = (myProfile as any)?.company_id || null;
        setCompanyId(myCompanyId);

        const { data: prefRow } = await (supabase as any)
          .from("notification_prefs")
          .select("notify_rdo, notify_diario_equipamento, notify_diario_carreta")
          .eq("user_id", user.id)
          .maybeSingle();

        if (prefRow) {
          setPrefs({
            notify_rdo: !!prefRow.notify_rdo,
            notify_diario_equipamento: !!prefRow.notify_diario_equipamento,
            notify_diario_carreta: !!prefRow.notify_diario_carreta,
          });
        }
      } catch (err: any) {
        toast({ title: "Erro", description: err?.message || "Falha ao carregar perfil.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, toast]);

  const savePref = async (
    key: "notify_rdo" | "notify_diario_equipamento" | "notify_diario_carreta",
    value: boolean,
  ) => {
    if (!userId) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        company_id: companyId,
        notify_rdo: next.notify_rdo,
        notify_diario_equipamento: next.notify_diario_equipamento,
        notify_diario_carreta: next.notify_diario_carreta,
        notify_demanda: true,
        notify_todos_carretas: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("notification_prefs")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    } catch (err: any) {
      setPrefs(prefs);
      toast({ title: "Erro ao salvar", description: err?.message || "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-display font-bold">Perfil</h1>
          <p className="text-xs text-muted-foreground">{profile?.nome_completo || "Usuário"}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Notificações</h2>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando preferências...</p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
              <span className="text-sm">Receber push de RDO</span>
              <Switch checked={prefs.notify_rdo} disabled={saving} onCheckedChange={(checked) => savePref("notify_rdo", checked)} />
            </label>
            <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
              <span className="text-sm">Push de Diário de Equipamento</span>
              <Switch checked={prefs.notify_diario_equipamento} disabled={saving} onCheckedChange={(checked) => savePref("notify_diario_equipamento", checked)} />
            </label>
            <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
              <span className="text-sm">Push de Diário de Carreta</span>
              <Switch checked={prefs.notify_diario_carreta} disabled={saving} onCheckedChange={(checked) => savePref("notify_diario_carreta", checked)} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
