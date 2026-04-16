import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, CheckCircle } from "lucide-react";
import logoCi from "@/assets/logo-ci.png";

export default function UpdatePassword() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch || password.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast({ title: "Senha atualizada com sucesso!" });
      setTimeout(() => window.location.replace("/"), 2000);
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
        {done ? (
          <div className="text-center space-y-4 py-6">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
            <p className="font-display font-bold text-foreground">Senha atualizada!</p>
            <p className="text-sm text-muted-foreground">Redirecionando...</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-xl font-display font-extrabold tracking-widest uppercase text-foreground">
                Nova Senha
              </h1>
              <div className="mx-auto h-1 w-16 rounded-full" style={{ background: "hsl(var(--primary))" }} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-pass" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Lock className="w-4 h-4 text-primary" /> Nova Senha
                </Label>
                <Input
                  id="new-pass"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pass" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Lock className="w-4 h-4 text-primary" /> Confirmar Senha
                </Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className={`h-12 bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl ${mismatch ? "border-destructive ring-1 ring-destructive" : "border-border"}`}
                />
                {mismatch && (
                  <p className="text-xs text-destructive font-semibold">As senhas não coincidem.</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                disabled={loading || mismatch || password.length < 6}
              >
                {loading ? "Aguarde..." : "Salvar Nova Senha"}
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="relative z-10 mt-8 text-xs text-primary-foreground/70 tracking-wide">
        Fremix Pavimentação © 2026 — Powered by Workflux
      </p>
    </div>
  );
}
