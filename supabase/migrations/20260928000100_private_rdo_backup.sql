-- Approved containment: preserve data and administrative/service access.
-- No application consumer of rdo_dedup_backup exists in the inspected source.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.rdo_dedup_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.rdo_dedup_backup FROM PUBLIC, anon, authenticated;
COMMIT;
