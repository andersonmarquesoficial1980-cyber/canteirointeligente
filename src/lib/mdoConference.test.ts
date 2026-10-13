import { describe, it, expect } from 'vitest';
import { filterConference, defaultColumns, makeWorkbook, makeTeamConferenceWorkbook, type ConferenceRow } from './mdoConference';
import * as XLSX from 'xlsx';
const row = (id: string, team: string, day: string, ogs: string): ConferenceRow => ({ employee_id:id, dia:day, nome:id==='1'?'José Silva':'Maria', matricula:id, funcao:'Auxiliar', equipe:team, status_dia:'ativo', ogs_rdo:ogs, ogs_custos:ogs, rdo_ids:'rdo', motivo:'', disposicao:'ogs', situacao:'ALOCADO', incluido:true, historico_equipe:false, historico_status:false });
const rows=[row('1','A','2026-09-01','2529'),row('1','B','2026-09-02','2530'),row('2','B','2026-09-01','2529')];
describe('MDO conferência unificada',()=>{
 it('combina segmentações sem alterar composição ou decisões',()=>{
  const filters={teams:['B'],people:['1'],days:['2026-09-02'],ogs:['2530'],statuses:['ativo'],situation:'ALOCADO',search:'jose'};
  expect(filterConference(rows,filters)).toEqual([rows[1]]);
  expect(rows.filter(r=>r.incluido)).toHaveLength(3);
  expect(filterConference(rows,{...filters,ogs:['2529']})).toEqual([]);
 });
 it('exporta somente snapshot incluído nas colunas escolhidas, com datas reais e OGS final',()=>{
  const included={...rows[0],ogs_custos:'9999'};
  const wb=makeWorkbook([included,{...rows[1],incluido:false},{...rows[2],disposicao:'excluir'}], ['nome','dia','ogs_custos'], {inicio:'2026-09-01',fim:'2026-09-02',versao:1,total:1});
  const reopened=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellDates:true}),{type:'buffer',cellDates:true});
  const data=XLSX.utils.sheet_to_json<any[]>(reopened.Sheets.MDO_CUSTOS,{header:1});
  expect(data[0]).toEqual(['FUNCIONÁRIO','DATA','OGS']); expect(data).toHaveLength(2);
  expect(data[1][1]).toBeInstanceOf(Date); expect(data[1][2]).toBe('9999');
  expect(defaultColumns).toEqual(['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos']);
 });
 it('bloqueia arquivo incompleto em vez de exportar parte',()=>{
  expect(()=>makeWorkbook(rows,defaultColumns,{inicio:'2026-09-01',fim:'2026-09-02',versao:1,total:4})).toThrow(/incompleto/);
 });
 it('exporta equipes distintas em dias diferentes da mesma pessoa',()=>{
   const wb=makeWorkbook([{...rows[0],equipe:'A',equipe_original:'A'},{...rows[1],equipe:'B',equipe_original:'A',equipe_corrigida:true}],
     ['nome','dia','equipe','ogs_custos'],{inicio:'2026-09-01',fim:'2026-09-02',versao:2,total:2});
   const data=XLSX.utils.sheet_to_json<any[]>(wb.Sheets.MDO_CUSTOS,{header:1});
   expect(data[1][2]).toBe('A');expect(data[2][2]).toBe('B');
   expect(data[1][3]).toBe('2529');expect(data[2][3]).toBe('2530');
 });
 it('gera conferência Excel de múltiplas equipes com dias pendentes, sem rótulo de aprovação',()=>{
   const selected=[rows[0],{...rows[1],equipe:'B',ogs_custos:null,situacao:'PENDENTE'},rows[2]];
   const wb=makeTeamConferenceWorkbook(selected,['nome','dia','ogs_custos'],{inicio:'2026-09-01',fim:'2026-09-02',equipes:['A','B']});
   const reopened=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellDates:true}),{type:'buffer',cellDates:true});
   const data=XLSX.utils.sheet_to_json<any[]>(reopened.Sheets.CONFERENCIA_MDO,{header:1});
   expect(data[0]).toEqual(['FUNCIONÁRIO','DATA','OGS','EQUIPE','CONFERÊNCIA']);
   expect(data).toHaveLength(4);
   expect(data.find(r=>r[1] instanceof Date && r[4]==='PENDENTE')?.[2]).toBe('PENDENTE');
   const summary=XLSX.utils.sheet_to_json<any[]>(reopened.Sheets.RESUMO,{header:1});
   expect(summary).toContainEqual(['STATUS','CONFERÊNCIA EM ANDAMENTO — NÃO APROVADA']);
   expect(summary).toContainEqual(['EQUIPES SELECIONADAS','A | B']);
   expect(summary).toContainEqual(['LINHAS EXPORTADAS',3]);
   expect(reopened.Sheets.MDO_CUSTOS).toBeUndefined();
 });
 it('rejeita conferir equipe não selecionada e linha excluída sem contaminar o Excel',()=>{
   const meta={inicio:'2026-09-01',fim:'2026-09-02',equipes:['A']};
   expect(()=>makeTeamConferenceWorkbook(rows,defaultColumns,meta)).toThrow(/fora das equipes/);
   expect(()=>makeTeamConferenceWorkbook([{...rows[0],incluido:false}],defaultColumns,meta)).toThrow(/fora das equipes/);
 });
 it('serializa todas as linhas de várias páginas sem truncar uma conferência grande',()=>{
   const many=Array.from({length:6000},(_,i)=>({...rows[0],employee_id:`e${Math.floor(i/30)}`,dia:`2026-09-${String(i%30+1).padStart(2,'0')}`}));
   const wb=makeTeamConferenceWorkbook(many,defaultColumns,{inicio:'2026-09-01',fim:'2026-09-30',equipes:['A']});
   const reopened=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellDates:true}),{type:'buffer',cellDates:true});
   expect(XLSX.utils.sheet_to_json(reopened.Sheets.CONFERENCIA_MDO,{header:1}).length).toBe(6001);
   expect(XLSX.utils.sheet_to_json<any[]>(reopened.Sheets.RESUMO,{header:1})).toContainEqual(['LINHAS EXPORTADAS',6000]);
 });
});
