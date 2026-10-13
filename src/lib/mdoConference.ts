import * as XLSX from 'xlsx';
export type ConferenceRow = {
  employee_id:string; dia:string; nome:string; matricula:string|null; equipe:string|null;
  funcao:string|null; status_dia:string|null; ogs_rdo:string|null; ogs_custos:string|null;
  rdo_ids:string|null; motivo:string; disposicao:string; situacao:string; incluido:boolean;
  historico_equipe:boolean; historico_status:boolean;
  equipe_original?:string|null; equipe_corrigida?:boolean;
};
export const columns = {
  nome:'FUNCIONÁRIO', matricula:'MATRÍCULA', equipe:'EQUIPE', funcao:'FUNÇÃO',
  status_dia:'STATUS', dia:'DATA', ogs_custos:'OGS', ogs_rdo:'OGS DO RDO',
  situacao:'CONFERÊNCIA', motivo:'MOTIVO', rdo_ids:'RDOs DE ORIGEM',
} as const;
export type Column = keyof typeof columns;
export const defaultColumns:Column[]=['nome','matricula','equipe','funcao','status_dia','dia','ogs_custos'];
export type Filters={ teams?:string[]; people?:string[]; days?:string[]; ogs?:string[]; statuses?:string[]; situation?:string; search?:string };
export const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export const dateLabel=(s:string)=>s.split('-').reverse().join('/');
export function filterConference(rows:ConferenceRow[], f:Filters) {
  const match=(list:string[]|undefined,v:string|null)=>!list?.length || list.includes(v||'—');
  const q=fold(f.search||'');
  return rows.filter(r=>match(f.teams,r.equipe)&&match(f.people,r.employee_id)&&match(f.days,r.dia)
    &&match(f.ogs,r.ogs_custos)&&match(f.statuses,r.status_dia)
    &&(!f.situation||f.situation==='todos'||r.situacao===f.situation)
    &&(!q||fold([r.nome,r.matricula,r.funcao,r.equipe,r.ogs_rdo,r.ogs_custos].join(' ')).includes(q)));
}
export function makeWorkbook(rows:ConferenceRow[], chosen:Column[], meta:{inicio:string;fim:string;versao:number;total:number}) {
  const source=rows.filter(r=>r.incluido&&r.disposicao!=='excluir');
  if(!source.length||source.length!==meta.total) throw Error(`Fechamento incompleto: ${source.length} de ${meta.total} linhas. Exportação cancelada.`);
  if(!chosen.length||chosen.some(c=>!(c in columns))) throw Error('Configuração de colunas inválida');
  const sorted=[...source].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')||a.employee_id.localeCompare(b.employee_id)||a.dia.localeCompare(b.dia));
  const data=[chosen.map(c=>columns[c]),...sorted.map(r=>chosen.map(c=>c==='dia'?new Date(`${r.dia}T12:00:00`):r[c]||'—'))];
  const sheet=XLSX.utils.aoa_to_sheet(data,{cellDates:true,dateNF:'dd/mm/yyyy'});
  sheet['!autofilter']={ref:sheet['!ref']!};
  sheet['!cols']=chosen.map(c=>({wch:c==='nome'?38:c==='equipe'?30:c==='funcao'?28:18}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet,'MDO_CUSTOS');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['PERÍODO',`${dateLabel(meta.inicio)} a ${dateLabel(meta.fim)}`],['VERSÃO APROVADA',meta.versao],['LINHAS INCLUÍDAS',meta.total],
  ]),'RESUMO');
  return wb;
}

/** Planilha operacional da conferência; nunca equivale ao fechamento aprovado de Custos. */
export function makeTeamConferenceWorkbook(rows:ConferenceRow[], chosen:Column[], meta:{inicio:string;fim:string;equipes:string[]}) {
  if(!meta.equipes.length||!rows.length)throw Error('Selecione equipes com linhas incluídas para exportar');
  if(rows.some(r=>!r.incluido||r.disposicao==='excluir'||!meta.equipes.includes(r.equipe||'—')))
    throw Error('Há linhas fora das equipes selecionadas ou da composição; exportação cancelada');
  if(!chosen.length||chosen.some(c=>!(c in columns)))throw Error('Configuração de colunas inválida');
  const exportedColumns=[...chosen];
  for(const mandatory of ['equipe','situacao'] as Column[])if(!exportedColumns.includes(mandatory))exportedColumns.push(mandatory);
  const sorted=[...rows].sort((a,b)=>(a.equipe||'').localeCompare(b.equipe||'','pt-BR')||a.nome.localeCompare(b.nome,'pt-BR')||a.employee_id.localeCompare(b.employee_id)||a.dia.localeCompare(b.dia));
  const data=[exportedColumns.map(c=>columns[c]),...sorted.map(r=>exportedColumns.map(c=>c==='dia'?new Date(`${r.dia}T12:00:00`):c==='ogs_custos'&&r.situacao==='PENDENTE'?'PENDENTE':r[c]||'—'))];
  const sheet=XLSX.utils.aoa_to_sheet(data,{cellDates:true,dateNF:'dd/mm/yyyy'});
  sheet['!autofilter']={ref:sheet['!ref']!};
  sheet['!cols']=exportedColumns.map(c=>({wch:c==='nome'?38:c==='equipe'?30:c==='funcao'?28:18}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet,'CONFERENCIA_MDO');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['STATUS','CONFERÊNCIA EM ANDAMENTO — NÃO APROVADA'],
    ['PERÍODO',`${dateLabel(meta.inicio)} a ${dateLabel(meta.fim)}`],
    ['EQUIPES SELECIONADAS',meta.equipes.join(' | ')],
    ['LINHAS EXPORTADAS',rows.length],
    ['FUNCIONÁRIOS',new Set(rows.map(r=>r.employee_id)).size],
    ['DIAS PENDENTES',rows.filter(r=>r.situacao==='PENDENTE').length],
  ]),'RESUMO');
  return wb;
}
