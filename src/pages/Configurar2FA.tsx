import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";

export default function Configurar2FA() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"status" | "setup" | "verify">("status");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => { checkMfa(); }, []);

  async function checkMfa() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.find(f => f.status === "verified");
    setMfaEnabled(!!totp);
    setFactorId(totp?.id || null);
    setLoading(false);
  }

  async function iniciarSetup() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Workflux", friendlyName: "Workflux 2FA" });
    if (error || !data) {
      toast({ title: "Erro", description: error?.message || "Falha ao iniciar 2FA", variant: "destructive" });
      setLoading(false);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep("verify");
    setLoading(false);
  }

  async function confirmarCodigo() {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setVerifying(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    setVerifying(false);
    if (error) {
      toast({ title: "Código inválido", description: "Verifique o código no seu autenticador.", variant: "destructive" });
      setCode("");
      return;
    }
    toast({ title: "✅ 2FA ativado!", description: "Sua conta está protegida com autenticação em dois fatores." });
    setMfaEnabled(true);
    setStep("status");
    setQrCode(null);
    setSecret(null);
    setCode("");
  }

  async function desativar2FA() {
    if (!factorId) return;
    if (!confirm("Tem certeza que deseja desativar o 2FA? Sua conta ficará menos segura.")) return;
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setUnenrolling(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "2FA desativado", description: "Autenticação em dois fatores removida." });
    setMfaEnabled(false);
    setFactorId(null);
  }

  function copiarSecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Autenticação em 2 Fatores</span>
          <span className="block text-[11px] text-primary-foreground/80">2FA — TOTP (Google Authenticator, Authy)</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {loading ? (
          <div className="rdo-card py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : step === "status" ? (
          <>
            {/* Status atual */}
            <div className={`rdo-card flex items-center gap-4 ${mfaEnabled ? "border-green-500/30 bg-green-50/50" : "border-amber-500/30 bg-amber-50/50"}`}>
              {mfaEnabled
                ? <ShieldCheck className="w-10 h-10 text-green-600 shrink-0" />
                : <Shield className="w-10 h-10 text-amber-500 shrink-0" />}
              <div>
                <p className="font-display font-bold text-sm">{mfaEnabled ? "2FA Ativo" : "2FA Inativo"}</p>
                <p className="text-xs text-muted-foreground">
                  {mfaEnabled
                    ? "Sua conta está protegida com autenticação em dois fatores."
                    : "Ative o 2FA para proteger sua conta com uma camada extra de segurança."}
                </p>
              </div>
            </div>

            {!mfaEnabled ? (
              <Button onClick={iniciarSetup} className="w-full h-12 gap-2 font-bold">
                <Shield className="w-4 h-4" /> Ativar 2FA
              </Button>
            ) : (
              <Button variant="outline" onClick={desativar2FA} disabled={unenrolling}
                className="w-full h-12 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
                {unenrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                Desativar 2FA
              </Button>
            )}

            <div className="rdo-card space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Como funciona:</p>
              <p>1. Você ativa o 2FA escaneando um QR Code com um app autenticador</p>
              <p>2. A cada login, além da senha, você digita o código de 6 dígitos gerado pelo app</p>
              <p>3. Apps recomendados: <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>Microsoft Authenticator</strong></p>
            </div>
          </>
        ) : (
          <>
            {/* Setup — QR Code */}
            <div className="rdo-card space-y-4">
              <p className="text-sm font-display font-bold text-primary">Passo 1 — Escanear QR Code</p>
              <p className="text-xs text-muted-foreground">Abra o app autenticador e escaneie o QR Code abaixo:</p>

              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-xl border border-border">
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
              )}

              {secret && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ou insira a chave manualmente:</p>
                  <div className="flex gap-2 items-center bg-muted rounded-lg px-3 py-2">
                    <code className="text-xs font-mono flex-1 break-all">{secret}</code>
                    <button onClick={copiarSecret} className="text-primary shrink-0">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rdo-card space-y-3">
              <p className="text-sm font-display font-bold text-primary">Passo 2 — Confirmar código</p>
              <p className="text-xs text-muted-foreground">Digite o código de 6 dígitos gerado pelo app:</p>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl"
                autoFocus
              />
              <Button
                onClick={confirmarCodigo}
                disabled={code.length !== 6 || verifying}
                className="w-full h-12 gap-2 font-bold"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Confirmar e Ativar
              </Button>
              <Button variant="ghost" onClick={() => { setStep("status"); setQrCode(null); setSecret(null); setCode(""); }}
                className="w-full text-muted-foreground text-xs">
                Cancelar
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
