import { supabase } from "@/integrations/supabase/client";

/**
 * Cache de dados de sessão (perfil, permissões, módulos da empresa).
 *
 * Antes, cada rota remontava os hooks de acesso e refazia 5–7 consultas em
 * sequência (auth.getUser → profiles → company_modules → user_permissions).
 * Aqui os resultados ficam em memória por usuário, com TTL curto, e consultas
 * simultâneas são compartilhadas (uma só ida ao servidor).
 *
 * Segurança: isto é só desempenho de interface. O controle real de acesso
 * continua sendo o RLS do banco, que não passa por este cache.
 */

const TTL_MS = 60_000;

type Entry = { at: number; value?: unknown; promise?: Promise<unknown> };

const store = new Map<string, Entry>();
let userEntry: { at: number; id: string | null; promise?: Promise<string | null> } | null = null;

export function clearSessionCache() {
  store.clear();
  userEntry = null;
}

// Troca de usuário (logout, login, impersonação) invalida tudo.
try {
  const auth: any = (supabase as any)?.auth;
  if (typeof auth?.onAuthStateChange === "function") {
    auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        clearSessionCache();
      }
    });
  }
} catch {
  /* ambientes de teste sem auth completo */
}

/** id do usuário logado; uma única chamada ao servidor por janela de TTL. */
export function getUserId(): Promise<string | null> {
  const now = Date.now();
  if (userEntry && now - userEntry.at < TTL_MS) {
    return userEntry.promise ?? Promise.resolve(userEntry.id);
  }
  const entry: NonNullable<typeof userEntry> = { at: now, id: null };
  entry.promise = (async () => {
    const { data } = await supabase.auth.getUser();
    entry.id = data?.user?.id ?? null;
    return entry.id;
  })();
  entry.promise.catch(() => {
    if (userEntry === entry) userEntry = null;
  });
  userEntry = entry;
  return entry.promise;
}

/** Valor já resolvido e ainda fresco (leitura síncrona, evita "Carregando..."). */
export function peekCached<T>(key: string): T | undefined {
  const e = store.get(key);
  if (e && e.value !== undefined && Date.now() - e.at < TTL_MS) return e.value as T;
  return undefined;
}

/** Busca com cache por chave; chamadas concorrentes compartilham a mesma promessa. */
export function cachedFetch<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < TTL_MS) {
    if (hit.value !== undefined) return Promise.resolve(hit.value as T);
    if (hit.promise) return hit.promise as Promise<T>;
  }
  const entry: Entry = { at: now };
  entry.promise = loader().then(
    (v) => {
      entry.value = v;
      entry.promise = undefined;
      return v;
    },
    (err) => {
      if (store.get(key) === entry) store.delete(key);
      throw err;
    },
  );
  store.set(key, entry);
  return entry.promise as Promise<T>;
}

/** Chave só é válida depois que o id do usuário é conhecido. */
export function peekForUser<T>(name: string): T | undefined {
  if (!userEntry?.id) return undefined;
  return peekCached<T>(`${name}:${userEntry.id}`);
}
