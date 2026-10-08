import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useHubAccess } from './useHubAccess';
const state=vi.hoisted(()=>({admin:false,superAdmin:false,contracted:true,panel:true,permissions:{} as Record<string,boolean>}));
vi.mock('@/hooks/useIsAdmin',()=>({useIsAdmin:()=>({isAdmin:state.admin})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({permissions:state.permissions,loading:false,semPerfil:false})}));
vi.mock('@/hooks/useCompanyModules',()=>({useCompanyModules:()=>({hasModule:()=>state.contracted,loading:false,isSuperAdmin:state.superAdmin,companyLogo:null})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='profiles'?{company_id:'test-company'}:{can_access_panel:state.panel}})};return q;}}}));
afterEach(()=>{cleanup();state.admin=false;state.superAdmin=false;state.contracted=true;state.panel=true;state.permissions={};});
async function modules(){const {result}=renderHook(()=>useHubAccess());await waitFor(()=>expect(result.current.loading).toBe(false));return result.current.modules.map(m=>m.id);}
describe('Navegação compartilhada — mesmas concessões do Home',()=>{
 it('operador vê apenas seu módulo autorizado',async()=>{state.permissions={modulo_obras:true};expect(await modules()).toEqual(['obras']);});
 it('admin por role não libera automaticamente todos os módulos',async()=>{state.admin=true;state.permissions={modulo_relatorios:true};expect(await modules()).toEqual(['relatorios','admin']);});
 it('bloqueio explícito do painel prevalece no menu',async()=>{state.admin=true;state.panel=false;state.permissions={modulo_relatorios:true};expect(await modules()).toEqual(['relatorios']);});
 it('admin legado não ignora módulos contratados',async()=>{state.permissions={is_admin:true};state.contracted=false;state.panel=false;expect(await modules()).toEqual([]);});
});
