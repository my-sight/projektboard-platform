create table if not exists tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text unique not null,
  display_name text not null,
  logo_url text,
  primary_color text default '#0ea5e9',
  created_at timestamptz default now()
);

insert into tenant_settings (tenant_slug, display_name, logo_url, primary_color)
values ('weber', 'Weber GmbH', null, '#2563eb')
on conflict (tenant_slug) do nothing;

insert into tenant_settings (tenant_slug, display_name, logo_url, primary_color)
values ('test', 'Testkunde', null, '#0ea5e9')
on conflict (tenant_slug) do nothing;
