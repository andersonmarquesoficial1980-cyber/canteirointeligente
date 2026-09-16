-- Regra de qualidade: todo item NÃO CONFORME exige foto
-- Escopo: checklist legado + checklist pré-op

begin;

create or replace function public.fn_require_photo_for_nao_ok_checklist()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'nao_ok' and coalesce(nullif(btrim(new.photo_url), ''), null) is null then
    raise exception 'Foto obrigatória para item NÃO CONFORME (%).', tg_table_name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Tabela legado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_require_photo_nao_ok_checklist_entries'
      AND tgrelid = 'public.checklist_entries'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_require_photo_nao_ok_checklist_entries
    BEFORE INSERT OR UPDATE OF status, photo_url
    ON public.checklist_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_require_photo_for_nao_ok_checklist();
  END IF;
END $$;

-- Tabela pré-op
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_require_photo_nao_ok_preop_entries'
      AND tgrelid = 'public.equipment_preop_checklist_entries'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_require_photo_nao_ok_preop_entries
    BEFORE INSERT OR UPDATE OF status, photo_url
    ON public.equipment_preop_checklist_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_require_photo_for_nao_ok_checklist();
  END IF;
END $$;

commit;
