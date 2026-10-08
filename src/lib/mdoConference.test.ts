import { describe, it, expect } from 'vitest';
import { filterConference, defaultColumns, makeWorkbook, type ConferenceRow } from './mdoConference';
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
});
