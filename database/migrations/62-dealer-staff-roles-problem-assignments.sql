alter table public.dealer_app_staff
  add column if not exists staff_role text not null default 'owner';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dealer_app_staff_role_check'
  ) then
    alter table public.dealer_app_staff
      add constraint dealer_app_staff_role_check
      check (staff_role in ('owner', 'sales', 'parts', 'technician'));
  end if;
end $$;

create table if not exists public.dealer_problem_assignments (
  id uuid primary key default gen_random_uuid(),
  dealer_user_id text not null,
  issue_note_status_id text not null,
  asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
  assigned_staff_id uuid references public.dealer_app_staff(id) on delete set null,
  assigned_by_staff_id uuid references public.dealer_app_staff(id) on delete set null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  workflow_status text not null default 'new'
    check (workflow_status in ('new', 'assigned', 'in_progress', 'waiting', 'resolved')),
  due_date date,
  assigned_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealer_user_id, issue_note_status_id)
);

create index if not exists dealer_problem_assignments_dealer_status_idx
  on public.dealer_problem_assignments (dealer_user_id, workflow_status, updated_at desc);

create index if not exists dealer_problem_assignments_staff_idx
  on public.dealer_problem_assignments (assigned_staff_id, workflow_status, updated_at desc);
