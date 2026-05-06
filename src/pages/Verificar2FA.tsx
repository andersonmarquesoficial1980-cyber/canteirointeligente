import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";

export default function Verificar2FA() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function verificar() {
    if (code.length !== 6) return;
    setLoading(true);

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find(f => f.status === "verified");
    if (!totp) {
      navigate("/", { replace: true });
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (challengeError || !challenge) {
      toast({ title: "Erro", description: "Falha ao iniciar verificação.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.id, code });
    setLoading(false);

    if (error) {
      toast({ title: "Código inválido", description: "Verifique o código no seu autenticador e tente novamente.", variant: "destructive" });
      setCode("");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img src={logoCi} alt="Workflux" className="h-20 mx-auto object-contain" />
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-display font-bold">Verificação em 2 Fatores</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Abra o app autenticador e digite o código de 6 dígitos para continuar.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => e.key === "Enter" && verificar()}
            className="h-16 text-center text-3xl font-mono tracking-[0.6em] rounded-xl border-2"
            autoFocus
          />
          <Button
            onClick={verificar}
            disabled={code.length !== 6 || loading}
            className="w-full h-12 font-bold gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Verificar
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Apps: Google Authenticator, Authy, Microsoft Authenticator
        </p>
      </div>
    </div>
  );
}
