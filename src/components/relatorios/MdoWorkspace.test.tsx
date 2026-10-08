import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MdoWorkspace } from './MdoWorkspace';
const {rpc,from}=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc,from}}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
const day=(employee_id:string,nome:string,equipe:string,dia:string)=>({employee_id,nome,equipe,dia,matricula:employee_id,funcao:'Auxiliar',status_dia:'ativo',ogs_rdo:'2529',ogs_custos:'2529',disposicao:'ogs',motivo:'',incluido:true,situacao:'ALOCADO',rdo_ids:'rdo-1'});
let period:any;
const grade=[day('p1','José Silva','Equipe A','2026-09-01'),day('p1','José Silva','Equipe A','2026-09-02'),day('p2','Maria','Equipe B','2026-09-01')];
const props={companyId:'empresa',inicio:'2026-09-01',fim:'2026-09-02',access:{edit:true,approve:true,export:true}};
beforeEach(()=>{period={id:'draft',versao:1,status:'rascunho',revisao:60,funcionarios_incluidos:['p1','p2'],colunas:['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos']};rpc.mockReset();window.confirm=vi.fn(()=>true);
 rpc.mockImplementation(async(name,args)=>{
 if(name==='mdo_custos_carregar')return {data:{periodos:[period],grade:grade.map(r=>({...r,incluido:period.funcionarios_incluidos.includes(r.employee_id),situacao:period.funcionarios_incluidos.includes(r.employee_id)?'ALOCADO':'FORA DO RELATÓRIO'})),ogs:[{id:'ogs',ogs_number:'2529'}],assinatura:'hash'},error:null};
 if(name==='mdo_custos_configurar'){period={...period,revisao:61,funcionarios_incluidos:args.p_funcionarios,colunas:args.p_colunas};return {data:61,error:null};}
 if(name==='mdo_custos_listar_acessos')return {data:[],error:null};
 return {data:null,error:null};});});
describe('MDO fluxo de conferência',()=>{
 it('segmenta por nome sem mudar o universo e salva exclusão por pessoa sem apagar ajustes',async()=>{
  render(<MdoWorkspace {...props}/>);
  await screen.findByText('3 funcionário/dia incluídos');
  fireEvent.change(screen.getByRole('textbox',{name:'Buscar na conferência'}),{target:{value:'jose'}});
  expect(within(screen.getByRole('table',{name:'Grade de conferência MDO'})).queryByText('Maria')).toBeNull();
  expect(screen.getByText('3 funcionário/dia incluídos')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Composição do relatório'}));
  fireEvent.click(screen.getByRole('checkbox',{name:/Incluir Maria/}));
  expect(screen.getByRole('button',{name:'Validar e liberar'}).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Salvar composição e colunas'}));
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('mdo_custos_configurar',expect.objectContaining({p_periodo:'draft',p_revisao:60,p_funcionarios:['p1']})));
  await screen.findByText('2 funcionário/dia incluídos');
  expect(rpc.mock.calls.some(c=>c[0]==='mdo_custos_alterar')).toBe(false);
 });
 it('não publica apenas a segmentação visível e exige confirmação de validação',async()=>{
  render(<MdoWorkspace {...props}/>); await screen.findByText('3 funcionário/dia incluídos');
  fireEvent.change(screen.getByRole('textbox',{name:'Buscar na conferência'}),{target:{value:'jose'}});
  fireEvent.click(screen.getByRole('button',{name:'Validar e liberar'}));
  expect(screen.getByText(/A validação abrange 2 funcionários e 3 linhas/)).toBeTruthy();
  expect(rpc.mock.calls.some(c=>c[0]==='mdo_custos_publicar')).toBe(false);
 });
 it('mostra erro de carga e não oferece validação com dados incompletos',async()=>{
  rpc.mockResolvedValue({data:null,error:{message:'Falha de conexão'}});render(<MdoWorkspace {...props}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão');
  expect(screen.queryByRole('button',{name:'Validar e liberar'})).toBeNull();
 });
});
