#!/bin/bash

# =====================================================
# ADMIN ROLES FIX - Quick Supabase SQL Application
# =====================================================
# This script extracts the SQL fix and displays it for
# manual execution in Supabase SQL Editor
# =====================================================

echo "🔧 Admin Roles Page Fix - SQL Injection Helper"
echo "=============================================="
echo ""
echo "✅ IMPORTANT: You need to execute this SQL in Supabase Dashboard"
echo ""
echo "Steps:"
echo "1. Open: https://app.supabase.com/project/[your-project]/sql/new"
echo "2. Copy the SQL below (from --- START to --- END)"
echo "3. Paste into Supabase SQL Editor"
echo "4. Click 'Run' button"
echo "5. Refresh your app at app.workflux.com.br/admin/roles"
echo ""
echo "--- START SQL COPY HERE ---"
echo ""

# Display the SQL file
cat "supabase/migrations/20260703_ADMIN_ROLES_FIX_RLS.sql"

echo ""
echo "--- END SQL COPY HERE ---"
echo ""
echo "✅ All done! Your /admin/roles page should now load with data."
echo ""
