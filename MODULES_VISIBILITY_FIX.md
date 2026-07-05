# Fix: Módulos Visíveis baseado em company_modules — 2026-07-04

## Problema Resolvido
**Leticia** (e qualquer usuário com roles restritivos) estava vendo **TODOS os módulos** no menu, quando deveria ver apenas aqueles configurados em `company_modules` para sua empresa.

### Sintomas
- Letica tem apenas "WF Obras + WF Relatórios + WF Engenharia" configurados no Painel de Controle
- Mas ela vê: Hub, WF Obras, WF Equipamentos, WF Carreteiros, Diretório, VT Transporte no menu
- Esperado: Apenas Hub (sempre), WF Obras, WF Relatórios, WF Engenharia, Diretório, VT Transporte

### Causa Raiz
**`AppSidebar.tsx` não estava filtrando módulos.**

Código anterior:
```tsx
const baseItems = [
  { title: "Hub", url: "/", icon: LayoutDashboard },
  { title: "CI RDO", url: "/obras", icon: FileText },
  { title: "WF Equipamentos", url: "/equipamentos", icon: FileText },
  { title: "WF Carreteiros", url: "/carreteiros", icon: Truck },
  // ... hardcoded, sem filtro
];

export function AppSidebar() {
  // ... sem usar useCompanyModules
  return (
    <SidebarMenu>
      {baseItems.map((item) => (...))} {/* Sempre mostra tudo */}
    </SidebarMenu>
  );
}
```

## Solução Implementada

### 1. **Integrar `useCompanyModules` hook** (já existia, mas não era usado)

```tsx
const { hasModule, loading, isSuperAdmin, modules } = useCompanyModules();
```

### 2. **Criar mapa de módulos contratados → itens do sidebar**

```tsx
const moduleItems: Record<string, { title: string; url: string; icon: any }> = {
  "WF Obras": { title: "WF Obras", url: "/obras", icon: FileText },
  "WF Equipamentos": { title: "WF Equipamentos", url: "/equipamentos", icon: FileText },
  "WF Carreteiros": { title: "WF Carreteiros", url: "/carreteiros", icon: Truck },
  "WF Relatórios": { title: "WF Relatórios", url: "/relatorios", icon: FileText },
  "WF Engenharia": { title: "WF Engenharia", url: "/engenharia", icon: FileText },
  // ... mais módulos
};
```

### 3. **Separar itens sempre visíveis (baseados em permissions, não company_modules)**

```tsx
const alwaysVisibleItems = [
  { title: "Hub", url: "/", icon: LayoutDashboard },
  { title: "Diretório", url: "/diretorio", icon: Search },
  { title: "VT Transporte", url: "/vale-transporte", icon: Bus },
];
```

### 4. **Filtrar dinamicamente baseado no estado de carregamento e role do usuário**

```tsx
useEffect(() => {
  if (loading) return; // Aguarda carregamento de módulos

  // Super-admin vê TODOS os módulos
  if (isSuperAdmin) {
    setVisibleItems([...alwaysVisibleItems, ...Object.values(moduleItems)]);
    return;
  }

  // Usuário comum: filtra por company_modules
  const moduleKeys = modules || [];
  const allowedItems = moduleKeys
    .map(moduleId => moduleItems[moduleId])
    .filter(Boolean);

  setVisibleItems([...alwaysVisibleItems, ...allowedItems]);
}, [loading, isSuperAdmin, modules]);
```

## Fluxo Pós-Fix

1. **Super-admin (role='superadmin')**
   - `useCompanyModules()` retorna `isSuperAdmin=true`
   - Vê TODOS os módulos no sidebar

2. **Admin de empresa (role=null, mas tem WF Obras + WF Relatórios em company_modules)**
   - `useCompanyModules()` carrega `modules=['WF Obras', 'WF Relatórios']`
   - Filtra `moduleItems` para obter apenas esses
   - Renderiza: Hub + WF Obras + WF Relatórios + Diretório + VT Transporte

3. **Usuário comum (sem role, sem company_modules)**
   - `useCompanyModules()` retorna `modules=[]`
   - Renderiza: Hub + Diretório + VT Transporte apenas

## Dados Necessários (Supabase)

Certifique-se que **`company_modules`** está preenchido para a empresa de Leticia:

```sql
-- Verificar modules de Leticia
SELECT 
  c.id, c.name,
  STRING_AGG(cm.modulo, ', ') as modulos
FROM companies c
LEFT JOIN company_modules cm ON cm.company_id = c.id AND cm.ativo = true
WHERE c.id = (
  SELECT company_id FROM profiles WHERE user_id = 'leticia_user_id'
)
GROUP BY c.id, c.name;
```

Se faltarem, inserir:
```sql
INSERT INTO company_modules (company_id, modulo, ativo, created_at)
VALUES
  (company_id_here, 'WF Obras', true, now()),
  (company_id_here, 'WF Relatórios', true, now()),
  (company_id_here, 'WF Engenharia', true, now());
```

## QA Verification (Post-Deploy)

### Para Leticia (admin de empresa):
1. Hard refresh: Cmd+Shift+R
2. Menu deve mostrar **APENAS**: Hub, WF Obras, WF Relatórios, WF Engenharia, Diretório, VT Transporte (6 itens)
3. **NÃO deve mostrar**: WF Equipamentos, WF Carreteiros

### Para Super-admin (ou usuário que seja):
1. Hard refresh: Cmd+Shift+R
2. Menu deve mostrar **TODOS** os módulos (15+ itens)

### Para usuário sem company_modules:
1. Menu deve mostrar**: Hub, Diretório, VT Transporte (3 itens apenas)

## Commit Hash
```
3b3d72f fix: Filtrar módulos da sidebar baseado em company_modules - resolve visibilidade de Leticia
```

## Files Changed
- `src/components/AppSidebar.tsx` (+65 linhas, -5 linhas)

## Deployment
- Pushed: 2026-07-04
- Vercel build: ✅ Success (5.91s)
- Status: Ready at https://app.workflux.com.br

---

## Próximas Melhorias (Future)
1. Adicionar labels "Em Breve" para módulos não-contratados (UX)
2. Renderizar dinamicamente baseado em uma tabela de config central (ao invés de hardcoded `moduleItems`)
3. Adicionar tooltip mostrando qual empresa contratou qual módulo
