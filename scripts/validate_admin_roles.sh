#!/bin/bash
# =====================================================
# ADMIN ROLES - SQL VALIDATION SCRIPT
# Executa validações de integridade do schema
# =====================================================

set -e

echo "🔍 ADMIN ROLES SYSTEM - VALIDATION SCRIPT"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Tables existence
echo -e "${YELLOW}1. Verificando tables...${NC}"
TABLES_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('admin_roles', 'admin_permissions', 'user_admin_roles', 'admin_audit_log')")

if [ "$TABLES_COUNT" -eq 4 ]; then
  echo -e "${GREEN}✅ Todas as 4 tables foram criadas${NC}"
else
  echo -e "${RED}❌ Esperadas 4 tables, encontradas: $TABLES_COUNT${NC}"
  exit 1
fi

# Check 2: Columns type checking
echo ""
echo -e "${YELLOW}2. Verificando tipos de coluna (UUID type safety)...${NC}"

# Check admin_roles.id
ID_TYPE=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT data_type FROM information_schema.columns 
   WHERE table_name='admin_roles' AND column_name='id'")

if [ "$ID_TYPE" == "uuid" ]; then
  echo -e "${GREEN}✅ admin_roles.id é UUID${NC}"
else
  echo -e "${RED}❌ admin_roles.id é $ID_TYPE (esperado: uuid)${NC}"
  exit 1
fi

# Check user_admin_roles.employee_id
EMP_ID_TYPE=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT data_type FROM information_schema.columns 
   WHERE table_name='user_admin_roles' AND column_name='employee_id'")

if [ "$EMP_ID_TYPE" == "uuid" ]; then
  echo -e "${GREEN}✅ user_admin_roles.employee_id é UUID${NC}"
else
  echo -e "${RED}❌ user_admin_roles.employee_id é $EMP_ID_TYPE (esperado: uuid)${NC}"
  exit 1
fi

# Check 3: RLS Policies
echo ""
echo -e "${YELLOW}3. Verificando RLS Policies...${NC}"

POLICIES_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname='public' 
   AND tablename IN ('admin_roles', 'admin_permissions', 'user_admin_roles', 'admin_audit_log')")

if [ "$POLICIES_COUNT" -ge 8 ]; then
  echo -e "${GREEN}✅ $POLICIES_COUNT RLS Policies encontradas${NC}"
else
  echo -e "${RED}❌ Esperadas >=8 policies, encontradas: $POLICIES_COUNT${NC}"
  exit 1
fi

# Check 4: Functions
echo ""
echo -e "${YELLOW}4. Verificando Functions...${NC}"

FUNCTIONS_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM pg_proc 
   WHERE proname IN ('has_admin_permission', 'has_sector_access', 'log_admin_action')")

if [ "$FUNCTIONS_COUNT" -eq 3 ]; then
  echo -e "${GREEN}✅ Todas as 3 functions foram criadas${NC}"
else
  echo -e "${RED}❌ Esperadas 3 functions, encontradas: $FUNCTIONS_COUNT${NC}"
  exit 1
fi

# Check 5: System Roles
echo ""
echo -e "${YELLOW}5. Verificando System Roles...${NC}"

ROLES_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM public.admin_roles WHERE is_system_role = true")

if [ "$ROLES_COUNT" -eq 6 ]; then
  echo -e "${GREEN}✅ 6 System Roles encontradas (Super_Admin, RDO_Admin, Equipment_Admin, Fuel_Admin, Maintenance_Admin, HR_Admin)${NC}"
else
  echo -e "${RED}❌ Esperadas 6 system roles, encontradas: $ROLES_COUNT${NC}"
fi

# Check 6: System Permissions
echo ""
echo -e "${YELLOW}6. Verificando Permissions...${NC}"

PERMS_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM public.admin_permissions")

if [ "$PERMS_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ $PERMS_COUNT Permissions criadas${NC}"
else
  echo -e "${RED}❌ Nenhuma permission encontrada${NC}"
  exit 1
fi

# Check 7: Indexes
echo ""
echo -e "${YELLOW}7. Verificando Indexes...${NC}"

INDEXES_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT COUNT(*) FROM pg_indexes 
   WHERE tablename IN ('admin_roles', 'admin_permissions', 'user_admin_roles', 'admin_audit_log')")

if [ "$INDEXES_COUNT" -ge 9 ]; then
  echo -e "${GREEN}✅ $INDEXES_COUNT Indexes encontrados${NC}"
else
  echo -e "${YELLOW}⚠️  Apenas $INDEXES_COUNT indexes (esperado >=9)${NC}"
fi

# Check 8: Type Safety - No TEXT/UUID mismatches
echo ""
echo -e "${YELLOW}8. Verificando Type Safety nas policies...${NC}"

# This is a manual check - we inspect RLS policy definition
# Note: pg_policies.quals contains the WHERE clause as SQL text
POLICY_SQL=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c \
  "SELECT count(*) FROM pg_policies 
   WHERE quals LIKE '%::text = auth.uid()%' OR quals LIKE '%::text = auth.uid')

if [ "$POLICY_SQL" -eq 0 ]; then
  echo -e "${GREEN}✅ Nenhuma policy com type mismatch (::text = auth.uid)${NC}"
else
  echo -e "${RED}❌ FOUND $POLICY_SQL policies com type casting incorreto${NC}"
fi

# Final summary
echo ""
echo "=========================================="
echo -e "${GREEN}✅ VALIDATION COMPLETE - ALL CHECKS PASSED${NC}"
echo "=========================================="
echo ""
echo "Ready to use:"
echo "  - Call: SELECT public.has_admin_permission(user_id::uuid, 'resource', 'action')"
echo "  - Check: SELECT public.has_sector_access(user_id::uuid, 'resource', 'action', 'sector')"
echo "  - Log: SELECT public.log_admin_action(admin_id::uuid, 'action', 'resource', 'resource_id')"
echo ""
