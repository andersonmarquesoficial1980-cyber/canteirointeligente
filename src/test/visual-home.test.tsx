import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Home from '@/pages/Home';

const session = vi.hoisted(() => ({ admin: false, superAdmin: false, permissions: {} as Record<string, boolean>, allowed: true }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: session.admin }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ permissions: session.permissions, loading: false, semPerfil: false }) }));
vi.mock('@/hooks/useCompanyModules', () => ({ useCompanyModules: () => ({ hasModule: () => session.allowed, loading: false, isSuperAdmin: session.superAdmin, companyLogo: null }) }));
vi.mock('@/hooks/usePushNotifications', () => ({ usePushNotifications: () => ({ requestPermission: vi.fn(), isSupported: false, isSubscribed: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
vi.mock('@/components/Spotlight', () => ({ Spotlight: () => <button type="button" className="w-full rounded-lg border border-input bg-card px-4 py-3 text-left text-sm text-muted-foreground">Buscar frota, funcionário, OGS…</button> }));
afterEach(() => {cleanup(); session.admin=false; session.superAdmin=false; session.permissions={}; session.allowed=true;});
function RouteProbe() { return <output data-testid="route">{useLocation().pathname}</output>; }
function mount() {return render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Home/><RouteProbe/></MemoryRouter>);}

describe('Home — primeiro lote visual preserva o acesso', () => {
 it('usa cards neutros sem escala, glow ou sombra pesada', async () => {
  session.permissions={is_admin:true}; const {container}=mount();
  await screen.findByRole('button',{name:/WF Obras/});
  expect(container.querySelector('.animate-float')).toBeNull();
  expect(container.querySelector('.shadow-xl')).toBeNull();
  const obras=screen.getByRole('button',{name:/WF Obras/});
  expect(obras.className).toContain('bg-card');
  expect(obras.className).not.toContain('hover:scale');
  if(process.env.VISUAL_EXPORT){const dir=path.resolve(process.cwd(),'visual-export');mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'home.html'),container.innerHTML);}
 });
 it('preserva o módulo autorizado e não mostra outros para operador', async () => {
  session.permissions={modulo_obras:true}; mount();
  const obras=await screen.findByRole('button',{name:/WF Obras/});
  expect(screen.queryByRole('button',{name:/WF Abastecimento/})).toBeNull();
  expect(screen.queryByRole('button',{name:/Painel de Controle/})).toBeNull();
  fireEvent.click(obras); expect(screen.getByTestId('route')).toHaveTextContent('/obras');
 });
 it('mantém filtro de módulos contratados mesmo para admin da empresa', async () => {
  session.permissions={is_admin:true};session.allowed=false;mount();
  await waitFor(()=>expect(document.querySelector('.animate-pulse')).toBeNull());
  expect(screen.queryByRole('button',{name:/WF Obras/})).toBeNull();
 });
});
