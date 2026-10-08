import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import RelatoriosHome from '@/pages/RelatoriosHome';
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:async()=>({data:{user:null}})},from:()=>{const q:any={select:()=>q,order:()=>q,then:(fn:any)=>Promise.resolve(fn({data:[]}))};return q;}}}));
vi.mock('@/hooks/useEquipamentoTipos',()=>{const categorias:unknown[]=[];return {useEquipamentoTipos:()=>({categorias})};});
vi.mock('@/hooks/useSmartBack',()=>({useSmartBack:()=>vi.fn()}));
vi.mock('@/hooks/useNavigationTrail',()=>({useNavigationTrail:()=>({trail:[],goTo:vi.fn()})}));
vi.mock('@/components/navigation/NavigationTrail',()=>({NavigationTrail:()=> <nav className="text-sm text-white">Home / WF Relatórios</nav>}));
vi.mock('@/components/dashboard/AdvancedReports',()=>({default:()=>null}));
afterEach(cleanup);
function RouteProbe(){return <output data-testid="route">{useLocation().pathname}{useLocation().search}</output>}
describe('Relatórios — ícones e navegação',()=>{
 it('mantém os relatórios, com ícones vetoriais em vez de emojis',async()=>{
 const {container}=render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><RelatoriosHome/><RouteProbe/></MemoryRouter>);
 const equipamentos=await screen.findByRole('button',{name:/Equipamentos.*Diário/});
 expect(equipamentos.querySelector('svg')).not.toBeNull();
 expect(equipamentos.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
 expect(screen.getByRole('button',{name:/Dashboards Obras/})).toBeTruthy();
 expect(screen.getByRole('button',{name:/Equipamentos Personalizado/})).toBeTruthy();
 if(process.env.VISUAL_EXPORT){const dir=path.resolve(process.cwd(),'visual-export');mkdirSync(dir,{recursive:true});writeFileSync(path.join(dir,'relatorios.html'),container.innerHTML);}
 fireEvent.click(screen.getByRole('button',{name:/Dashboards Obras/}));
 expect(screen.getByTestId('route').textContent).toContain('/relatorios/dashboards-obras?returnTo=');
 });
});
