import { supabase } from '@/integrations/supabase/client';

const PRIVATE_BUCKETS = new Set([
  'notas_fiscais', 'ci-documentos', 'sst-fotos', 'checklist-fotos',
  'face-photos', 'exports', 'manutencao-docs',
]);
const STORAGE_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

/** Stored URLs are references, never durable bearer credentials. */
export function getStorageReference(value?: string | null): { bucket: string; path: string } | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.origin !== STORAGE_ORIGIN) return null;
  const match = url.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!match || !PRIVATE_BUCKETS.has(match[1])) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/** Resolve only when displaying/downloading; never persist the signed result. */
export async function resolveStorageUrl(value: string): Promise<string> {
  const ref = getStorageReference(value);
  if (!ref) return value;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Entre novamente para abrir este anexo.');
  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 300);
  if (error || !data?.signedUrl) throw new Error('Não foi possível autorizar a abertura deste anexo.');
  const { data: { session: current } } = await supabase.auth.getSession();
  if (!current || current.user.id !== session.user.id) throw new Error('A sessão mudou. Abra o anexo novamente.');
  return data.signedUrl;
}
