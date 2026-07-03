-- =====================================================
-- ADMIN ROLES SYSTEM - EXEMPLOS DE USO CORRETO
-- =====================================================

-- ✅ EXEMPLO 1: Check se usuário tem permissão
-- Em seu backend (Supabase Edge Function, API Route, etc):
SELECT public.has_admin_permission(
  auth.uid()::uuid,        -- Converte UUID para UUID (redundante mas seguro)
  'rdo_diarios',           -- resource
  'view'                   -- action
) AS user_can_view_rdo;

-- ✅ EXEMPLO 2: Check sector-scoped access
SELECT public.has_sector_access(
  auth.uid()::uuid,        -- user_id
  'abastecimentos',        -- resource
  'create',               -- action
  'fuel'                  -- sector
) AS user_can_create_fuel;

-- ✅ EXEMPLO 3: Check se user é Super_Admin
SELECT EXISTS (
  SELECT 1 FROM public.user_admin_roles uar
  INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
  WHERE uar.employee_id = auth.uid()::uuid
    AND ar.name = 'Super_Admin'
    AND uar.is_active = TRUE
) AS is_super_admin;

-- ✅ EXEMPLO 4: Listar todos os roles de um usuário
SELECT ar.id, ar.name, ar.description
FROM public.user_admin_roles uar
INNER JOIN public.admin_roles ar ON ar.id = uar.role_id
WHERE uar.employee_id = auth.uid()::uuid
  AND uar.is_active = TRUE;

-- ✅ EXEMPLO 5: Listar todas as permissions de um role
SELECT 
  ap.id,
  ap.resource,
  ap.action,
  ap.is_sector_scoped,
  ap.sector_filter
FROM public.admin_permissions ap
INNER JOIN public.admin_roles ar ON ar.id = ap.role_id
WHERE ar.id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- role_id
ORDER BY ap.resource, ap.action;

-- ✅ EXEMPLO 6: Assinhar um role a um usuário (Super_Admin only)
INSERT INTO public.user_admin_roles (
  employee_id,
  role_id,
  company_id,
  scope_sector,
  scope_obra,
  assigned_by,
  is_active
)
VALUES (
  'a00e8400-e29b-41d4-a716-446655440001'::uuid,  -- employee_id
  'b10e8400-e29b-41d4-a716-446655440000'::uuid,  -- role_id (RDO_Admin)
  'c20e8400-e29b-41d4-a716-446655440000'::uuid,  -- company_id
  'rdo',                                          -- scope_sector
  NULL,                                           -- scope_obra
  auth.uid()::uuid,                              -- assigned_by
  TRUE                                            -- is_active
)
ON CONFLICT (employee_id, role_id) 
DO UPDATE SET 
  is_active = TRUE,
  revoked_at = NULL;

-- ✅ EXEMPLO 7: Revocar um role (soft delete)
UPDATE public.user_admin_roles
SET 
  is_active = FALSE,
  revoked_at = now()
WHERE employee_id = 'a00e8400-e29b-41d4-a716-446655440001'::uuid
  AND role_id = 'b10e8400-e29b-41d4-a716-446655440000'::uuid;

-- ✅ EXEMPLO 8: Log concreto de ação admin
SELECT public.log_admin_action(
  auth.uid()::uuid,                              -- admin_id (quem fez)
  'update',                                      -- action
  'rdo_diarios',                                 -- resource
  'd30e8400-e29b-41d4-a716-446655440000',       -- resource_id
  '{"status": "rascunho", "obras": 5}'::jsonb,  -- changes_before
  '{"status": "finalizado", "obras": 5}'::jsonb -- changes_after
);

-- ✅ EXEMPLO 9: Usar dentro de RLS Policy (exemplo)
-- Em uma policy, você pode usar has_admin_permission:
CREATE POLICY "admin_view_rdo_diarios" ON public.rdo_diarios
  FOR SELECT USING (
    -- Permite se user tem admin permission
    public.has_admin_permission(auth.uid()::uuid, 'rdo_diarios', 'view')
    -- OU permite se criou o registro
    OR created_by = auth.uid()::uuid
  );

-- ✅ EXEMPLO 10: Query complexa - RDO admin pode ver RDO diários do seu sector
SELECT rd.* 
FROM public.rdo_diarios rd
WHERE public.has_sector_access(
  auth.uid()::uuid,
  'rdo_diarios',
  'view',
  'rdo'
);

-- ✅ EXEMPLO 11: Audit Log - verificar ações recentes
SELECT 
  aal.created_at,
  aal.action,
  aal.resource,
  e.name AS admin_name,
  aal.changes_after
