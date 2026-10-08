import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSmartBack } from '@/hooks/useSmartBack';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_COMPANY_ID } from '@/config/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MdoWorkspace } from '@/components/relatorios/MdoWorkspace';

type Access={edit:boolean;approve:boolean;export:boolean};
function initialPeriod(){
  const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return {inicio:today.slice(0,8)+'01',fim:today};
}
export default function RelatorioMdoPeriodo(){
  const back=useSmartBack('/relatorios');const {profile}=useUserProfile();
  // O servidor confirma a conta proprietária global; este fallback não concede acesso.
  const companyId=profile?.company_id||(profile?.email?.toLowerCase()==='andersonmarquesoficial1980@gmail.com'?DEFAULT_COMPANY_ID:null);
  const [access,setAccess]=useState<Access|null>(null),[error,setError]=useState('');
  const [period,setPeriod]=useState(initialPeriod),[inputs,setInputs]=useState(initialPeriod),[blocked,setBlocked]=useState(false);
  useEffect(()=>{
    let active=true;setAccess(null);setError('');
    if(!companyId)return;
    try { const saved=JSON.parse(sessionStorage.getItem(`mdo-period:${companyId}`)||'null');if(saved?.inicio&&saved?.fim){setPeriod(saved);setInputs(saved);} }catch{/* preferência local opcional */}
    Promise.all((['edit','approve','export'] as const).map(async action=>{
      const {data,error}=await (supabase as any).rpc('mdo_custos_pode',{p_empresa:companyId,p_acao:action});if(error)throw error;return Boolean(data);
    })).then(([edit,approve,canExport])=>{if(active)setAccess({edit,approve,export:canExport});}).catch(e=>{if(active)setError(e.message||String(e));});
    return()=>{active=false;};
  },[companyId]);
  const invalid=!inputs.inicio||!inputs.fim||inputs.inicio>inputs.fim||(Date.parse(inputs.fim)-Date.parse(inputs.inicio))/86400000>92;
  return <main className="min-h-screen bg-background">
    <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur"><div className="px-4 lg:px-6 py-4 flex items-center gap-3">
      <Button aria-label="Voltar aos relatórios" variant="ghost" size="icon" disabled={blocked} onClick={back}><ArrowLeft className="h-5 w-5"/></Button>
      <div><h1 className="font-bold text-lg">MDO por Período (RDO x Gestão de Pessoas)</h1><p className="text-xs text-muted-foreground">Compor → Conferir → Validar → Exportar para Custos</p></div>
    </div></header>
    <div className="px-4 lg:px-6 py-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3">
        <label className="text-xs text-muted-foreground">Data início<Input aria-label="Data início" type="date" value={inputs.inicio} disabled={blocked} onChange={e=>setInputs(p=>({...p,inicio:e.target.value}))}/></label>
        <label className="text-xs text-muted-foreground">Data fim<Input aria-label="Data fim" type="date" value={inputs.fim} disabled={blocked} onChange={e=>setInputs(p=>({...p,fim:e.target.value}))}/></label>
        <Button disabled={invalid||blocked||!access?.export} onClick={()=>{setPeriod({...inputs});try{sessionStorage.setItem(`mdo-period:${companyId}`,JSON.stringify(inputs));}catch{/* armazenamento indisponível */}}}>Carregar período</Button>
        {invalid&&<p className="text-xs text-destructive">Escolha um intervalo de até 93 dias.</p>}
        {(inputs.inicio!==period.inicio||inputs.fim!==period.fim)&&<p className="text-xs text-amber-700">Clique em Carregar período. A conferência abaixo ainda corresponde ao período anterior.</p>}
      </div>
      {error?<p role="alert" className="text-destructive">Não foi possível verificar o acesso: {error}</p>:!access?<p>Verificando permissões…</p>:!access.export?<p>Você não tem permissão para esta conferência. Solicite acesso ao responsável.</p>:companyId&&<MdoWorkspace key={`${companyId}:${period.inicio}:${period.fim}`} companyId={companyId} inicio={period.inicio} fim={period.fim} access={access} onBusyChange={setBlocked}/>}
    </div>
  </main>;
}
