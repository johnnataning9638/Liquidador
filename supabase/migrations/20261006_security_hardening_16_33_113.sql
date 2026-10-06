BEGIN;

ALTER FUNCTION public.cartera_update_field(text,bigint,text,text) SECURITY INVOKER;
ALTER FUNCTION public.cartera_bulk_update_field(text,bigint[],text,text) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.cartera_update_field(text,bigint,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cartera_bulk_update_field(text,bigint[],text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cartera_update_field(text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_bulk_update_field(text,bigint[],text,text) TO authenticated;

DROP POLICY IF EXISTS cartera_access_admin_insert ON public.cartera_acceso;
CREATE POLICY cartera_access_admin_insert
ON public.cartera_acceso
FOR INSERT
TO authenticated
WITH CHECK (
  lower(email) = (select lower(auth.jwt()->>'email'))
  AND EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE lower(au.email) = (select lower(auth.jwt()->>'email'))
  )
);

DROP POLICY IF EXISTS cartera_access_select ON public.cartera_acceso;
CREATE POLICY cartera_access_select
ON public.cartera_acceso
FOR SELECT
TO authenticated
USING (lower(email) = (select lower(auth.jwt()->>'email')));

COMMIT;
