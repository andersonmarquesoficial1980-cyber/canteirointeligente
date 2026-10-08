import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';

// Preferência local, isolada por empresa/usuário. Não grava dados no Supabase.
export function useWorkspaceShortcuts() {
  const [ids,setIds]=useState<string[]>([]);
  const [key,setKey]=useState<string|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const {data:{user}}=await supabase.auth.getUser();
        if(!user) throw new Error('identity');
        const {data:profile,error:profileError}=await supabase.from('profiles').select('company_id').eq('user_id',user.id).maybeSingle();
        if(profileError) throw profileError;
        const scope=`wf:workspace-shortcuts:v1:${profile?.company_id||'owner'}:${user.id}`;
        let selected:string[]=[];
        try { const stored=JSON.parse(localStorage.getItem(scope)||'[]');if(Array.isArray(stored)) selected=[...new Set(stored.filter((id):id is string=>typeof id==='string'))]; } catch { /* Preferência inválida não bloqueia a navegação. */ }
        if(active){setIds(selected);setKey(scope);}
      }catch{if(active)setError('Não foi possível carregar seus atalhos. Os módulos continuam disponíveis no menu lateral.');}
    }
    void load();return()=>{active=false;};
  },[]);
  function save(next:string[]){
    if(!key)return false;
    try{localStorage.setItem(key,JSON.stringify(next));setIds(next);setError('');return true;}
    catch{setError('Não foi possível salvar os atalhos neste navegador. Sua seleção ainda não foi salva.');return false;}
  }
  return {ids,ready:key!==null,error,save};
}
