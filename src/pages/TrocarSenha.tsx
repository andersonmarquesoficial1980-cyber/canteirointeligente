import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

export default function TrocarSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const mismatch = confirmarSenha.length > 0 && novaSenha !== confirmarSenha;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch || novaSenha.length < 6) return;

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
      if (authError) throw authError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ senha_temporaria: false } as any)
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      toast({ title: "Senha alterada com sucesso!" });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "hsl(var(--primary))" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 30%, hsl(215 100% 65% / 0.3) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mb-10">
        <img src={logoCi} alt="Workflux" className="h-28 sm:h-36 mx-auto object-contain drop-shadow-2xl" />
      </div>

      <div
        className="relative z-10 w-full max-w-sm bg-card rounded-3xl p-8 space-y-6"
        style={{ boxShadow: "0 25px 60px -12px rgba(0,0,0,0.35)" }}
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-display font-extrabold tracking-widest uppercase text-foreground">
            Trocar Senha
          </h1>
          <p className="text-xs text-muted-foreground">Atualização obrigatória no primeiro acesso.</p>
          <div className="mx-auto h-1 w-16 rounded-full" style={{ background: "hsl(var(--primary))" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="nova-senha" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Lock className="w-4 h-4 text-primary" /> Nova Senha
            </Label>
            <Input
              id="nova-senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={6}
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmar-senha" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Lock className="w-4 h-4 text-primary" /> Confirmar Senha
            </Label>
            <Input
              id="confirmar-senha"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={6}
              className={`h-12 bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl ${mismatch ? "border-destructive ring-1 ring-destructive" : "border-border"}`}
            />
            {mismatch && <p className="text-xs text-destructive font-semibold">As senhas não coincidem.</p>}
          </div>

          <Button
            type="submit"
            className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            disabled={loading || mismatch || novaSenha.length < 6}
          >
            {loading ? "Aguarde..." : "Salvar Nova Senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
