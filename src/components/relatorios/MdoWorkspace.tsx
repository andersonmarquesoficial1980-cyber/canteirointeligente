import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { columns, defaultColumns, dateLabel, filterConference, fold, makeWorkbook, type Column, type ConferenceRow, type Filters } from '@/lib/mdoConference';

type Period = {id:string;versao:number;status:'rascunho'|'aprovado';revisao:number;funcionarios_incluidos:string[]|null;colunas:Column[];total_linhas:number|null;aprovado_em:string|null};
type Payload = {grade:ConferenceRow[];periodos:Period[];ogs:{id:string;ogs_number:string}[];assinatura:string};
type CostUser={user_id:string;nome:string;email:string;permitido:boolean};
const db=supabase as any;
const cellKey=(r:ConferenceRow)=>`${r.employee_id}|${r.dia}`;
const unique=(values:(string|null)[])=>[...new Set(values.map(v=>v||'—'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
const message=(e:unknown)=>e && typeof e==='object' && 'message' in e ? String(e.message):String(e);
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await db.rpc(name,args);if(error)throw error;return data as T;}
async function frozen(companyId:string,p:Period):Promise<ConferenceRow[]>{
  const rows:ConferenceRow[]=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await db.from('mdo_custos_fechado').select('*').eq('company_id',companyId).eq('periodo_id',p.id)
      .neq('disposicao','excluir').order('employee_id').order('dia').range(offset,offset+499);
    if(error)throw error;
    rows.push(...(data||[]).map((r:any)=>({...r,incluido:true,situacao:r.disposicao==='excecao'?'JUSTIFICADO':'ALOCADO'})));
    if(!data||data.length<500)break;
  }
  if(rows.length!==p.total_linhas)throw Error(`Fechamento incompleto: ${rows.length} de ${p.total_linhas} linhas`);
  return rows;
}

function Slicer({title,options,value,onChange,label=(v)=>v}:{title:string;options:string[];value:string[];onChange:(v:string[])=>void;label?:(v:string)=>string}){
  const [query,setQuery]=useState('');
  const choices=options.filter(v=>fold(label(v)).includes(fold(query)));
  return <details className="border-b py-2" open={title==='Equipe'}>
    <summary className="cursor-pointer text-sm font-semibold">{title} <span className="text-muted-foreground font-normal">{value.length?`· ${value.length} selecionados`: '· Todos'}</span></summary>
    <Input aria-label={`Buscar ${title.toLowerCase()}`} placeholder={`Buscar ${title.toLowerCase()}`} value={query} onChange={e=>setQuery(e.target.value)} className="h-8 my-2 text-xs"/>
    <button className="text-xs underline mb-2" onClick={()=>onChange([])}>Limpar filtro</button>
    <div className="max-h-48 overflow-y-auto space-y-1">{choices.map(v=><label key={v} className={`flex items-center gap-2 text-xs rounded p-1.5 cursor-pointer ${value.includes(v)?'bg-primary/10':'hover:bg-muted'}`}>
      <input type="checkbox" checked={value.includes(v)} onChange={e=>onChange(e.target.checked?[...value,v]:value.filter(x=>x!==v))}/><span>{label(v)}</span>
    </label>)}</div>
  </details>;
}

export function MdoWorkspace({companyId,inicio,fim,access,onBusyChange}:{companyId:string;inicio:string;fim:string;access:{edit:boolean;approve:boolean;export:boolean};onBusyChange?:(busy:boolean)=>void}){
  const [payload,setPayload]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [included,setIncluded]=useState<Set<string>>(new Set()),[chosen,setChosen]=useState<Column[]>(defaultColumns);
  const [dirty,setDirty]=useState(false),[composition,setComposition]=useState(false),[columnPanel,setColumnPanel]=useState(false);
  const [compositionSearch,setCompositionSearch]=useState('');
  const [filters,setFilters]=useState<Filters>({}),[visibility,setVisibility]=useState('incluidos');
  const [sort,setSort]=useState<Column>('nome'),[descending,setDescending]=useState(false),[page,setPage]=useState(0);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [bulk,setBulk]=useState(false),[bulkScope,setBulkScope]=useState('selecionados'),[ogsId,setOgsId]=useState('');
  const [action,setAction]=useState('ogs'),[reason,setReason]=useState(''),[replace,setReplace]=useState(false);
  const [start,setStart]=useState(inicio),[end,setEnd]=useState(fim),[progress,setProgress]=useState('');
  const [validation,setValidation]=useState(false),[details,setDetails]=useState<ConferenceRow|null>(null);
  const [approvedId,setApprovedId]=useState(''),[approvedRows,setApprovedRows]=useState<ConferenceRow[]|null>(null);
  const [costUsers,setCostUsers]=useState<CostUser[]|null>(null),[costQuery,setCostQuery]=useState('');
  const request=useRef(0),mutex=useRef(false);
  const latest=payload?.periodos[0];
  const draft=latest?.status==='rascunho'?latest:null;
  const approved=payload?.periodos.filter(p=>p.status==='aprovado')||[];
  const readOnly=!access.edit||(!draft&&!!latest);
  const locked=busy||loading||readOnly;

  const load=async()=>{
    const serial=++request.current;setLoading(true);setError('');
    try{
      const data=await call<Payload>('mdo_custos_carregar',{p_empresa:companyId,p_inicio:inicio,p_fim:fim});
      const current=data.periodos[0];
      const snapshot=current?.status==='aprovado'?await frozen(companyId,current):null;
      if(serial!==request.current)return data;
      setPayload(data);setApprovedRows(snapshot);setApprovedId(data.periodos.find(p=>p.status==='aprovado')?.id||'');
      setIncluded(new Set(current?.funcionarios_incluidos??data.grade.map(r=>r.employee_id)));
      setChosen(current?.colunas||defaultColumns);setDirty(false);setSelected(new Set());setDetails(null);setValidation(false);
      return data;
    }catch(e){if(serial===request.current){setError(message(e));setPayload(null);}throw e;}
    finally{if(serial===request.current)setLoading(false);}
  };
  useEffect(()=>{void load().catch(()=>{});return()=>{request.current++;};},[companyId,inicio,fim]);
  useEffect(()=>{onBusyChange?.(busy||dirty);},[busy,dirty,onBusyChange]);
  const run=async(fn:()=>Promise<void>)=>{
    if(mutex.current)return;mutex.current=true;setBusy(true);
    try{await fn();}catch(e){toast.error(message(e));}
    finally{mutex.current=false;setBusy(false);setProgress('');}
  };
  const ensureDraft=async()=>{
    if(draft)return draft;
    const id=await call<string>('mdo_custos_abrir',{p_empresa:companyId,p_inicio:inicio,p_fim:fim});
    const data=await call<Payload>('mdo_custos_carregar',{p_empresa:companyId,p_inicio:inicio,p_fim:fim});
    const p=data.periodos.find(p=>p.id===id);if(!p)throw Error('Rascunho criado mas não disponível para leitura');return p;
  };
  const rows=readOnly?(approvedRows||[]):(payload?.grade||[]);
  const people=useMemo(()=>{
    const map=new Map<string,{id:string;name:string;matricula:string;teams:Set<string>}>();
    for(const r of payload?.grade||[]){if(!map.has(r.employee_id))map.set(r.employee_id,{id:r.employee_id,name:r.nome,matricula:r.matricula||'—',teams:new Set()});map.get(r.employee_id)!.teams.add(r.equipe||'SEM EQUIPE');}
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
  },[payload]);
  const teams=useMemo(()=>unique((payload?.grade||[]).map(r=>r.equipe)),[payload]);
  const visible=useMemo(()=>filterConference(rows,filters).filter(r=>visibility==='todos'||(visibility==='incluidos'?r.incluido&&r.disposicao!=='excluir':!r.incluido||r.disposicao==='excluir'))
    .sort((a,b)=>((String(a[sort]||'').localeCompare(String(b[sort]||''),'pt-BR')||a.employee_id.localeCompare(b.employee_id)||a.dia.localeCompare(b.dia))*(descending?-1:1))),[rows,filters,visibility,sort,descending]);
  const pageSize=100,maxPage=Math.max(0,Math.ceil(visible.length/pageSize)-1),actualPage=Math.min(page,maxPage);
  const shown=visible.slice(actualPage*pageSize,(actualPage+1)*pageSize);
  const includedRows=rows.filter(r=>r.incluido&&r.disposicao!=='excluir');
  const pending=includedRows.filter(r=>r.situacao==='PENDENTE').length;
  const peopleCount=new Set(includedRows.map(r=>r.employee_id)).size;
  const changeFilter=(key:keyof Filters,value:string[]|string)=>{setFilters(f=>({...f,[key]:value}));setPage(0);setSelected(new Set());};
  const saveConfig=()=>run(async()=>{
    if(!chosen.length)throw Error('Selecione ao menos uma coluna');
    const p=await ensureDraft();
    await call('mdo_custos_configurar',{p_periodo:p.id,p_revisao:p.revisao,p_funcionarios:[...included].sort(),p_colunas:chosen});
    await load();setComposition(false);setColumnPanel(false);toast.success('Composição e colunas salvas. Ajustes de OGS preservados.');
  });
  const targets=useMemo(()=>{
    const source=bulkScope==='filtro'?visible:rows.filter(r=>selected.has(cellKey(r)));
    return source.filter(r=>r.incluido&&r.dia>=start&&r.dia<=end && (action!=='ogs'||r.situacao==='PENDENTE'||(replace&&r.situacao==='ALOCADO')));
  },[bulkScope,visible,rows,selected,start,end,action,replace]);
  const apply=()=>run(async()=>{
    if(dirty)throw Error('Salve a composição e colunas antes de ajustar OGS');
    if(!targets.length||start<inicio||end>fim||start>end)throw Error('Escolha dias válidos dentro do período');
    if(action==='ogs'&&!ogsId)throw Error('Escolha a OGS');
    if(action!=='ogs'&&reason.trim().length<3)throw Error('Informe um motivo com pelo menos 3 caracteres');
    if(!window.confirm(`Aplicar ${action==='ogs'?`OGS ${payload?.ogs.find(o=>o.id===ogsId)?.ogs_number}`:action==='exclude'?'exclusão de Custos':'justificativa'} a ${targets.length} funcionário/dia (${new Set(targets.map(r=>r.employee_id)).size} pessoas)?\nNão altera RDO nem cadastro. ${replace?'Substitui também OGS alocadas.':'OGS já alocadas são preservadas.'}`))return;
    let p=await ensureDraft();
    try{
      for(let offset=0;offset<targets.length;offset+=200){
        setProgress(`Salvando ${Math.min(offset+200,targets.length)} de ${targets.length} dias…`);
        const revision=await call<number>('mdo_custos_alterar',{p_periodo:p.id,p_revisao:p.revisao,p_celulas:targets.slice(offset,offset+200).map(r=>({employee_id:r.employee_id,data:r.dia,disposition:action,ogs_id:action==='ogs'?ogsId:null,reason:action==='ogs'?'':reason.trim()}))});
        p={...p,revisao:revision};
      }
      await load();setBulk(false);toast.success('Ajustes salvos e recarregados para conferência.');
    }catch(e){await load();throw Error(`Lote interrompido: ${message(e)}. A grade foi recarregada com o que foi salvo.`);}
  });
  const exportApproved=()=>run(async()=>{
    const p=approved.find(p=>p.id===approvedId);if(!p)throw Error('Selecione uma versão aprovada');
    const snapshot=await frozen(companyId,p);
    const wb=makeWorkbook(snapshot,p.colunas||defaultColumns,{inicio,fim,versao:p.versao,total:p.total_linhas||0});
    XLSX.writeFile(wb,`WF_MDO_CUSTOS_${inicio}_${fim}_v${p.versao}.xlsx`,{cellDates:true});
    toast.success(`Versão ${p.versao}: ${snapshot.length} linhas exportadas.`);
  });
  const previewApproved=()=>run(async()=>{
    const p=approved.find(p=>p.id===approvedId);if(!p)return;
    setApprovedRows(await frozen(companyId,p));setChosen(p.colunas||defaultColumns);setFilters({});setVisibility('incluidos');setPage(0);
  });
  const publish=()=>run(async()=>{
    if(!draft||dirty||pending||!payload)return;
    await call<number>('mdo_custos_publicar',{p_periodo:draft.id,p_revisao:draft.revisao,p_assinatura:payload.assinatura});
    await load();toast.success('Versão validada e liberada para Custos.');
  });
  const editConfig=()=>{setComposition(v=>!v);};

  if(loading&&!payload)return <p className="p-6" role="status">Carregando conferência completa…</p>;
  if(error)return <div className="border rounded-lg p-5"><p role="alert" className="text-destructive">Não foi possível carregar o MDO: {error}</p><Button onClick={()=>void load().catch(()=>{})} className="mt-3">Tentar novamente</Button></div>;
  if(!payload)return null;
  return <div className="space-y-3" aria-label="Conferência MDO para Custos">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h2 className="font-semibold">{readOnly?'Versão aprovada · somente leitura':draft?`Conferência v${draft.versao} · revisão ${draft.revisao}`:'Nova conferência'}</h2><p className="text-xs text-muted-foreground">{dateLabel(inicio)} a {dateLabel(fim)} · {loading?'Atualizando…':'Dados completos carregados'}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy||loading} onClick={()=>{if(!dirty||window.confirm('Descartar alterações de composição/colunas ainda não salvas?'))void load().catch(()=>{});}}>Atualizar dados</Button>
        {access.edit&&readOnly?<Button size="sm" disabled={busy||loading} onClick={()=>void run(async()=>{await ensureDraft();await load();})}>Abrir nova versão</Button>:access.edit&&<>
          <Button size="sm" variant="outline" disabled={busy||loading} onClick={editConfig}>Composição do relatório</Button>
          <Button size="sm" variant="outline" disabled={busy||loading} onClick={()=>setColumnPanel(v=>!v)}>Colunas</Button>
          <Button size="sm" variant="outline" disabled={busy||loading||dirty||!visible.length} onClick={()=>{setBulk(true);setBulkScope(selected.size?'selecionados':'filtro');}}>Ajustar OGS / exceções</Button>
          {access.approve&&<Button size="sm" disabled={busy||loading||dirty||!draft||draft.funcionarios_incluidos===null||pending>0||!includedRows.length} onClick={()=>setValidation(true)}>Validar e liberar</Button>}
        </>}
      </div>
    </div>
    {approved.length>0&&<div className="border rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm">
      <strong>Disponível para Custos</strong><select aria-label="Versão aprovada" className="border rounded p-2 bg-background" value={approvedId} onChange={e=>setApprovedId(e.target.value)}>{approved.map(p=><option key={p.id} value={p.id}>v{p.versao} · {p.total_linhas} linhas</option>)}</select>
      {readOnly&&<Button variant="outline" size="sm" disabled={busy} onClick={previewApproved}>Ver versão</Button>}
      <Button size="sm" disabled={busy||loading||!approvedId} onClick={exportApproved}>Exportar Excel aprovado</Button><span className="text-xs text-muted-foreground">Filtros da tela não alteram o arquivo aprovado.</span>
    </div>}
    {!access.edit&&!approved.length?<p className="border rounded p-4">Nenhuma versão aprovada para este período. Custos não pode consultar ou exportar rascunhos.</p>:<>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm">
        <span><strong>{peopleCount}</strong> funcionários incluídos</span><span>{includedRows.length} funcionário/dia incluídos</span>
        <span className={pending?'text-amber-700':''}><strong>{pending}</strong> dias pendentes</span><span><strong>{rows.length-includedRows.length}</strong> dias fora de Custos</span>
      </div>
      {!readOnly&&(!draft||draft.funcionarios_incluidos===null)&&<p className="text-sm border rounded p-3 bg-muted/40">Defina e salve a <button className="underline font-medium" onClick={()=>setComposition(true)}>composição do relatório</button> antes de validar. Os ajustes anteriores continuam preservados.</p>}
      {dirty&&<p role="status" className="text-sm bg-amber-50 text-amber-900 border rounded p-3">Composição/colunas alteradas, ainda não salvas. A grade e os totais continuam mostrando a versão salva. {!composition&&!columnPanel&&<button className="underline font-semibold" disabled={busy} onClick={saveConfig}>Salvar composição e colunas</button>}</p>}
      {(composition||columnPanel)&&!readOnly&&<section className="border rounded-lg p-4 space-y-3" aria-label="Configuração do relatório">
        {composition&&<><h3 className="font-semibold">Quem entra no relatório</h3><p className="text-xs text-muted-foreground">Equipes são atalhos para selecionar pessoas que passaram por elas. A inclusão da pessoa vale por todo o período. Retirar alguém daqui não apaga cadastro nem OGS salvas.</p>
          <div className="flex flex-wrap gap-2">{teams.map(t=>{
            const members=people.filter(p=>p.teams.has(t));const all=members.length>0&&members.every(p=>included.has(p.id));
            return <label key={t} className={`text-xs border rounded px-2 py-1.5 cursor-pointer ${all?'bg-primary/10':''}`}><input type="checkbox" className="mr-2" checked={all} disabled={busy} onChange={e=>{setIncluded(prev=>{const next=new Set(prev);members.forEach(p=>e.target.checked?next.add(p.id):next.delete(p.id));return next;});setDirty(true);}}/>{t} · {members.length}</label>;
          })}</div>
          <div className="flex flex-wrap gap-2 items-center"><Input aria-label="Buscar pessoa na composição" className="max-w-sm" placeholder="Nome ou matrícula" value={compositionSearch} onChange={e=>setCompositionSearch(e.target.value)}/><span className="text-sm">{included.size} pessoas selecionadas</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={()=>{setIncluded(new Set(people.map(p=>p.id)));setDirty(true);}}>Incluir todos</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setIncluded(new Set());setDirty(true);}}>Retirar todos</Button></div>
          <div className="max-h-64 overflow-auto grid sm:grid-cols-2 gap-1">{people.filter(p=>fold(`${p.name} ${p.matricula}`).includes(fold(compositionSearch))).map(p=><label key={p.id} className="flex items-center gap-2 text-xs border-b p-2"><input type="checkbox" aria-label={`Incluir ${p.name} · ${p.matricula}`} disabled={busy} checked={included.has(p.id)} onChange={e=>{setIncluded(prev=>{const next=new Set(prev);e.target.checked?next.add(p.id):next.delete(p.id);return next;});setDirty(true);}}/><span><strong>{p.name}</strong> · {p.matricula}<small className="block text-muted-foreground">{[...p.teams].join(' / ')}</small></span></label>)}</div>
        </>}
        {columnPanel&&<><h3 className="font-semibold">Colunas da conferência e do Excel aprovado</h3><div className="flex flex-wrap gap-3">{(Object.keys(columns) as Column[]).map(c=><label className="text-xs flex gap-2" key={c}><input type="checkbox" disabled={busy} checked={chosen.includes(c)} onChange={e=>{setChosen(prev=>e.target.checked?[...prev,c]:prev.filter(x=>x!==c));setDirty(true);}}/>{columns[c]}</label>)}</div><p className="text-xs text-muted-foreground">A configuração é salva com a conferência e congelada na aprovação. Informações de origem permanecem nos detalhes.</p></>}
        <div className="flex gap-2"><Button disabled={busy||loading||!chosen.length} onClick={saveConfig}>Salvar composição e colunas</Button><Button variant="ghost" disabled={busy} onClick={()=>{setIncluded(new Set(latest?.funcionarios_incluidos??payload.grade.map(r=>r.employee_id)));setChosen(latest?.colunas||defaultColumns);setDirty(false);setComposition(false);setColumnPanel(false);}}>Cancelar alterações</Button></div>
      </section>}
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
        <aside className="border rounded-lg p-3 self-start lg:sticky lg:top-20">
          <h3 className="text-sm font-semibold">Segmentações</h3><p className="text-xs text-muted-foreground mb-2">Filtram a tela, não quem entra no relatório.</p>
          <Slicer title="Equipe" options={unique(rows.map(r=>r.equipe))} value={filters.teams||[]} onChange={v=>changeFilter('teams',v)}/>
          <Slicer title="Funcionário" options={unique(rows.map(r=>r.employee_id))} value={filters.people||[]} onChange={v=>changeFilter('people',v)} label={id=>{const p=rows.find(r=>r.employee_id===id);return `${p?.nome} · ${p?.matricula||'—'}`;}}/>
          <Slicer title="Data" options={unique(rows.map(r=>r.dia))} value={filters.days||[]} onChange={v=>changeFilter('days',v)} label={dateLabel}/>
          <Slicer title="OGS" options={unique(rows.map(r=>r.ogs_custos))} value={filters.ogs||[]} onChange={v=>changeFilter('ogs',v)}/>
          <Slicer title="Status" options={unique(rows.map(r=>r.status_dia))} value={filters.statuses||[]} onChange={v=>changeFilter('statuses',v)}/>
          <Button size="sm" variant="ghost" className="mt-2" onClick={()=>{setFilters({});setPage(0);setSelected(new Set());}}>Limpar segmentações</Button>
        </aside>
        <section className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Input aria-label="Buscar na conferência" className="max-w-sm" placeholder="Nome, matrícula, função ou OGS…" value={filters.search||''} onChange={e=>changeFilter('search',e.target.value)}/>
            <select aria-label="Participação no relatório" className="border rounded p-2 text-sm bg-background" value={visibility} onChange={e=>{setVisibility(e.target.value);setPage(0);setSelected(new Set());}}><option value="incluidos">Incluídos para Custos</option><option value="fora">Fora de Custos</option><option value="todos">Todos os cadastros</option></select>
            <select aria-label="Situação da conferência" className="border rounded p-2 text-sm bg-background" value={filters.situation||'todos'} onChange={e=>changeFilter('situation',e.target.value)}>{['todos','PENDENTE','ALOCADO','JUSTIFICADO','FORA DE CUSTOS','FORA DO RELATÓRIO'].map(s=><option key={s} value={s}>{s==='todos'?'Todas as situações':s}</option>)}</select>
          </div>
          <p className="text-xs text-muted-foreground">{visible.length} linhas nesta visualização · {selected.size} selecionadas. OGS é a decisão para Custos; sem RDO não significa falta. Equipe/status sem histórico usam o cadastro atual (ver detalhes).</p>
          {!readOnly&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={locked||dirty} onClick={()=>setSelected(new Set(shown.filter(r=>r.incluido).map(cellKey)))}>Selecionar página</Button><Button size="sm" variant="outline" disabled={locked||dirty} onClick={()=>setSelected(new Set(visible.filter(r=>r.incluido).map(cellKey)))}>Selecionar resultados filtrados</Button><Button size="sm" variant="ghost" onClick={()=>setSelected(new Set())}>Limpar seleção</Button></div>}
          <div className="border rounded-lg overflow-auto max-h-[65vh]">
            <table aria-label="Grade de conferência MDO" className="w-full text-xs whitespace-nowrap"><thead className="sticky top-0 bg-card z-10 border-b"><tr>
              {!readOnly&&<th className="p-2">Sel.</th>}{chosen.map(c=><th key={c} className="text-left px-3 py-3"><button onClick={()=>{setSort(c);setDescending(sort===c?!descending:false);}}>{columns[c]}{sort===c?(descending?' ↓':' ↑'):''}</button></th>)}<th className="p-2">Ações</th>
            </tr></thead><tbody>{shown.map(r=><tr key={cellKey(r)} className={`border-b ${r.situacao==='PENDENTE'?'bg-amber-50/40':!r.incluido||r.disposicao==='excluir'?'bg-muted text-muted-foreground':'hover:bg-muted/30'}`}>
              {!readOnly&&<td className="p-2"><input type="checkbox" aria-label={`Selecionar ${r.nome} ${r.dia}`} disabled={locked||dirty||!r.incluido} checked={selected.has(cellKey(r))} onChange={e=>setSelected(prev=>{const next=new Set(prev);e.target.checked?next.add(cellKey(r)):next.delete(cellKey(r));return next;})}/></td>}
              {chosen.map(c=><td key={c} className={`px-3 py-2 ${c==='nome'?'font-medium':''}`}>{c==='dia'?dateLabel(r.dia):c==='ogs_custos'?<span className={r.situacao==='PENDENTE'?'text-amber-700 font-semibold':''}>{r.ogs_custos||(r.situacao==='PENDENTE'?'PENDENTE':'—')}</span>:r[c]||'—'}</td>)}
              <td className="p-1"><button className="underline px-2" onClick={()=>setDetails(r)}>Detalhes</button>{!readOnly&&<button className="underline px-2 disabled:opacity-40" disabled={locked||dirty||!r.incluido} onClick={()=>{setSelected(new Set([cellKey(r)]));setBulkScope('selecionados');setStart(r.dia);setEnd(r.dia);setReplace(true);setBulk(true);}}>Editar</button>}</td>
            </tr>)}</tbody></table>
            {!shown.length&&<p className="p-6 text-sm">Nenhuma linha neste filtro. Limpe as segmentações ou reveja a composição.</p>}
          </div>
          <div className="flex justify-between items-center text-sm"><span>Página {actualPage+1} de {maxPage+1} · {visible.length} linhas</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!actualPage} onClick={()=>setPage(actualPage-1)}>Anterior</Button><Button size="sm" variant="outline" disabled={actualPage>=maxPage} onClick={()=>setPage(actualPage+1)}>Próxima</Button></div></div>
        </section>
      </div>
    </>}
    {bulk&&!readOnly&&<div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-label="Ajustar conferência" className="bg-card rounded-xl border p-5 max-w-2xl w-full space-y-3 max-h-[90vh] overflow-auto">
      <h3 className="font-semibold">Ajustar OGS / exceções</h3><p className="text-sm">Equipe ou funcionário: use as segmentações da tabela para definir o grupo. Nenhum cadastro ou RDO será alterado.</p>
      <select aria-label="Alvo do ajuste" className="border rounded p-2 bg-background w-full" disabled={busy} value={bulkScope} onChange={e=>setBulkScope(e.target.value)}><option value="selecionados">Linhas marcadas ({selected.size})</option><option value="filtro">Todos os resultados filtrados ({visible.length})</option></select>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs">De<Input aria-label="Início do ajuste" type="date" disabled={busy} min={inicio} max={fim} value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-xs">Até<Input aria-label="Fim do ajuste" type="date" disabled={busy} min={inicio} max={fim} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
      <select aria-label="Ação do ajuste" className="border rounded p-2 bg-background w-full" disabled={busy} value={action} onChange={e=>setAction(e.target.value)}><option value="ogs">Atribuir OGS</option><option value="exception">Justificar sem OGS</option><option value="exclude">Não enviar esses dias para Custos</option></select>
      {action==='ogs'?<><select aria-label="OGS para Custos" className="border rounded p-2 bg-background w-full" value={ogsId} disabled={busy} onChange={e=>setOgsId(e.target.value)}><option value="">Escolha a OGS</option>{payload.ogs.map(o=><option key={o.id} value={o.id}>{o.ogs_number}</option>)}</select><label className="flex gap-2 text-xs"><input type="checkbox" checked={replace} disabled={busy} onChange={e=>setReplace(e.target.checked)}/>Substituir também OGS alocadas (preserva justificativas e exclusões)</label></>:<Input aria-label="Motivo da exceção" disabled={busy} placeholder="Motivo obrigatório" value={reason} onChange={e=>setReason(e.target.value)}/>}
      <p className="text-sm font-semibold">Impacto: {targets.length} funcionário/dia · {new Set(targets.map(r=>r.employee_id)).size} pessoas</p>
      <p className="text-xs">Para restaurar dias justificados ou excluídos, use o botão Restaurar para OGS nos detalhes da linha.</p>
      {progress&&<p role="status">{progress}</p>}<div className="flex gap-2"><Button disabled={busy||!targets.length||start<inicio||end>fim||start>end||(action==='ogs'?!ogsId:reason.trim().length<3)} onClick={apply}>Confirmar ajuste</Button><Button variant="outline" disabled={busy} onClick={()=>setBulk(false)}>Cancelar</Button></div>
    </section></div>}
    {details&&<div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-label="Origem e decisão" className="bg-card rounded-xl border p-5 max-w-xl w-full space-y-3 max-h-[90vh] overflow-auto">
      <h3 className="font-semibold">{details.nome} · {dateLabel(details.dia)}</h3>
      <dl className="text-sm space-y-2">{[['Matrícula',details.matricula],['Equipe',details.equipe],['Origem da equipe',details.historico_equipe?'Histórico registrado':'Cadastro na consulta / valor congelado se aprovado'],['Status',details.status_dia],['Origem do status',details.historico_status?'Histórico registrado':'Cadastro/datas de vínculo / valor congelado se aprovado'],['OGS original do RDO',details.ogs_rdo],['OGS para Custos',details.ogs_custos],['Conferência',details.situacao],['Motivo',details.motivo],['RDOs de origem',details.rdo_ids]].map(([label,value])=><div key={label}><dt className="text-muted-foreground text-xs">{label}</dt><dd className="break-words whitespace-normal">{value||'—'}</dd></div>)}</dl>
      {!readOnly&&details.incluido&&['excluir','excecao'].includes(details.disposicao)&&<label className="block text-sm">Restaurar para OGS<select aria-label="Restaurar para OGS" className="border rounded p-2 bg-background w-full" defaultValue="" disabled={busy||dirty} onChange={e=>{const ogs=e.target.value;if(!ogs||!window.confirm('Restaurar este dia para a OGS escolhida? A decisão anterior permanece na auditoria.'))return;void run(async()=>{const p=await ensureDraft();await call('mdo_custos_alterar',{p_periodo:p.id,p_revisao:p.revisao,p_celulas:[{employee_id:details.employee_id,data:details.dia,disposition:'ogs',ogs_id:ogs,reason:''}]});await load();});}}><option value="">Selecione a OGS</option>{payload.ogs.map(o=><option key={o.id} value={o.id}>{o.ogs_number}</option>)}</select></label>}
      <Button variant="outline" disabled={busy} onClick={()=>setDetails(null)}>Fechar detalhes</Button>
    </section></div>}
    {validation&&draft&&<div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-label="Validar relatório" className="bg-card rounded-xl border p-5 max-w-xl w-full space-y-4">
      <h3 className="font-semibold">Validar e liberar versão {draft.versao}</h3><p>A validação abrange {peopleCount} funcionários e {includedRows.length} linhas, independentemente das segmentações visíveis.</p><p>{pending} pendentes · {rows.length-includedRows.length} dias fora de Custos.</p><p className="text-sm">Colunas: {chosen.map(c=>columns[c]).join(', ')}.</p><p className="text-sm text-muted-foreground">Esta versão ficará congelada. Custos poderá exportá-la; alterações posteriores exigirão uma nova versão.</p>
      <div className="flex gap-2"><Button disabled={busy||dirty||pending>0} onClick={publish}>Confirmar validação e liberar</Button><Button variant="outline" disabled={busy} onClick={()=>setValidation(false)}>Voltar à conferência</Button></div>
    </section></div>}
    {access.approve&&<details className="border rounded p-3 text-sm" onToggle={e=>{if(e.currentTarget.open&&costUsers===null)void call<CostUser[]>('mdo_custos_listar_acessos',{p_empresa:companyId}).then(setCostUsers).catch(e=>toast.error(message(e)));}}><summary className="font-medium cursor-pointer">Quem pode exportar para Custos</summary><p className="text-xs text-muted-foreground my-2">Acesso individual à versão aprovada. O módulo e o relatório também precisam estar habilitados no Painel de Permissões.</p><Input aria-label="Buscar usuário de Custos" value={costQuery} onChange={e=>setCostQuery(e.target.value)} placeholder="Nome ou e-mail" className="max-w-sm"/>
      <div className="max-h-56 overflow-auto">{costUsers?.filter(u=>fold(`${u.nome} ${u.email}`).includes(fold(costQuery))).map(u=><div className="flex justify-between items-center border-b py-2 gap-2" key={u.user_id}><span>{u.nome}<small className="block text-muted-foreground">{u.email}</small></span><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(async()=>{if(!window.confirm(`${u.permitido?'Revogar':'Permitir'} exportação aprovada para ${u.nome}?`))return;await call('mdo_custos_definir_exportador',{p_empresa:companyId,p_usuario:u.user_id,p_permitir:!u.permitido});setCostUsers(await call('mdo_custos_listar_acessos',{p_empresa:companyId}));})}>{u.permitido?'Revogar exportação':'Permitir exportação'}</Button></div>)}</div>
    </details>}
  </div>;
}
