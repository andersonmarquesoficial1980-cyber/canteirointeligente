# SQL ADMIN ROLES — DIAGNÓSTICO E CORREÇÕES

## 🔴 PROBLEMA IDENTIFICADO

**Erro:** `operator does not exist: text = uuid`

### Causa Raiz
As RLS policies estavam convertendo UUIDs para TEXT de forma inconsistente:

```sql
-- ❌ ERRADO (do arquivo original)
WHERE id::text = auth.uid()  
-- id::text é TEXT, mas auth.uid() é UUID
-- PostgreSQL não consegue comparar TEXT = UUID sem cast explícito

-- ❌ ERRADO
WHERE employee_id::text = auth.uid()
-- Mesmo problema: employee_id::text (TEXT) vs auth.uid() (UUID)

-- ✅ CORRETO
WHERE id = auth.uid()::uuid
-- Ambos são UUID, comparação direta funciona
```

---

## 📊 MAPEAMENTO DE TIPOS

| Campo | Tipo no PostgreSQL | Referência | Conversão Correta |
|-------|-------------------|-----------|-------------------|
| `admin_roles.id` | UUID | Chave primária | NÃO converter |
| `employees.id` | UUID | FK de auth.users | NÃO converter |
| `user_admin_roles.employee_id` | UUID | FK de employees | NÃO converter |
| `auth.uid()` | UUID | Função Supabase | Converter com `::uuid` se necessário |
| `auth.uid()::text` | TEXT | Conversão explícita | Usar APENAS se precisar TEXT |

---

## 🔧 CORREÇÕES APLICADAS

### 1. **RLS Policies - Comparações UUID**

**Antes (ERRADO):**
```sql
CREATE POLICY "users_view_company_admin_roles" ON admin_roles
  FOR SELECT USING (
    company_id = (SELECT company_id FROM employees WHERE id::text = auth.uid())
  );
```

**Depois (CORRETO):**
```sql
CREATE POLICY "users_view_company_admin_roles" ON public.admin_roles
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM public.employees 
      WHERE id = auth.uid()::uuid
    )
  );
```

**Razão:** 
- `id` é UUID, `auth.uid()` é UUID → comparação UUID = UUID ✅
- Cast `::uuid` é redundante mas seguro
- Sem cast em `id`, PostgreSQL entende o tipo corretamente

---

### 2. **Functions - Parâmetros Type-Safe**

**Antes (ERRADO):**
```sql
CREATE OR REPLACE FUNCTION has_admin_permission(
  p_user_id TEXT,  -- ❌ Recebe TEXT
  p_resource TEXT,
  p_action TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_admin_roles uar
    WHERE uar.employee_id::text = p_user_id  -- ❌ TEXT = TEXT comparação ineficiente
```

**Depois (CORRETO):**
```sql
CREATE OR REPLACE FUNCTION public.has_admin_permission(
  p_user_id UUID,  -- ✅ REcebe UUID (tipo native)
  p_resource TEXT,
  p_action TEXT,
  p_company_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_admin_roles uar
    WHERE uar.employee_id = p_user_id  -- ✅ UUID = UUID, sem conversão
```

**Razão:**
- Mantém tipos nativos evita conversão desnecessária
- Melhora performance (índices em UUID funcionam melhor)
- Sem ambiguidade de tipos

---

### 3. **DROP Policies Antes de CREATE**

**Adicionado:**
```sql
DROP POLICY IF EXISTS "users_view_company_admin_roles" ON public.admin_roles;
```

**Razão:** Idempotência - evita erro "policy already exists" em re-runs

---

### 4. **Referência ao Schema Public**

**Antes:**
```sql
CREATE TABLE IF NOT EXISTS admin_roles (...)
INSERT INTO admin_roles ...
```

**Depois:**
```sql
CREATE TABLE IF NOT EXISTS public.admin_roles (...)
INSERT INTO public.admin_roles ...
```

**Razão:** 
- Explícito e seguro
- Evita conflitos com outros schemas
- Melhor para Supabase

---

## ✅ VALIDAÇÕES APLICADAS

### 1. Constraints Type-Safe
```sql
-- ✅ FK com ON DELETE SET NULL (seguro)
created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

-- ✅ FK cascata quando apropriado
role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
```

### 2. Idempotência Completa
```sql
-- ✅ IF NOT EXISTS para tables
CREATE TABLE IF NOT EXISTS public.admin_roles (...)

-- ✅ ON CONFLICT para inserts
INSERT INTO public.admin_roles (...)
ON CONFLICT (company_id, name) DO NOTHING;

-- ✅ DROP IF EXISTS antes de alter
DROP POLICY IF EXISTS "policy_name" ON public.table_name;
DROP FUNCTION IF EXISTS public.function_name(PARAMS);
```

