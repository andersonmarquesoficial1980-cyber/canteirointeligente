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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-56 bg-header-gradient rounded-b-[3rem]" />
      {/* Ambient glows */}
      <div className="absolute top-10 left-[-60px] w-[240px] h-[240px] rounded-full bg-accent/15 blur-[80px] pointer-events-none" />

      {/* Branding */}
      <div className="relative text-center mb-8 space-y-4 z-10">
        <div className="relative inline-block">
          <img src={logoCi} alt="Canteiro Inteligente" className="h-32 mx-auto object-contain drop-shadow-2xl" />
          <div className="absolute inset-0 rounded-full bg-white/25 blur-2xl -z-10 scale-125" />
        </div>
        <p className="text-sm text-primary-foreground/90 tracking-wide font-medium">
          Plataforma de Gestão e Integração de Campo
        </p>
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm border border-border rounded-3xl p-7 space-y-5 bg-card shadow-card">
        {/* Title row */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-extrabold tracking-widest uppercase text-foreground">
              Entrar
            </h2>
          </div>
          <div className="h-1 bg-header-gradient rounded-full w-full" />
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
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
            className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-header-gradient hover:opacity-90 shadow-lg glow-primary"
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
    </div>
  );
}
