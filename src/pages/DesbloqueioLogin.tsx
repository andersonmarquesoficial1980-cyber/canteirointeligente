/**
 * DesbloqueioLogin — Página que limpa o bloqueio local de tentativas de login.
 * Acessada via link enviado pelo admin: /desbloqueio?u=nome_do_usuario
 * Limpa localStorage de tentativas e redireciona para login.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logoCi from "@/assets/logo-workflux.png";

const LOGIN_ATTEMPTS_KEY = "wf_login_attempts";
const LOGIN_BLOCKED_UNTIL_KEY = "wf_login_blocked_until";

export default function DesbloqueioLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const usuario = searchParams.get("u") || "";
  const [done, setDone] = useState(false);

  useEffect(() => {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    localStorage.removeItem(LOGIN_BLOCKED_UNTIL_KEY);
    setDone(true);
    const timer = setTimeout(() => navigate("/"), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ background: "hsl(var(--primary))" }}
    >
      <img src={logoCi} alt="Workflux" className="h-24 object-contain drop-shadow-xl" />

      <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl space-y-4">
        {done ? (
          <>
            <div className="text-5xl">🔓</div>
            <h1 className="text-xl font-extrabold text-foreground">Acesso desbloqueado!</h1>
            {usuario && (
              <p className="text-sm text-muted-foreground">Olá, <strong>{decodeURIComponent(usuario)}</strong>!</p>
            )}
            <p className="text-sm text-muted-foreground">
              Seu acesso foi liberado. Redirecionando para o login...
            </p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary animate-[shrink_2.5s_linear_forwards]"
                style={{ width: "100%", animation: "shrink 2.5s linear forwards" }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl animate-pulse">🔄</div>
            <p className="text-sm text-muted-foreground">Liberando acesso...</p>
          </>
        )}
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
