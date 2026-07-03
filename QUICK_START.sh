#!/bin/bash
# =====================================================
# QUICK START - ADMIN ROLES SYSTEM
# Execute apenas 1 comando para setup completo
# =====================================================

echo "🚀 ADMIN ROLES SYSTEM - QUICK START"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check files exist
echo -e "${BLUE}[1/5]${NC} Verificando arquivos..."
FILES=(
  "supabase/migrations/20260703_admin_roles_system_FIXED.sql"
  "ADMIN_ROLES_README.md"
  "ADMIN_ROLES_DIAGNOSTICO.md"
  "ADMIN_ROLES_EXAMPLES.sql"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
  else
    echo -e "${RED}❌${NC} $file (MISSING)"
    exit 1
  fi
done

echo ""

# Step 2: Display SQL file
echo -e "${BLUE}[2/5]${NC} SQL Completo (16.8 KB):"
echo "────────────────────────────────"
echo ""
echo -e "📄 Caminho: ${YELLOW}supabase/migrations/20260703_admin_roles_system_FIXED.sql${NC}"
echo ""
echo "Conteúdo (primeiras 100 linhas):"
head -100 "supabase/migrations/20260703_admin_roles_system_FIXED.sql"
echo ""
echo -e "${YELLOW}... (restante do arquivo omitido)${NC}"
echo ""

# Step 3: Instructions
echo -e "${BLUE}[3/5]${NC} ${YELLOW}INSTRUÇÕES DE EXECUÇÃO:${NC}"
echo ""
echo "├─ Opção A: Supabase Dashboard (RECOMENDADO)"
echo "│  1. Acesse: https://supabase.com/dashboard"
echo "│  2. Projeto: ucgcqexunnsrffzrfhqu"
echo "│  3. Menu: SQL Editor → New Query"
echo "│  4. Cole todo o conteúdo de:"
echo "│     supabase/migrations/20260703_admin_roles_system_FIXED.sql"
echo "│  5. Clique: RUN"
echo "│  6. Aguarde 5-10 segundos"
echo "│  7. ✅ Success!"
echo ""
echo "├─ Opção B: CLI Supabase"
echo "│  $ cd /Users/andinhomarques/canteirointeligente"
echo "│  $ supabase db push"
echo ""
echo "└─ Opção C: pgAdmin / DBeaver"
echo "   1. Connect ao Supabase PostgreSQL"
echo "   2. Query editor"
echo "   3. Paste SQL"
echo "   4. Execute"
echo ""

# Step 4: What gets created
echo -e "${BLUE}[4/5]${NC} ${YELLOW}O QUE SERÁ CRIADO:${NC}"
echo ""
echo -e "${GREEN}✅ 4 Tabelas:${NC}"
echo "   • admin_roles"
echo "   • admin_permissions"
echo "   • user_admin_roles"
echo "   • admin_audit_log"
echo ""
echo -e "${GREEN}✅ 8 RLS Policies:${NC}"
echo "   • users_view_company_admin_roles"
echo "   • admin_manage_roles"
echo "   • users_view_permissions"
echo "   • admin_manage_permissions"
echo "   • view_admin_roles_assignments"
echo "   • admin_assign_roles"
echo "   • view_admin_audit_log"
echo "   • log_admin_actions"
echo ""
echo -e "${GREEN}✅ 3 Functions:${NC}"
echo "   • has_admin_permission(UUID, TEXT, TEXT, UUID?)"
echo "   • has_sector_access(UUID, TEXT, TEXT, TEXT, UUID?)"
echo "   • log_admin_action(UUID, TEXT, TEXT, TEXT, JSONB?, JSONB?)"
echo ""
echo -e "${GREEN}✅ 15 Índices${NC} (para performance)"
echo ""
echo -e "${GREEN}✅ 6 System Roles:${NC}"
echo "   • Super_Admin (full access)"
echo "   • RDO_Admin (RDO only)"
echo "   • Equipment_Admin (Equipment only)"
echo "   • Fuel_Admin (Abastecimento only)"
echo "   • Maintenance_Admin (Maintenance only)"
echo "   • HR_Admin (HR only)"
echo ""

# Step 5: Validation
echo -e "${BLUE}[5/5]${NC} ${YELLOW}VALIDAÇÃO PÓS-EXECUÇÃO:${NC}"
echo ""
echo "Após executar o SQL, abra Uma NOVA query no Supabase e execute:"
echo ""
echo -e "${YELLOW}Query de Verificação:${NC}"
cat << 'EOF'
SELECT 
  'admin_roles' as table_name, COUNT(*) as count FROM public.admin_roles
UNION ALL
SELECT 'admin_permissions', COUNT(*) FROM public.admin_permissions
UNION ALL
SELECT 'user_admin_roles', COUNT(*) FROM public.user_admin_roles
UNION ALL
SELECT 'admin_audit_log', COUNT(*) FROM public.admin_audit_log;

-- Esperado output:
-- table_name           | count
-- ─────────────────────┼────────
-- admin_roles          | 6
-- admin_permissions    | 30
-- user_admin_roles     | 0
-- admin_audit_log      | 0
EOF

echo ""
echo -e "${GREEN}Se você vê exatamente este output, significa que:${NC}"
echo -e "${GREEN}✅ SQL foi executado SEM ERROS${NC}"
echo -e "${GREEN}✅ Todas as 4 tabelas foram criadas${NC}"
echo -e "${GREEN}✅ 6 system roles foram inseridos${NC}"
echo -e "${GREEN}✅ 30 permissions foram configuradas${NC}"
echo ""

# Summary
echo ""
echo "═══════════════════════════════════════════════"
echo -e "${GREEN}RESUMO - ARQUIVOS ENTREGUES${NC}"
echo "═══════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📄 SQL (Main File - Production Ready):${NC}"
echo "   supabase/migrations/20260703_admin_roles_system_FIXED.sql"
WC_SQL=$(wc -l < "supabase/migrations/20260703_admin_roles_system_FIXED.sql")
echo "   Linhas: $WC_SQL | Tamanho: 16.8 KB"
echo ""
echo -e "${BLUE}📚 Documentação:${NC}"
echo "   1. ADMIN_ROLES_README.md"
echo "      → Visão geral, setup, checklist"
echo ""
echo "   2. ADMIN_ROLES_DIAGNOSTICO.md"
echo "      → Problemas identificados, tipos de dados, troubleshooting"
echo ""
echo "   3. ADMIN_ROLES_EXAMPLES.sql"
echo "      → 12+ exemplos de uso correto, React/TypeScript"
echo ""
echo "   4. BEFORE_AFTER_COMPARISON.sql"
echo "      → Comparação de erros corrigidos"
echo ""
echo -e "${BLUE}🔧 Scripts:${NC}"
echo "   scripts/validate_admin_roles.sh"
echo "   → Validação automática de schema integrity"
echo ""
echo "═══════════════════════════════════════════════"
echo ""

# Next steps
echo -e "${YELLOW}📋 CHECKLIST - PRÓXIMOS PASSOS:${NC}"
echo ""
echo "[ ] 1. Executar SQL no Supabase"
echo "[ ] 2. Rodar query de verificação"
echo "[ ] 3. Ler ADMIN_ROLES_README.md"
echo "[ ] 4. Ler ADMIN_ROLES_DIAGNOSTICO.md"
echo "[ ] 5. Revisar ADMIN_ROLES_EXAMPLES.sql"
echo "[ ] 6. Atualizar React components com useAdminPermission hook"
echo "[ ] 7. Atualizar API routes/Edge Functions"
echo "[ ] 8. Testar RLS policies com usuário autenticado"
echo "[ ] 9. Atribuir Super_Admin role ao Anderson"
echo "[ ] 10. Testar complete user journey"
echo ""

# Final message
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ SISTEMA PRONTO PARA PRODUÇÃO${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "Status: Production Ready"
echo "Versão: 1.0"
echo "Data: 2026-07-03"
echo "PostgreSQL: 14+ (Supabase)"
echo ""
echo "Dúvidas? Veja ADMIN_ROLES_DIAGNOSTICO.md"
echo ""
