import {describe,it,expect,afterEach,vi} from 'vitest';
vi.mock('@/hooks/useHubAccess',()=>({useHubAccess:()=>({})}));
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {WorkspaceShell} from './WorkspaceShell';
import {HUB_MODULES} from '@/config/navigation';
afterEach(cleanup);
function Current(){const l=useLocation();return <output>{l.pathname}{l.search}</output>}
describe('Menu lateral — contexto atual',()=>{
 it('não limpa a busca ao clicar no módulo já aberto',()=>{
  const access={modules:HUB_MODULES.filter(m=>m.id==='relatorios'),loading:false,semPerfil:false,isSuperAdmin:false,companyLogo:null};
  render(<MemoryRouter initialEntries={['/relatorios?buscar=pavimentacao&restore=1']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><WorkspaceShell access={access}><Current/></WorkspaceShell></MemoryRouter>);
  fireEvent.click(screen.getByRole('link',{name:'WF Relatórios'}));
  expect(screen.getByRole('status')).toHaveTextContent('/relatorios?buscar=pavimentacao&restore=1');
  fireEvent.click(screen.getByRole('link',{name:'Início'}));
  expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
 });
});
