import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefeicoesHome from './RefeicoesHome';

const state = vi.hoisted(() => ({
  manager: true, permission: true, superAdmin: false, companyId: 'company-1' as string | null,
  order: null as null | Record<string, unknown>,
  people: [] as Array<{employee_id:string;employee_name:string;team_name:string;active:boolean}>,
  calls: [] as Array<{name:string;args:Record<string,unknown>}>,
  employees: [
    {id:'employee-1',name:'Ana',equipe:'Manutenção',matricula:'1'},
    {id:'employee-2',name:'Beto',equipe:'Logística',matricula:'2'},
  ],
}));
const toast = vi.fn();
vi.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => ({profile:{company_id:state.companyId},loading:false}) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({permissions:{modulo_refeicoes:state.permission,refeicoes_gestor:state.manager},loading:false}) }));
vi.mock('@/hooks/useCompanyModules', () => ({ useCompanyModules: () => ({isSuperAdmin:state.superAdmin,loading:false}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({toast}) }));
vi.mock('@/components/ProgramacoesDoDia', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table:string) => {
    const query = {select:()=>query,eq:()=>query,order:()=>query,range:()=>query,
      maybeSingle:async()=>({data:table==='meal_orders'?state.order:null,error:null}),
      then: (resolve:(x:unknown)=>void)=>resolve({data:table==='companies'?[{id:'company-1',name:'Fremix Pavimentação'}]:state.people.filter(p=>p.active),error:null})};
    return query;
  },
  rpc: async (name:string,args:Record<string,unknown>) => {
    state.calls.push({name,args});
    if(name==='meals_list_employees') return {data:state.employees,error:null};
    if(name==='meals_save_draft') {
      state.order={id:'order-1',supplier:'Luana – Sabor Delícia',status:'rascunho',closed_at:null,delivered_quantity:null,delivery_note:null};
      state.people=state.employees.filter(e=>(args.p_employee_ids as string[]).includes(e.id)).map(e=>({employee_id:e.id,employee_name:e.name,team_name:e.equipe,active:true}));
    }
    if(name==='meals_close' && state.order) state.order={...state.order,status:'fechado'};
    if(name==='meals_deliver' && state.order) state.order={...state.order,status:'entregue',delivered_quantity:args.p_quantity,delivery_note:args.p_note};
    return {data:null,error:null};
  }
} }));
afterEach(()=>{cleanup();state.manager=true;state.permission=true;state.superAdmin=false;state.companyId='company-1';state.order=null;state.people=[];state.calls=[];toast.mockClear();});
const open = () => render(<MemoryRouter><RefeicoesHome /></MemoryRouter>);

describe('WF Refeições',()=>{
  it('seleciona nominalmente, salva, fecha e exige justificativa na entrega divergente',async()=>{
    vi.spyOn(window,'confirm').mockReturnValue(true);
    open();
    await screen.findByText('Ana');
    fireEvent.click(screen.getByLabelText(/Ana/));
    fireEvent.click(screen.getByText('Salvar rascunho'));
    await waitFor(()=>expect(state.calls.some(c=>c.name==='meals_save_draft')).toBe(true));
    expect(state.calls.find(c=>c.name==='meals_save_draft')?.args.p_employee_ids).toEqual(['employee-1']);
    await waitFor(()=>expect(screen.getByText('Fechar pedido')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Fechar pedido'));
    await screen.findByText('Copiar mensagem para fornecedor');
    expect(screen.getByText(/TOTAL: 1 marmitas/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantidade recebida'),{target:{value:'0'}});
    expect(screen.getByText('Registrar entrega')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Observação / justificativa da diferença'),{target:{value:'Não entregue'}});
    fireEvent.click(screen.getByText('Registrar entrega'));
    await waitFor(()=>expect(state.calls.some(c=>c.name==='meals_deliver')).toBe(true));
    expect(state.calls.find(c=>c.name==='meals_deliver')?.args.p_quantity).toBe(0);
  });
  it('usuário sem perfil de gestor não fecha pedido',async()=>{
    state.manager=false;
    state.order={id:'order-1',supplier:'Luana – Sabor Delícia',status:'rascunho',closed_at:null,delivered_quantity:null,delivery_note:null};
    state.people=[{employee_id:'employee-1',employee_name:'Ana',team_name:'Manutenção',active:true}];
    open();
    await screen.findByText('Ana');
    await screen.findByText('O gestor de refeições fecha o pedido após conferir as equipes.');
    expect(screen.queryByText('Fechar pedido')).toBeNull();
  });
  it('superadmin sem empresa no perfil seleciona explicitamente a Fremix',async()=>{
    state.superAdmin=true; state.companyId=null; state.permission=false; state.manager=false;
    open();
    await screen.findByText('Fremix Pavimentação');
    fireEvent.change(screen.getByLabelText('Empresa'),{target:{value:'company-1'}});
    await screen.findByText('Ana');
    expect(state.calls.find(c=>c.name==='meals_list_employees')?.args.p_company_id).toBe('company-1');
  });
});
