-- QUERY PARA ENCONTRAR EQUIPAMENTOS DO RDO
-- Estratégia: Testar ambas as tabelas (rdo_equipamentos E equipment_diaries)

-- OPÇÃO 1: Equipamentos do RDO (rdo_equipamentos)
-- Retorna diretamente da tabela de equipamentos do RDO
SELECT 
  rd.data,
  rd.obra_nome as ogs,
  rd.encarregado as apontador,
  re.frota,
  COALESCE(re.tipo, re.categoria, '-') as equipamento,
  re.empresa_dona as empresa,
  rd.turno
FROM rdo_diarios rd
LEFT JOIN rdo_equipamentos re ON rd.id = re.rdo_id
WHERE rd.data = '2026-06-26'
  AND rd.obra_nome = '2509'
ORDER BY rd.data, re.frota;

-- OPÇÃO 2: Equipamentos de diário (equipment_diaries) - ALTERNATIVA
-- Se os equipamentos estão em equipment_diaries em vez de rdo_equipamentos
SELECT 
  ed.date,
  ed.ogs_number,
  ed.operator_name,
  ed.equipment_fleet,
  ed.equipment_type,
  ed.attachment_type,
  ed.period
FROM equipment_diaries ed
WHERE ed.date = '2026-06-26'
  AND ed.ogs_number = '2509'
ORDER BY ed.date, ed.equipment_fleet;

-- OPÇÃO 3: Query correta esperada (formato Anderson)
-- Formato esperado: Data, OGS, Apontador (nome), Frota (9x), Equipamento, Empresa
SELECT 
  rd.data as data,
  rd.obra_nome as ogs,
  COALESCE(e.name, rd.encarregado) as apontador,
  re.frota,
  COALESCE(re.nome, re.tipo, re.categoria, '-') as equipamento,
  re.empresa_dona as empresa,
  rd.turno
FROM rdo_diarios rd
LEFT JOIN rdo_equipamentos re ON rd.id = re.rdo_id
LEFT JOIN employees e ON rd.user_id = e.id
WHERE rd.data = '2026-06-26'
  AND rd.obra_nome = '2509'
GROUP BY rd.id, rd.data, rd.obra_nome, rd.encarregado, rd.turno, e.name, 
         re.id, re.frota, re.nome, re.tipo, re.categoria, re.empresa_dona
ORDER BY rd.data DESC, re.frota;
