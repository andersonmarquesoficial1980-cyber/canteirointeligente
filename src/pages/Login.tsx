import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Mail, Lock } from "lucide-react";
import logoCi from "@/assets/logo-ci.png";

export default function Login() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido";
      toast({ title: "Erro no login", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
         style={{ background: "hsl(var(--primary))" }}>

      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(ellipse at 50% 30%, hsl(215 100% 65% / 0.3) 0%, transparent 70%)" }} />

      {/* Logo */}
      <div className="relative z-10 mb-10">
        <img src={logoCi} alt="Canteiro Inteligente" className="h-28 sm:h-36 mx-auto object-contain drop-shadow-2xl" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm bg-card rounded-3xl p-8 space-y-6"
           style={{ boxShadow: "0 25px 60px -12px rgba(0,0,0,0.35)" }}>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-display font-extrabold tracking-widest uppercase text-foreground">
            Acesso ao Sistema
          </h1>
          <div className="mx-auto h-1 w-16 rounded-full" style={{ background: "hsl(var(--primary))" }} />
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Mail className="w-4 h-4 text-primary" /> Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Lock className="w-4 h-4 text-primary" /> Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            disabled={loading}
          >
            <LogIn className="w-5 h-5" />
            {loading ? "Aguarde..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Contate o administrador para obter suas credenciais.
        </p>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-primary-foreground/70 tracking-wide">
        Fremix Pavimentação © 2026 — Powered by Canteiro Inteligente
      </p>
    </div>
  );
}
