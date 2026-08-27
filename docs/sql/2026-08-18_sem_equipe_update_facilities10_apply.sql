-- Apply pontual Facilities (10)
BEGIN;
update employees set equipe='FACILITIES' where id='1cee03e3-cc0c-45ad-98aa-bedbda40ab18'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='e916e9ef-d3f9-4b51-be4e-b4a012dc1db7'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='4fdcc211-0202-488d-94dc-d59988e65c33'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='51fcfcff-f7d3-4861-b6ed-85c2a1685cfd'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='84676db4-d34d-4587-a0bc-f4510ed92812'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='0460a716-42ec-4ce2-a9d0-591187bd40f4'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='5f894f43-82ad-44c6-8824-a53a32f2f599'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='7cc8a6af-cf80-4c6d-aac8-e7e1beb1e0cf'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='c77e5949-e6d6-4d5a-ba6b-637fc7e46e01'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
update employees set equipe='FACILITIES' where id='e016f016-d1ff-4fbd-a8e9-52a47b075837'::uuid and company_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890' and (equipe is null or trim(equipe)='' or upper(trim(equipe))='SEM EQUIPE');
COMMIT;
