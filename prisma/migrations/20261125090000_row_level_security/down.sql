-- Turns RLS back off. Grants to the Supabase API roles are not restored: they
-- were never needed, and re-opening them is a deliberate, separate decision.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
