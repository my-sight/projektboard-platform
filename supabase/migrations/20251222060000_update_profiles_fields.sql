-- Migration: Add alias, preferred_language and department_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'de';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create index for performance if needed
CREATE INDEX IF NOT EXISTS profiles_department_id_idx ON public.profiles(department_id);
