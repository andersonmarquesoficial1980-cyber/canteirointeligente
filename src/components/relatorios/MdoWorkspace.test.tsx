import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MdoWorkspace } from './MdoWorkspace';
const {rpc,from}=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc,from}}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
const day=(employee_id:string,nome:string,equipe:string,dia:string)=>({employee_id,nome,equipe,dia,matricula:employee_id,funcao:'Auxiliar',status_dia:'ativo',ogs_rdo:'2529',ogs_custos:'2529',disposicao:'ogs',motivo:'',incluido:true,situacao:'ALOCADO',rdo_ids:'rdo-1'});
let period:any;
const grade=[day('p1','José Silva','Equipe A','2026-09-01'),day('p1','José Silva','Equipe A','2026-09-02'),day('p2','Maria','Equipe B','2026-09-01')];
let workingGrade:typeof grade;
const props={companyId:'empresa',inicio:'2026-09-01',fim:'2026-09-02',access:{edit:true,approve:true,export:true}};
beforeEach(()=>{period={id:'draft',versao:1,status:'rascunho',revisao:60,funcionarios_incluidos:['p1','p2'],colunas:['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos']};workingGrade=grade.map(r=>({...r}));rpc.mockReset();window.confirm=vi.fn(()=>true);
 rpc.mockImplementation(async(name,args)=>{
 if(name==='mdo_custos_carregar')return {data:{periodos:[period],grade:workingGrade.map(r=>({...r,incluido:period.funcionarios_incluidos.includes(r.employee_id),situacao:period.funcionarios_incluidos.includes(r.employee_id)?'ALOCADO':'FORA DO RELATÓRIO'})),ogs:[{id:'ogs',ogs_number:'2529'}],assinatura:'hash'},error:null};
 if(name==='mdo_custos_configurar'){period={...period,revisao:61,funcionarios_incluidos:args.p_funcionarios,colunas:args.p_colunas};return {data:61,error:null};}
 if(name==='mdo_custos_alterar_equipe'){
   workingGrade=workingGrade.map(r=>args.p_celulas.some((c:any)=>c.employee_id===r.employee_id&&c.dia===r.dia)?{...r,equipe:args.p_equipe||grade.find(g=>g.employee_id===r.employee_id&&g.dia===r.dia)!.equipe,equipe_original:grade.find(g=>g.employee_id===r.employee_id&&g.dia===r.dia)!.equipe,equipe_corrigida:!!args.p_equipe}:r);
   period={...period,revisao:period.revisao+1};return {data:period.revisao,error:null};
 }
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
 it('corrige apenas um dia do funcionário, preserva os outros dias e a OGS e permite restaurar',async()=>{
   render(<MdoWorkspace {...props}/>);await screen.findByText('3 funcionário/dia incluídos');
   fireEvent.click(screen.getByRole('button',{name:'Corrigir equipe de José Silva em 02/09/2026'}));
   expect(screen.getByText('Impacto: 1 funcionário/dia · 1 pessoa(s)')).toBeTruthy();
   fireEvent.change(screen.getByRole('combobox',{name:'Equipe para os dias'}),{target:{value:'Equipe B'}});
   fireEvent.change(screen.getByRole('textbox',{name:'Motivo da correção de equipe'}),{target:{value:'Atuou na equipe B neste dia'}});
   fireEvent.click(screen.getByRole('button',{name:'Salvar equipe dos dias'}));
   await waitFor(()=>expect(rpc).toHaveBeenCalledWith('mdo_custos_alterar_equipe',expect.objectContaining({p_celulas:[{employee_id:'p1',dia:'2026-09-02'}],p_equipe:'Equipe B',p_revisao:60})));
   await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Corrigir equipe por dia'})).toBeNull());
   const trs=within(screen.getByRole('table',{name:'Grade de conferência MDO'})).getAllByRole('row');
   expect(trs[1]).toHaveTextContent('Equipe A');expect(trs[2]).toHaveTextContent('Equipe B · corrigida');
   expect(trs[2]).toHaveTextContent('2529');
   fireEvent.click(screen.getByRole('button',{name:'Corrigir equipe de José Silva em 02/09/2026'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Equipe para os dias'}),{target:{value:'__restore__'}});
   fireEvent.click(screen.getByRole('button',{name:'Salvar equipe dos dias'}));
   await waitFor(()=>expect(rpc).toHaveBeenCalledWith('mdo_custos_alterar_equipe',expect.objectContaining({p_equipe:null,p_revisao:61,p_celulas:[{employee_id:'p1',dia:'2026-09-02'}]})));
 });
 it('não aplica equipe a outros funcionários ou datas quando seleciona linhas específicas',async()=>{
   render(<MdoWorkspace {...props}/>);await screen.findByText('3 funcionário/dia incluídos');
   fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar José Silva 2026-09-01'}));
   fireEvent.click(screen.getByRole('checkbox',{name:'Selecionar Maria 2026-09-01'}));
   fireEvent.click(screen.getByRole('button',{name:'Corrigir equipe por dia'}));
   fireEvent.change(screen.getByRole('combobox',{name:'Equipe para os dias'}),{target:{value:'Equipe B'}});
   fireEvent.change(screen.getByRole('textbox',{name:'Motivo da correção de equipe'}),{target:{value:'Troca de frente'}});
   fireEvent.click(screen.getByRole('button',{name:'Salvar equipe dos dias'}));
   await waitFor(()=>expect(rpc).toHaveBeenCalledWith('mdo_custos_alterar_equipe',expect.objectContaining({p_celulas:[{employee_id:'p1',dia:'2026-09-01'},{employee_id:'p2',dia:'2026-09-01'}]})));
 });
});
