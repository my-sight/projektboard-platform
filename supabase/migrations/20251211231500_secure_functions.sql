-- Secure functions by setting explicit search_path
-- This fixes "Security Definer" linter warnings

ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.cleanup_old_data() SET search_path = public;
