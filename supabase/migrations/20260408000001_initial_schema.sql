-- =============================================================
-- SRC Inspection Proofer — Initial Schema
-- =============================================================

-- 1. Profiles (auto-created on auth.users insert)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'proofer' check (role in ('proofer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Allow insert for trigger"
  on public.profiles for insert to authenticated with check (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. Reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id),
  original_pdf_url text not null,
  original_storage_path text not null,
  service_type text not null check (service_type in (
    'annual_pm', 'due_diligence', 'survey', 'storm', 'construction_management'
  )),
  status text not null default 'uploaded' check (status in (
    'uploaded', 'extracting', 'extracted', 'proofing', 'proofed',
    'reviewing', 'approved', 'completed', 'failed'
  )),
  extracted_data jsonb,
  corrected_data jsonb,
  extraction_confidence numeric(3,2),
  corrected_pdf_url text,
  corrected_storage_path text,
  error_message text,
  flag_count integer not null default 0,
  resolved_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Authenticated users full access to reports"
  on public.reports for all to authenticated using (true) with check (true);


-- 3. Flags
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  field_address text not null,
  field_label text not null,
  flag_type text not null check (flag_type in (
    'pricing', 'missing_section', 'completeness', 'consistency',
    'prohibited_language', 'executive_summary'
  )),
  current_value text,
  suggested_value text,
  reason text not null,
  confidence numeric(3,2) not null,
  status text not null default 'open' check (status in (
    'open', 'accepted', 'edited', 'dismissed'
  )),
  resolution_value text,
  dismiss_reason text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.flags enable row level security;

create policy "Authenticated users full access to flags"
  on public.flags for all to authenticated using (true) with check (true);


-- 4. Reference Library
create table public.reference_library (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in (
    'cost_table', 'prohibited_phrase', 'approved_report', 'es_rules'
  )),
  service_type text,
  label text not null,
  content jsonb,
  file_storage_path text,
  uploaded_by uuid references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reference_library enable row level security;

create policy "Authenticated users full access to reference_library"
  on public.reference_library for all to authenticated using (true) with check (true);


-- 5. Audit Log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Authenticated users full access to audit_log"
  on public.audit_log for all to authenticated using (true) with check (true);


-- 6. Updated_at trigger for reports
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_updated_at
  before update on public.reports
  for each row execute function public.update_updated_at();


-- 7. Storage buckets
insert into storage.buckets (id, name, public) values ('report-uploads', 'report-uploads', false);
insert into storage.buckets (id, name, public) values ('corrected-reports', 'corrected-reports', false);
insert into storage.buckets (id, name, public) values ('reference-library', 'reference-library', false);

-- Storage policies — authenticated users can read/write all buckets
create policy "Auth users upload to report-uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-uploads');

create policy "Auth users read report-uploads"
  on storage.objects for select to authenticated
  using (bucket_id = 'report-uploads');

create policy "Auth users upload to corrected-reports"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'corrected-reports');

create policy "Auth users read corrected-reports"
  on storage.objects for select to authenticated
  using (bucket_id = 'corrected-reports');

create policy "Auth users upload to reference-library"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reference-library');

create policy "Auth users read reference-library"
  on storage.objects for select to authenticated
  using (bucket_id = 'reference-library');

-- Service role needs full access for edge functions
create policy "Service role full access"
  on storage.objects for all to service_role using (true) with check (true);
