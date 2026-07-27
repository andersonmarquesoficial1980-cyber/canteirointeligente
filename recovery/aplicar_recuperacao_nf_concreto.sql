-- SQL gerado automaticamente para recuperação de NF Concreto
begin;
update public.rdo_diarios set empreiteiro = 'EMPREITEIRA VALIDAÇÃO' where id = '753931fd-2af9-435d-b58c-7ccfeeeaa525' and company_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
insert into public.rdo_nf_concreto (rdo_id, company_id, nf, quantidade_m3, tipo_concreto, fornecedor, foto_url) select '753931fd-2af9-435d-b58c-7ccfeeeaa525', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'VAL-2707-001', 18.50, 'FCK 30', 'USINA SP', null where not exists (select 1 from public.rdo_nf_concreto x where x.rdo_id = '753931fd-2af9-435d-b58c-7ccfeeeaa525' and coalesce(x.nf,'') = coalesce('VAL-2707-001','') and coalesce(x.tipo_concreto,'') = coalesce('FCK 30','') and coalesce(x.fornecedor,'') = coalesce('USINA SP','') and coalesce(x.quantidade_m3,-1) = coalesce(18.50,-1));
commit;
