import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, LogOut, Search } from "lucide-react";
import type { HubAccess } from "@/hooks/useHubAccess";
import { WorkspaceShell } from "./WorkspaceShell";
import { Spotlight } from "@/components/Spotlight";

export function DesktopHome({ access, onLogout, loggingOut }: { access: HubAccess; onLogout: () => void; loggingOut: boolean }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("modulos") || "";
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("modulos", value); else next.delete("modulos");
    setParams(next, { replace: true });
  };
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const visible = access.modules.filter(mod => normalize(`${mod.label} ${mod.subtitle}`).includes(normalize(query)));
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
        <div><p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Campo e gestão</p><h1 className="text-3xl font-semibold tracking-tight">Sua área de trabalho</h1><p className="text-muted-foreground mt-2">Acesse a operação pelo menu lateral ou escolha um módulo abaixo.</p></div>
        {access.companyLogo && <img src={access.companyLogo} alt="Cliente" className="max-w-40 max-h-16 object-contain" />}
      </div>
      {access.semPerfil && !access.loading && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 mb-6">Acesso pendente de configuração. Entre em contato com o administrador da sua empresa.</div>}
      <section aria-label="Módulos disponíveis">
        <div className="flex items-center justify-between gap-4 mb-5"><h2 className="text-lg font-semibold">Módulos disponíveis</h2>{!access.loading && <span className="text-sm text-muted-foreground">{access.modules.length} módulos liberados para você</span>}</div>
        <div className="flex items-center gap-4 mb-6">
          <label className="relative flex-1 max-w-xl"><span className="sr-only">Buscar módulo</span><Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" aria-hidden="true" /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar módulo por nome ou atividade…" className="w-full h-12 rounded-lg border border-input bg-background pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></label>
          {query && <button type="button" onClick={() => setQuery('')} className="min-h-11 px-3 text-sm text-primary rounded-md hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Limpar busca</button>}
          {!access.loading && query && <span role="status" className="text-sm text-muted-foreground">{visible.length} resultados</span>}
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4" data-module-grid>
          {access.loading ? <p role="status">Carregando acessos…</p> : visible.map(mod => <button key={mod.id} type="button" onClick={() => navigate(mod.route)} className="group flex items-start gap-4 min-h-28 text-left p-5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
            <span className="bg-accent rounded-lg p-3 shrink-0"><mod.icon className="w-5 h-5 text-primary" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{mod.label}</span><span className="block text-sm text-muted-foreground mt-2">{mod.subtitle}</span></span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>)}
        </div>
        {!access.loading && !access.modules.length && <p className="rounded-lg border border-border bg-card p-6 text-muted-foreground">Nenhum módulo liberado. Consulte o administrador da sua empresa.</p>}
        {!access.loading && access.modules.length > 0 && !visible.length && <p className="rounded-lg border border-border bg-card p-6 text-muted-foreground">Nenhum módulo encontrado para esta busca.</p>}
      </section>
    </main>
  </WorkspaceShell>;
}
