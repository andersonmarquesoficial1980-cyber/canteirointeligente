import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceShortcuts } from "@/hooks/useWorkspaceShortcuts";
import { ArrowUpRight, LogOut, Search, Star, Settings2 } from "lucide-react";
import type { HubAccess } from "@/hooks/useHubAccess";
import { WorkspaceShell } from "./WorkspaceShell";
import { Spotlight } from "@/components/Spotlight";

export function DesktopHome({ access, onLogout, loggingOut }: { access: HubAccess; onLogout: () => void; loggingOut: boolean }) {
  const navigate = useNavigate();
  const shortcuts = useWorkspaceShortcuts();
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState<string[]>([]);
  const [query,setQuery] = useState('');
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const chosen = access.modules.filter(mod => shortcuts.ids.includes(mod.id)).slice(0,6);
  const options = access.modules.filter(mod => normalize(`${mod.label} ${mod.subtitle}`).includes(normalize(query)));
  const openEditor = () => { setDraft(chosen.map(mod=>mod.id)); setQuery(''); setEditing(true); };
  const save = () => { if(shortcuts.save(draft.filter(id=>access.modules.some(mod=>mod.id===id)).slice(0,6))) setEditing(false); };
  return <WorkspaceShell access={access}>
    <header className="flex items-center justify-between gap-6 border-b border-border bg-background px-8 py-4">
      <span className="text-sm font-medium text-muted-foreground">Início / Área de trabalho</span>
      <div className="flex items-center gap-5 min-w-0">
        <div className="w-72"><Spotlight /></div>
        <button type="button" onClick={onLogout} disabled={loggingOut} className="flex gap-2 items-center min-h-11 px-3 text-sm rounded-md hover:bg-muted disabled:opacity-50"><LogOut className="w-4 h-4" />{loggingOut ? 'Saindo…' : 'Sair'}</button>
      </div>
    </header>
    <main className="px-8 py-8 max-w-[1680px] mx-auto">
      <div className="flex justify-between items-start gap-8 mb-8">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Campo e gestão</p><h1 className="text-3xl font-semibold tracking-tight">Sua área de trabalho</h1><p className="text-muted-foreground mt-2">Seus acessos mais usados em um só lugar. Todos os módulos continuam no menu lateral.</p></div>
        {access.companyLogo && <img src={access.companyLogo} alt="Cliente" className="max-w-40 max-h-16 object-contain" />}
      </div>
      {access.semPerfil && !access.loading && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 mb-6">Acesso pendente de configuração. Entre em contato com o administrador da sua empresa.</div>}
      <section aria-label="Meus atalhos">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div><h2 className="text-lg font-semibold">Meus atalhos</h2><p className="mt-1 text-sm text-muted-foreground">Escolha até 6 acessos que fazem parte da sua rotina.</p></div>
          <button type="button" onClick={openEditor} disabled={access.loading || !shortcuts.ready || editing} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><Settings2 className="h-4 w-4" aria-hidden="true" />Personalizar atalhos</button>
        </div>
        {shortcuts.error && <p role="alert" className="mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm">{shortcuts.error}</p>}
        {editing ? <section aria-label="Personalizar atalhos" className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4 mb-4"><h3 className="font-semibold">Escolha seus atalhos</h3><span role="status" className="text-sm text-muted-foreground">{draft.length} de 6 selecionados</span></div>
          <label className="relative block max-w-xl mb-5"><span className="sr-only">Buscar módulo</span><Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" /><input type="search" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar módulo…" className="w-full h-12 pl-12 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></label>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2">
            {options.map(mod=><label key={mod.id} className="flex gap-3 items-center min-h-14 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent/40"><input type="checkbox" disabled={!draft.includes(mod.id) && draft.length >= 6} checked={draft.includes(mod.id)} onChange={e=>setDraft(current=>e.target.checked?[...current,mod.id].slice(0,6):current.filter(id=>id!==mod.id))} className="h-4 w-4 accent-primary" /><span className="text-sm">{mod.label}</span></label>)}
          </div>
          {!options.length && <p className="text-sm text-muted-foreground py-4">Nenhum módulo encontrado para esta busca.</p>}
          <div className="mt-6 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Preferência deste usuário neste navegador.</p><div className="flex gap-3"><button type="button" onClick={()=>setEditing(false)} className="min-h-11 px-4 rounded-lg border border-border hover:bg-muted">Cancelar</button><button type="button" onClick={save} className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90">Salvar atalhos</button></div></div>
        </section> : <>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4" data-shortcuts-grid>
            {access.loading ? <p role="status">Carregando acessos…</p> : chosen.map(mod => <button key={mod.id} type="button" onClick={() => navigate(mod.route)} className="group flex items-start gap-4 min-h-28 text-left p-5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <span className="bg-accent rounded-lg p-3 shrink-0"><mod.icon className="w-5 h-5 text-primary" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{mod.label}</span><span className="block text-sm text-muted-foreground mt-2">{mod.subtitle}</span></span><ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </button>)}
          </div>
          {!access.loading && !chosen.length && <div className="rounded-xl border border-dashed border-border bg-card px-8 py-10"><Star className="w-7 h-7 text-primary mb-4" aria-hidden="true" /><h3 className="font-semibold">Uma Home com o que você realmente usa</h3><p className="text-muted-foreground mt-2 text-sm max-w-xl">Use “Personalizar atalhos” para escolher seus acessos. Enquanto isso, navegue pelo menu lateral ou use a busca global no topo.</p></div>}
        </>}
      </section>
    </main>
  </WorkspaceShell>;
}
