CREATE TABLE IF NOT EXISTS public.app_admin_credentials (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  password_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admin_credentials FROM anon, authenticated;
GRANT ALL ON public.app_admin_credentials TO service_role;