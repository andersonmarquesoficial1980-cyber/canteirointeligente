/**
 * Monitoramento de erros (Sentry).
 *
 * - Só liga se VITE_SENTRY_DSN estiver definido (sem DSN = nenhum efeito, nenhum envio).
 * - Carrega o SDK sob demanda, depois da primeira renderização, para não pesar no início.
 * - Privacidade (o app guarda CPF, salários, fotos): sem replay de sessão, sem PII
 *   automática, sem corpo de requisições, e mensagens/URLs passam por limpeza antes do envio.
 */

type SentryModule = typeof import("@sentry/react");
let sentry: SentryModule | null = null;
let pendingUser: { id: string; companyId?: string | null } | null | undefined;

const IGNORAR = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Failed to fetch dynamically imported module/i, // deploy novo: o ErrorBoundary já recarrega
  /Importing a module script failed/i,
  /is not a valid JavaScript MIME type/i,
  /error loading dynamically imported module/i,
  /Load failed/i, // Safari sem rede
  /NetworkError when attempting to fetch resource/i,
  /AbortError/i,
];

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function limpar(texto?: string | null): string | undefined {
  if (!texto) return texto ?? undefined;
  return texto.replace(JWT, "[token]").replace(CPF, "[cpf]").replace(EMAIL, "[email]");
}

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || import.meta.env.DEV) return;

  import("@sentry/react")
    .then((mod) => {
      mod.init({
        dsn,
        environment: "production",
        release: (import.meta.env.VITE_APP_RELEASE as string | undefined) || undefined,
        tracesSampleRate: 0,
        maxBreadcrumbs: 30,
        ignoreErrors: IGNORAR,
        beforeBreadcrumb(b) {
          // não guardar corpo/URL de consultas ao banco (podem conter dados pessoais)
          if (b.category === "fetch" || b.category === "xhr") {
            return { ...b, data: { method: b.data?.method, status_code: b.data?.status_code } };
          }
          if (b.category === "console") return null;
          return b;
        },
        beforeSend(event) {
          if (event.message) event.message = limpar(event.message);
          event.exception?.values?.forEach((v) => {
            v.value = limpar(v.value);
          });
          if (event.request) {
            delete event.request.cookies;
            delete event.request.data;
            delete event.request.headers;
            if (event.request.url) event.request.url = limpar(event.request.url.split("?")[0]);
            delete event.request.query_string;
          }
          return event;
        },
      });
      sentry = mod;
      if (pendingUser !== undefined) setMonitoringUser(pendingUser);
    })
    .catch(() => {
      /* monitoramento nunca pode quebrar o app */
    });
}

/** Identifica só por id interno (sem nome, e-mail ou CPF). `null` = logout. */
export function setMonitoringUser(user: { id: string; companyId?: string | null } | null) {
  if (!sentry) {
    pendingUser = user;
    return;
  }
  if (!user) {
    sentry.setUser(null);
    sentry.setTag("company_id", "");
    return;
  }
  sentry.setUser({ id: user.id });
  if (user.companyId) sentry.setTag("company_id", user.companyId);
}

export function reportError(error: unknown, contexto?: Record<string, string>) {
  try {
    sentry?.captureException(error, contexto ? { tags: contexto } : undefined);
  } catch {
    /* ignora */
  }
}
