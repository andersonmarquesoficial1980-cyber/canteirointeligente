import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Mail, Lock, ArrowLeft, User, Eye, EyeOff, Building2, ChevronDown } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

// Domínio padrão — usado enquanto empresas carregam ou se só há uma empresa
const LOGIN_DOMAIN_DEFAULT = "@workflux.app";

interface CompanyOption {
  id: string;
  name: string;
  login_domain: string;
}
// Legado localStorage — mantido só para limpar entradas antigas
const LOGIN_ATTEMPTS_KEY = "wf_login_attempts";
const LOGIN_BLOCKED_UNTIL_KEY = "wf_login_blocked_until";
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION_MINUTES = 5;

export default function Login() {
  const { toast } = useToast();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Controle de bloqueio agora é server-side (tabela login_blocks)
  const [blockedUntil, setBlockedUntil] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  // Multi-empresa
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Domínio ativo baseado na empresa selecionada
  // Se só tem 1 empresa (caso Fremix), usa ela direto mesmo sem seleção explícita
  const activeDomain = useMemo(() => {
    const c = companies.find(c => c.id === selectedCompanyId) || (companies.length === 1 ? companies[0] : null);
    return c?.login_domain ? `@${c.login_domain}` : LOGIN_DOMAIN_DEFAULT;
  }, [companies, selectedCompanyId]);

  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [companies, selectedCompanyId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    // Limpar localStorage legado
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    localStorage.removeItem(LOGIN_BLOCKED_UNTIL_KEY);
    return () => window.clearInterval(interval);
  }, []);

  // Carregar empresas ativas
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, login_domain")
        .eq("status", "ativo")
        .order("name");
      const list: CompanyOption[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        login_domain: c.login_domain || "workflux.app",
      }));
      setCompanies(list);
      // Se só houver uma empresa, seleciona automaticamente
      if (list.length === 1) setSelectedCompanyId(list[0].id);
      setLoadingCompanies(false);
    };
    load();
  }, []);

  const isBlocked = blockedUntil !== null && blockedUntil.getTime() > now;
  const blockedMinutes = useMemo(() => {
    if (!isBlocked || !blockedUntil) return 0;
    return Math.max(1, Math.ceil((blockedUntil.getTime() - now) / 60000));
  }, [blockedUntil, isBlocked, now]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;

    setLoading(true);
    try {
      const input = login.trim().toLowerCase();
      const authEmail = input.includes("@") ? input : `${input}${activeDomain}`;

      // Verificar bloqueio server-side antes de tentar
      const { data: blockRow } = await (supabase as any)
        .from("login_blocks")
        .select("attempts, blocked_until")
        .eq("email", authEmail)
        .maybeSingle();

      if (blockRow?.blocked_until && new Date(blockRow.blocked_until) > new Date()) {
        const mins = Math.max(1, Math.ceil((new Date(blockRow.blocked_until).getTime() - Date.now()) / 60000));
        setBlockedUntil(new Date(blockRow.blocked_until));
        toast({ title: "Login bloqueado", description: `Muitas tentativas. Aguarde ${mins} minuto${mins === 1 ? "" : "s"}.`, variant: "destructive" });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });

      if (error) {
        // Registrar tentativa falha no banco
        const currentAttempts = (blockRow?.attempts || 0) + 1;
        const shouldBlock = currentAttempts >= MAX_LOGIN_ATTEMPTS;
        const blockedUntilDate = shouldBlock
          ? new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000).toISOString()
          : null;

        await (supabase as any).from("login_blocks").upsert(
          { email: authEmail, attempts: currentAttempts, blocked_until: blockedUntilDate, last_attempt_at: new Date().toISOString() },
          { onConflict: "email" }
        );

        if (shouldBlock) {
          setBlockedUntil(new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000));
          toast({ title: "Login bloqueado", description: `Muitas tentativas. Aguarde ${BLOCK_DURATION_MINUTES} minutos.`, variant: "destructive" });
        } else {
          const restantes = Math.max(0, MAX_LOGIN_ATTEMPTS - currentAttempts);
          toast({ title: "Erro no login", description: `Senha incorreta. ${restantes} tentativa${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}.`, variant: "destructive" });
        }
        throw error;
      }

      // Login OK — zerar tentativas
      await (supabase as any).from("login_blocks").upsert(
        { email: authEmail, attempts: 0, blocked_until: null, last_attempt_at: new Date().toISOString() },
        { onConflict: "email" }
      );
      setBlockedUntil(null);
    } catch {
      // erros já tratados acima
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo });
      if (error) throw error;
      setResetSent(true);
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const cardContent = forgotMode ? (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { setForgotMode(false); setResetSent(false); }}
          className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </button>
        <h1 className="text-xl font-display font-extrabold tracking-widest uppercase text-foreground">
          Recuperar Senha
        </h1>
        <div className="mx-auto h-1 w-16 rounded-full" style={{ background: "hsl(var(--primary))" }} />
      </div>

      {resetSent ? (
        <div className="text-center space-y-3 py-4">
          <Mail className="w-12 h-12 text-primary mx-auto" />
          <p className="text-sm text-foreground font-semibold">
            Link de recuperação enviado para:
          </p>
          <p className="text-sm text-muted-foreground font-medium">{resetEmail}</p>
          <p className="text-xs text-muted-foreground">
            Verifique sua caixa de entrada e spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Digite o e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Mail className="w-4 h-4 text-primary" /> Email
            </Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="seu@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            disabled={resetLoading}
          >
            <Mail className="w-5 h-5" />
            {resetLoading ? "Enviando..." : "Enviar Link"}
          </Button>
        </form>
      )}
    </>
  ) : (
    <>
      {isBlocked && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
          Muitas tentativas. Aguarde {blockedMinutes} minuto{blockedMinutes === 1 ? "" : "s"} para tentar novamente.
        </div>
      )}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-display font-extrabold tracking-widest uppercase text-foreground">
          Acesso ao Sistema
        </h1>
        <div className="mx-auto h-1 w-16 rounded-full" style={{ background: "hsl(var(--primary))" }} />
      </div>

      <form onSubmit={handleAuth} className="space-y-5">

        {/* Seletor de Empresa — exibe quando há mais de uma empresa */}
        {!loadingCompanies && companies.length > 1 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Building2 className="w-4 h-4 text-primary" /> Empresa
            </Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCompanyDropdown(v => !v)}
                className="w-full h-12 bg-secondary border border-border rounded-xl px-3 flex items-center justify-between text-sm font-medium text-foreground"
              >
                <span className={selectedCompany ? "text-foreground" : "text-muted-foreground"}>
                  {selectedCompany ? selectedCompany.name : "Selecione sua empresa..."}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showCompanyDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-border shadow-lg overflow-hidden">
                  {companies.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCompanyId(c.id); setShowCompanyDropdown(false); }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 border-b border-border last:border-0 ${
                        selectedCompanyId === c.id ? "text-primary font-bold bg-primary/5" : "text-foreground"
                      }`}
                    >
                      {c.name}
                      <span className="block text-[10px] text-muted-foreground font-normal">@{c.login_domain}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="login" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <User className="w-4 h-4 text-primary" /> Login
          </Label>
          <Input
            id="login"
            type="text"
            placeholder="usuario ou email@empresa.com"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Lock className="w-4 h-4 text-primary" /> Senha
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary accent-primary"
          />
          <span className="text-sm text-muted-foreground">Lembrar de mim</span>
        </label>

        <Button
          type="submit"
          className="w-full h-14 gap-2 text-base font-extrabold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          disabled={loading}
        >
          <LogIn className="w-5 h-5" />
          {loading ? "Aguarde..." : "Entrar"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setForgotMode(true)}
        className="block w-full text-center text-sm text-primary font-semibold hover:underline"
      >
        Esqueci minha senha
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Contate o administrador para obter suas credenciais.
      </p>
    </>
  );

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
        {cardContent}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-primary-foreground/70 tracking-wide">
        Fremix Pavimentação © 2026 — Powered by Workflux
      </p>
    </div>
  );
}
