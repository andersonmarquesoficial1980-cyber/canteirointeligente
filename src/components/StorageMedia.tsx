import { useEffect, useState, type ImgHTMLAttributes, type AnchorHTMLAttributes } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStorageReference, resolveStorageUrl } from '@/lib/storageAccess';

function useStorageUrl(source?: string) {
  const privateFile = Boolean(getStorageReference(source));
  const [state, setState] = useState<{ source?: string; url?: string; error?: string }>({});
  useEffect(() => {
    if (!privateFile || !source) return;
    let active = true;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      generation++;
      clearTimeout(timer);
      setState({ source });
    };
    const refresh = async () => {
      const current = ++generation;
      try {
        const url = await resolveStorageUrl(source);
        if (!active || current !== generation) return;
        setState({ source, url });
        timer = setTimeout(refresh, 240_000);
      } catch (e) {
        if (active && current === generation) {
          setState({ source, error: e instanceof Error ? e.message : 'Anexo indisponível' });
        }
      }
    };
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Do not call async Supabase auth methods from inside this callback.
      if (event === 'INITIAL_SESSION') return;
      clear();
      if (session) timer = setTimeout(() => { void refresh(); }, 0);
    });
    return () => { active = false; generation++; clearTimeout(timer); subscription.unsubscribe(); };
  }, [source, privateFile]);
  if (!privateFile) return { url: source, error: undefined };
  return state.source === source ? state : { url: undefined, error: undefined };
}

export function StorageImage({ src, title, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { url, error } = useStorageUrl(src);
  return <img {...props} src={url} title={error || title} />;
}

export function StorageLink({ href, title, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { url, error } = useStorageUrl(href);
  return <a {...props} href={url} title={error || title} aria-disabled={Boolean(href && !url)}
    onClick={event => {
      if (href && !url) { event.preventDefault(); return; }
      onClick?.(event);
    }} />;
}
