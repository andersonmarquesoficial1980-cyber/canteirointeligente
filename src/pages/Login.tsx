import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Mail, Lock } from "lucide-react";

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Branding */}
      <div className="text-center mb-8 space-y-3">
        <img src={logoFremix} alt="Fremix Pavimentação" className="h-14 mx-auto object-contain" />
        <h1 className="text-3xl font-display font-bold tracking-tight">
          <span className="text-foreground">Canteiro</span>
          <span className="text-accent">.</span>
          <span className="text-primary"> Inteligente</span>
        </h1>
        <p className="text-sm text-muted-foreground tracking-wide">
          Plataforma unificada de gestão de obras e frota
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm border border-dashed border-border rounded-2xl p-6 space-y-5 bg-card/60">
        {/* Title row */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-display font-bold tracking-widest uppercase text-foreground">
              Entrar
            </h2>
          </div>
          <div className="h-0.5 bg-destructive rounded-full w-full" />
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Mail className="w-4 h-4" /> Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Lock className="w-4 h-4" /> Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-14 gap-2 text-base font-bold rounded-xl"
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
