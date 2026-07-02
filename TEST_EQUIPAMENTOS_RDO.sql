-- TEST QUERY: Para dia 26/06/2026, OGS 2509, buscar todos os equipamentos
-- Esperado: 9 equipamentos (FA26, BC75, VA03, CH06, CE04, OWP7I87, CM04, COMP-CBUQ03, ROMP-CBUQ03)

-- PASSO 1: Buscar RDOs para encarregado GIVANILDO (ou qualquer filtro) entre 01/06 e 02/07
SELECT 
  id, data, obra_nome, encarregado, user_id, turno
FROM rdo_diarios
WHERE 
  data >= '2026-06-01'
  AND data <= '2026-07-02'
  AND (obra_nome = '2509' OR encarregado LIKE '%GIVANILDO%')
ORDER BY data DESC;

-- PASSO 2: Buscar equipamentos para os RDOs acima (filtrar por data 26/06 para confirmar)
-- Nota: Este é o PASSO CRÍTICO - sem equipamentos aqui, fallback para RDO

SELECT 
  id, 
  frota, 
  empresa_dona, 
  rdo_id, 
  categoria, 
  tipo, 
  sub_tipo, 
  nome, 
  patrimonio,
  -- Join com rdo_diarios para ver a data
  rd.data,
  rd.obra_nome
FROM rdo_equipamentos re
LEFT JOIN rdo_diarios rd ON rd.id = re.rdo_id
WHERE 
  rd.data = '2026-06-26'
  AND rd.obra_nome = '2509'
ORDER BY re.frota;

-- PASSO 3: Verificar se existem nomes de empregados na tabela employees
SELECT id, name FROM employees WHERE id IN (SELECT DISTINCT user_id FROM rdo_diarios WHERE data = '2026-06-26' AND obra_nome = '2509');

-- PASSO 4: Verificar OGS Reference
SELECT ogs_number, client_name, location_address FROM ogs_reference WHERE ogs_number = '2509';

-- PASSO 5: Verificar Frotas e Empresas em maquinas_frota
SELECT DISTINCT frota, empresa FROM maquinas_frota WHERE frota IN ('FA26', 'BC75', 'VA03', 'CH06', 'CE04', 'OWP7I87', 'CM04', 'COMP-CBUQ03', 'ROMP-CBUQ03');
