-- Force PostgREST schema cache refresh (Supabase introspection)
NOTIFY pgrst, 'reload schema';