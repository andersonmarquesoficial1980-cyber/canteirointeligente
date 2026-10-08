import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {DesktopHome} from './DesktopHome';
import {HUB_MODULES} from '@/config/navigation';
const identity=vi.hoisted(()=>({user:'user-a',company:'company-a'}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:identity.user}}})},from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{company_id:identity.company}})};return q;}}}));
vi.mock('@/hooks/useHubAccess',()=>({useHubAccess:()=>({})}));
vi.mock('@/components/Spotlight',()=>({Spotlight:()=> <button>Busca global</button>}));
const access={modules:[...HUB_MODULES],loading:false,semPerfil:false,isSuperAdmin:false,companyLogo:null};
function Location(){return <output data-testid="route">{useLocation().pathname}</output>}
function mount(modules=access.modules){return render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><DesktopHome access={{...access,modules}} onLogout={()=>{}} loggingOut={false}/><Location/></MemoryRouter>)}
afterEach(()=>{cleanup();localStorage.clear();identity.user='user-a';identity.company='company-a';vi.restoreAllMocks();});
describe('Meus atalhos — Home desktop',()=>{
 it('limita a seis atalhos para não recriar o catálogo central',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Personalizar atalhos'}));
  const boxes=screen.getAllByRole('checkbox');boxes.slice(0,6).forEach(box=>fireEvent.click(box));
  expect(boxes[6]).toBeDisabled();
  expect(boxes[0]).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Salvar atalhos'}));
  expect(within(screen.getByRole('region',{name:'Meus atalhos'})).getAllByRole('button').length).toBe(7);
 });
 it('cancela alterações sem mudar os atalhos salvos',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Personalizar atalhos'}));fireEvent.click(screen.getByRole('checkbox',{name:/WF Obras/}));fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
  expect(screen.queryByRole('button',{name:/WF Obras/})).toBeNull();
 });
 it('não mostra atalhos sem permissão e não mistura usuários ou empresas',async()=>{
  localStorage.setItem('wf:workspace-shortcuts:v1:company-a:user-a',JSON.stringify(['obras','admin','inexistente']));
  let view=mount(access.modules.filter(m=>m.id==='obras'));
  expect(await screen.findByRole('button',{name:/WF Obras/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Painel de Controle/})).toBeNull();
  view.unmount();identity.user='user-b';view=mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());expect(screen.queryByRole('button',{name:/WF Obras/})).toBeNull();
  view.unmount();identity.user='user-a';identity.company='company-b';mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());expect(screen.queryByRole('button',{name:/WF Obras/})).toBeNull();
 });
 it('informa falha de armazenamento sem fingir que salvou',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Personalizar atalhos'}));fireEvent.click(screen.getByRole('checkbox',{name:/WF Obras/}));
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});fireEvent.click(screen.getByRole('button',{name:'Salvar atalhos'}));
  expect(screen.getByRole('alert')).toHaveTextContent('não foi salva');expect(screen.getByRole('button',{name:'Salvar atalhos'})).toBeInTheDocument();
 });
 it('começa sem repetir o catálogo e salva somente os atalhos escolhidos',async()=>{
  const view=mount();
  expect(screen.getByRole('heading',{name:'Meus atalhos'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/WF Obras/})).toBeNull();
  expect(screen.getByRole('link',{name:'WF Obras'})).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Personalizar atalhos'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Personalizar atalhos'}));
  fireEvent.click(screen.getByRole('checkbox',{name:/WF Obras/}));
  fireEvent.click(screen.getByRole('button',{name:'Salvar atalhos'}));
  fireEvent.click(screen.getByRole('button',{name:/WF Obras/}));
  expect(screen.getByTestId('route')).toHaveTextContent('/obras');
  view.unmount();mount();
  expect(await screen.findByRole('button',{name:/WF Obras/})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/WF Abastecimento/})).toBeNull();
 });
});