FROM public.admin_audit_log aal
LEFT JOIN public.employees e ON e.id = aal.admin_id
WHERE aal.company_id = 'c20e8400-e29b-41d4-a716-446655440000'::uuid
ORDER BY aal.created_at DESC
LIMIT 100;

-- ✅ EXEMPLO 12: Dashboard - Roles assignment manager (para Super_Admin)
SELECT 
  e.id,
  e.name AS employee_name,
  ar.id AS role_id,
  ar.name AS role_name,
  uar.scope_sector,
  uar.is_active,
  uar.assigned_at,
  uar.revoked_at
FROM public.employees e
LEFT JOIN public.user_admin_roles uar ON uar.employee_id = e.id AND uar.is_active = TRUE
LEFT JOIN public.admin_roles ar ON ar.id = uar.role_id
WHERE e.company_id = 'c20e8400-e29b-41d4-a716-446655440000'::uuid
  AND public.has_admin_permission(auth.uid()::uuid, 'admin_roles', 'view')
ORDER BY e.name, ar.name;

-- =====================================================
-- REACT/TYPESCRIPT EXAMPLES
-- =====================================================

/*
// ✅ TypeScript - Hook para verificar permission
import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

export function useAdminPermission(resource: string, action: string) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkPermission = async () => {
      try {
        const { data, error } = await supabase
          .rpc('has_admin_permission', {
            p_user_id: user.id,  // ✅ Supabase passa UUID automático
            p_resource: resource,
            p_action: action,
          });

        if (error) throw error;
        setHasPermission(data ?? false);
      } catch (err) {
        console.error('Permission check failed:', err);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [user?.id, resource, action, supabase]);

  return { hasPermission, loading };
}

// ✅ Uso do hook
function AdminPanel() {
  const { hasPermission, loading } = useAdminPermission('admin_roles', 'view');

  if (loading) return <div>Checking permissions...</div>;
  if (!hasPermission) return <div>Access Denied</div>;

  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Content here */}
    </div>
  );
}
*/

-- =====================================================
-- SUPABASE REALTIME EXAMPLE
-- =====================================================

/*
// ✅ Subscribe to admin_audit_log changes (live updates)
import { useSupabaseClient } from '@supabase/auth-helpers-react';

useEffect(() => {
  const subscription = supabase
    .channel('admin_audit_log')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_audit_log',
      },
      (payload) => {
        console.log('New admin action:', payload.new);
        // Update UI with new audit entry
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, [supabase]);
*/

-- =====================================================
-- COMMON ERRORS & FIXES
-- =====================================================

-- ❌ ERROR: "operator does not exist: text = uuid"
-- SELECT ... WHERE id::text = auth.uid()
-- ✅ FIX: Cast both sides to same type OR neither
-- SELECT ... WHERE id = auth.uid()::uuid

-- ❌ ERROR: "column reference is ambiguous"
-- SELECT id FROM admin_roles WHERE id = admin_permissions.role_id
-- ✅ FIX: Use table aliases
-- SELECT ar.id FROM admin_roles ar WHERE ar.id = ap.role_id

-- ❌ ERROR: "null value in column "company_id" violates not-null constraint"
-- INSERT INTO admin_roles (name, company_id) VALUES ('Test', NULL)
-- ✅ FIX: company_id é nullable, só é NOT NULL se você declarou assim
-- INSERT INTO admin_roles (name, company_id) VALUES ('Test', NULL)  -- OK

-- ❌ ERROR: "policy already exists"
-- Running same migration twice without DROP IF EXISTS
-- ✅ FIX: Always use DROP POLICY IF EXISTS before CREATE POLICY

-- ====================================================== 
-- MIGRATION STATUS CHECKS
-- ======================================================

-- Check migration version
SELECT 
  version,
  description,
  installed_on,
  success
FROM schema_migrations
ORDER BY version DESC
LIMIT 5;

-- Check table creation timestamps
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||table_name)) AS size,
  (SELECT max(created_at) FROM information_schema.columns 
   WHERE information_schema.columns.table_name=t.table_name) AS last_updated
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name LIKE 'admin_%'
ORDER BY table_name;

-- Check that all functions are executable by authenticated role
SELECT 
  p.proname,
  p.pronargs,
  proisagg,
  l.lanname,
  (SELECT string_agg(format_type(t.oid, 0), ',' ORDER BY ordinality) 
   FROM (SELECT ordinality, oid FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY) t
  ) AS arguments
FROM pg_proc p
JOIN pg_language l ON l.oid = p.prolang
WHERE p.proname IN ('has_admin_permission', 'has_sector_access', 'log_admin_action')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