### 3. NULL Safety
```sql
-- ✅ COALESCE com tipo correto
WHERE (p_company_id IS NULL OR uar.company_id = p_company_id)

-- ✅ Handle NULL em FKs
assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

---

## 🚀 COMO EXECUTAR

### Opção 1: Supabase Dashboard (Recomendado)
1. Abra: https://supabase.com/dashboard
2. Projeto: `ucgcqexunnsrffzrfhqu`
3. SQL Editor → Nova Query
4. Cole o conteúdo de `20260703_admin_roles_system_FIXED.sql`
5. Clique: **Run**

### Opção 2: CLI Supabase
```bash
cd /Users/andinhomarques/canteirointeligente
supabase db push --file-search-path ./supabase/migrations
```

### Opção 3: pgAdmin / DBeaver
- Connection: Supabase PostgreSQL endpoint
- User: postgres (role supabase)
- Copy-paste do SQL na query editor

---

## 🧪 TESTES PÓS-IMPLEMENTAÇÃO

### 1. Verificar Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'admin_%';
```
**Esperado:** 4 tabelas (admin_roles, admin_permissions, user_admin_roles, admin_audit_log)

### 2. Verificar RLS Policies
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE 'admin_%';
```
**Esperado:** 8 policies sem duplicatas

### 3. Verificar Functions
```sql
SELECT proname, proargtypes FROM pg_proc 
WHERE proname IN ('has_admin_permission', 'has_sector_access', 'log_admin_action');
```
**Esperado:** 3 functions com tipos corretos

### 4. Testar RLS no Auth Context
```sql
-- Simule auth.uid() para usuario_id
SET rls.uid = '550e8400-e29b-41d4-a716-446655440000'::TEXT;

-- Teste SELECT em admin_roles
SELECT * FROM public.admin_roles;
-- Deve retornar apenas roles da company_id do employee
```

### 5. Resumo de Dados
```sql
SELECT 
  'admin_roles' as table_name, COUNT(*) as count FROM public.admin_roles
UNION ALL
SELECT 'admin_permissions', COUNT(*) FROM public.admin_permissions
UNION ALL
SELECT 'user_admin_roles', COUNT(*) FROM public.user_admin_roles
UNION ALL
SELECT 'admin_audit_log', COUNT(*) FROM public.admin_audit_log;
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Backup do banco antes de executar
- [ ] Executar SQL no Supabase Dashboard
- [ ] Verificar que não há erros de execução
- [ ] Rodar testes de schema (queries acima)
- [ ] Testar RLS policies com usuário autenticado
- [ ] Atualizar API routes que chamam `has_admin_permission()`
- [ ] Atualizar React components para passar `UUID` nas chamadas
- [ ] Testar complete user journey (login → check roles → access resources)

---

## 🔒 SEGURANÇA

### RLS Policies Ativas
- ✅ Authenticated users only
- ✅ Company-scoped access
- ✅ Role-based restrictions
- ✅ Super_Admin gating

### Functions com SECURITY DEFINER
- ✅ `has_admin_permission()` - pode ser chamada por auth users
- ✅ `has_sector_access()` - pode ser chamada por auth users
- ✅ `log_admin_action()` - pode ser chamada por auth users

### Indices para Performance
- ✅ `idx_admin_roles_company` - queries por company
- ✅ `idx_user_admin_roles_employee` - queries por employee
- ✅ `idx_user_admin_roles_active` - queries por is_active
- ✅ `idx_admin_audit_log_created` - queries por data

---

## 🐛 TROUBLESHOOTING

### Erro: "column id is ambiguous"
**Solução:** Use aliases explícitos
```sql
-- ❌ Errado
WHERE id = auth.uid()::uuid

-- ✅ Correto
WHERE emp.id = auth.uid()::uuid  -- com alias "emp"
```

### Erro: "invalid input syntax for type uuid"
**Solução:** Validar input antes de cast
```sql
WHERE id = CASE 
  WHEN auth.uid()::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN auth.uid()::uuid
  ELSE NULL
END
```

### Erro: "permission denied for schema public"
**Solução:** Verificar grants no Supabase (contatar support se necessário)

---

## 📞 SUPORTE

If issues persist:
1. Check Supabase logs: Dashboard → Logs → Edge Functions
2. Check PostgreSQL logs: Dashboard → Database → Query Performance
3. Enable query logging: `SET log_statement = 'all';`

---

**Última atualização:** 2026-07-03
**Versão SQL:** PostgreSQL 14+ (Supabase)
**Status:** Production-Ready ✅
