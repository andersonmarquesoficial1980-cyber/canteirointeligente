#!/usr/bin/env node

/**
 * DIAGNÓSTICO RLS para rdo_diarios
 * Usa Admin API do Supabase (via serviceRoleKey para queries administrativas)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const PROJECT_ID = 'ucgcqexunnsrffzrfhqu';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;

// Ler chave
const keyFile = path.join(process.env.HOME, '.hermes', 'workflux_key.txt');
let apiKey = '';
try {
  const keyData = fs.readFileSync(keyFile, 'utf-8').trim();
  apiKey = keyData.startsWith('1|[') ? keyData.slice(3, -1) : keyData;
} catch (e) {
  console.error('❌ ERRO: Não consegui ler a chave:', e.message);
  process.exit(1);
}

console.log('================================================================================');
console.log('DIAGNÓSTICO RLS POLICY: rdo_diarios → RDO_Admin');
console.log('================================================================================');
console.log(`Projeto: ${PROJECT_ID}`);
console.log(`URL: ${SUPABASE_URL}`);
console.log();

// Criar cliente com chave de serviço para queries administrativas
const supabase = createClient(SUPABASE_URL, apiKey);

async function runQuery(query, description) {
  console.log('\n' + '─'.repeat(80));
  if (description) console.log(`📋 ${description}`);
  console.log(`Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
  console.log('─'.repeat(80));

  try {
    const { data, error } = await supabase.rpc('query', { query });
    
    if (error) {
      console.log(`❌ Erro: ${error.message}`);
    } else {
      console.log('✅ Sucesso');
      console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    }
  } catch (e) {
    console.log(`❌ Exceção: ${e.message}`);
  }
}

async function main() {
  // ============================================================================
  // Teste 1: Estrutura da tabela
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('1️⃣  ESTRUTURA: rdo_diarios');
  console.log('='.repeat(80));

  await runQuery(`
    SELECT 
      column_name, 
      data_type, 
      is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'rdo_diarios' 
      AND table_schema = 'public'
    ORDER BY ordinal_position
  `, 'Colunas da tabela');

  // ============================================================================
  // Teste 2: Dados existentes
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('2️⃣  DADOS: Quantos RDOs existem?');
  console.log('='.repeat(80));

  await runQuery('SELECT COUNT(*) as total FROM rdo_diarios', 'Total de RDOs');

  await runQuery(`
    SELECT company_id, COUNT(*) as qtd 
    FROM rdo_diarios 
    GROUP BY company_id 
    ORDER BY qtd DESC
  `, 'RDOs por company_id');

  await runQuery(`
    SELECT id, company_id, employee_id, created_at 
    FROM rdo_diarios 
    LIMIT 3
  `, 'Amostra de dados (primeiros 3)');

  // ============================================================================
  // Teste 3: RLS Policies
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('3️⃣  RLS: Policies e Status');
  console.log('='.repeat(80));

  await runQuery(`
    SELECT 
      policyname,
      permissive,
      roles,
      qual,
      with_check
    FROM pg_policies
    WHERE tablename = 'rdo_diarios'
    ORDER BY policyname
  `, 'Todas as RLS policies de rdo_diarios');

  await runQuery(`
    SELECT 
      tablename,
      rowsecurity
    FROM pg_tables
    WHERE tablename = 'rdo_diarios' AND schemaname = 'public'
  `, 'RLS habilitado?');

  // ============================================================================
  // Teste 4: Perfil de Leticia
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('4️⃣  LETICIA: Dados do usuário RDO_Admin');
  console.log('='.repeat(80));

  await runQuery(`
    SELECT 
      id,
      name,
      email,
      company_id
    FROM profiles
    WHERE name ILIKE '%leticia%' OR email ILIKE '%leticia%'
    LIMIT 5
  `, 'Perfil de Leticia');

  // ============================================================================
  // Teste 5: Roles de Leticia
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('5️⃣  ROLES: user_admin_roles');
  console.log('='.repeat(80));

  await runQuery(`
    SELECT 
      user_id,
      role_id,
      is_active,
      assigned_at
    FROM user_admin_roles
    WHERE role_id = 'RDO_Admin' AND is_active = true
    LIMIT 10
  `, 'RDO_Admins ativos');

  // ============================================================================
  // Teste 6: Tenant (empresa)
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('6️⃣  EMPRESA: Fremix');
  console.log('='.repeat(80));

  await runQuery(`
    SELECT 
      id,
      name,
      slug
    FROM companies
    ORDER BY name
    LIMIT 10
  `, 'Empresas cadastradas');

  console.log('\n' + '='.repeat(80));
  console.log('FIM DO DIAGNÓSTICO');
  console.log('='.repeat(80));
}

main().catch(console.error);
