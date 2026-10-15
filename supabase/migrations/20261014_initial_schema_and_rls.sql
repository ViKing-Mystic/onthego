-- ==============================================================================
-- OntheGO Production Database Schema & Row-Level Security (RLS) Policies
-- Designed for PostgreSQL 15+ / Supabase
-- Enforces multi-traveller isolation, zero-trust authorization, integer minor units (paise),
-- and strict private notes protection on the database layer.
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USER PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  phone text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 2. TRIPS
create table if not exists public.trips (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  owner_id uuid references auth.users(id) on delete restrict not null,
  is_private boolean default true not null,
  target_daily_budget_paise bigint default 320000 not null, -- ?3,200/day
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.trips enable row level security;

-- 3. TRIP MEMBERS (Two primary travellers per trip)
create table if not exists public.trip_members (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'revoked')),
  joined_at timestamptz default now() not null,
  unique (trip_id, user_id)
);

alter table public.trip_members enable row level security;

-- 4. TRIP INVITATIONS (Secure, revocable tokens)
create table if not exists public.trip_invitations (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  token text unique not null,
  invited_email text,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.trip_invitations enable row level security;

-- 5. ITINERARY DAYS & ACTIVITIES
create table if not exists public.itinerary_days (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  day_number integer not null check (day_number between 1 and 30),
  date date not null,
  title text not null,
  night_stay_name text,
  night_stay_phone text,
  is_locked boolean default false not null,
  created_at timestamptz default now() not null,
  unique (trip_id, day_number)
);

alter table public.itinerary_days enable row level security;

create table if not exists public.activities (
  id uuid default uuid_generate_v4() primary key,
  day_id uuid references public.itinerary_days(id) on delete cascade not null,
  trip_id uuid references public.trips(id) on delete cascade not null,
  title text not null,
  category text not null,
  scheduled_time text not null,
  duration_mins integer default 60 not null,
  location text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  status text default 'pending' check (status in ('pending', 'completed', 'skipped')),
  is_fixed_commitment boolean default false not null,
  is_user_provided boolean default false not null,
  cost_paise bigint default 0 not null,
  phone text,
  notes text,
  sort_order integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.activities enable row level security;

-- 6. EXPENSES & SPLITS (Integer minor units: paise)
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  description text not null,
  category text not null,
  amount_inr_paise bigint not null check (amount_inr_paise >= 0),
  currency text default 'INR' not null,
  fx_rate numeric(10, 4) default 1.0 not null,
  paid_by_user_id uuid references auth.users(id) on delete restrict not null,
  split_method text not null check (split_method in ('equal', 'percentage', 'custom', 'personal', 'repayment', 'refund')),
  is_prepaid boolean default false not null,
  expense_date date not null,
  receipt_note text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.expenses enable row level security;

create table if not exists public.expense_splits (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  share_amount_paise bigint not null check (share_amount_paise >= 0),
  percentage numeric(5, 2),
  unique (expense_id, user_id)
);

alter table public.expense_splits enable row level security;

-- 7. TRAVEL JOURNAL & MEMORIES (With strict private notes segregation)
create table if not exists public.memories (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete set null,
  day_number integer not null,
  destination text not null,
  title text not null,
  caption text,
  notes text,
  private_notes text, -- Strictly redacted from partner via RLS
  favourite_moment text,
  rating integer default 5 check (rating between 1 and 5),
  is_favourite boolean default false not null,
  is_must_revisit boolean default false not null,
  is_private boolean default false not null, -- If true, entire memory is hidden from partner
  author_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.memories enable row level security;

-- 8. CHECKLISTS & TASKS
create table if not exists public.checklists (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  title text not null,
  category text not null,
  is_completed boolean default false not null,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.checklists enable row level security;

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==============================================================================

-- Security definer check for trip membership and role
create or replace function public.is_trip_member(
  lookup_trip_id uuid,
  minimum_role text default 'viewer'
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = lookup_trip_id
      and user_id = auth.uid()
      and status = 'active'
      and (
        case minimum_role
          when 'viewer' then role in ('owner', 'editor', 'viewer')
          when 'editor' then role in ('owner', 'editor')
          when 'owner' then role = 'owner'
          else false
        end
      )
  );
$$;

-- Security definer check for trip ownership
create or replace function public.is_trip_owner(lookup_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips
    where id = lookup_trip_id
      and owner_id = auth.uid()
  );
$$;

-- ==============================================================================
-- RLS POLICIES FOR EACH TABLE
-- ==============================================================================

-- TRIPS POLICIES
create policy "Trip members can view their trips"
  on public.trips for select
  to authenticated
  using (public.is_trip_member(id, 'viewer'));

create policy "Users can create their own trips"
  on public.trips for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Trip owners can update trip details"
  on public.trips for update
  to authenticated
  using (public.is_trip_owner(id));

create policy "Trip owners can delete their trips"
  on public.trips for delete
  to authenticated
  using (public.is_trip_owner(id));

-- TRIP MEMBERS POLICIES
create policy "Members can view collaborators on their trips"
  on public.trip_members for select
  to authenticated
  using (public.is_trip_member(trip_id, 'viewer'));

create policy "Trip owners can manage collaborators"
  on public.trip_members for insert
  to authenticated
  with check (public.is_trip_owner(trip_id));

create policy "Trip owners can update member roles"
  on public.trip_members for update
  to authenticated
  using (public.is_trip_owner(trip_id));

create policy "Trip owners or members themselves can leave"
  on public.trip_members for delete
  to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- INVITATIONS POLICIES
create policy "Owners and editors can view trip invitations"
  on public.trip_invitations for select
  to authenticated
  using (public.is_trip_member(trip_id, 'editor'));

create policy "Owners and editors can generate invitations"
  on public.trip_invitations for insert
  to authenticated
  with check (public.is_trip_member(trip_id, 'editor') and auth.uid() = created_by);

-- ITINERARY DAYS POLICIES
create policy "Trip members can view itinerary days"
  on public.itinerary_days for select
  to authenticated
  using (public.is_trip_member(trip_id, 'viewer'));

create policy "Trip editors can modify itinerary days"
  on public.itinerary_days for all
  to authenticated
  using (public.is_trip_member(trip_id, 'editor'));

-- ACTIVITIES POLICIES
create policy "Trip members can view activities"
  on public.activities for select
  to authenticated
  using (public.is_trip_member(trip_id, 'viewer'));

create policy "Trip editors can insert activities"
  on public.activities for insert
  to authenticated
  with check (public.is_trip_member(trip_id, 'editor'));

create policy "Trip editors can update activities"
  on public.activities for update
  to authenticated
  using (public.is_trip_member(trip_id, 'editor'));

create policy "Trip editors can delete activities"
  on public.activities for delete
  to authenticated
  using (public.is_trip_member(trip_id, 'editor'));

-- EXPENSES POLICIES
create policy "Trip members can view expenses"
  on public.expenses for select
  to authenticated
  using (public.is_trip_member(trip_id, 'viewer'));

create policy "Trip members can log expenses"
  on public.expenses for insert
  to authenticated
  with check (public.is_trip_member(trip_id, 'editor') and auth.uid() = paid_by_user_id);

create policy "Payer or trip owner can update expenses"
  on public.expenses for update
  to authenticated
  using (auth.uid() = paid_by_user_id or public.is_trip_owner(trip_id));

create policy "Payer or trip owner can delete expenses"
  on public.expenses for delete
  to authenticated
  using (auth.uid() = paid_by_user_id or public.is_trip_owner(trip_id));

-- EXPENSE SPLITS POLICIES
create policy "Trip members can view expense splits"
  on public.expense_splits for select
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_trip_member(e.trip_id, 'viewer')
  ));

create policy "Trip editors can modify expense splits"
  on public.expense_splits for all
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_trip_member(e.trip_id, 'editor')
  ));

-- MEMORIES POLICIES (Strict Private Notes & Entry Isolation)
create policy "Members can view public trip memories"
  on public.memories for select
  to authenticated
  using (
    public.is_trip_member(trip_id, 'viewer')
    and (is_private = false or author_id = auth.uid())
  );

create policy "Travellers can insert their own memories"
  on public.memories for insert
  to authenticated
  with check (public.is_trip_member(trip_id, 'editor') and auth.uid() = author_id);

create policy "Authors can update their own memories"
  on public.memories for update
  to authenticated
  using (auth.uid() = author_id);

create policy "Authors or trip owners can delete memories"
  on public.memories for delete
  to authenticated
  using (auth.uid() = author_id or public.is_trip_owner(trip_id));

-- SANITIZED MEMORIES VIEW (Strips private notes for non-author travellers)
create or replace view public.sanitized_trip_memories as
select
  id,
  trip_id,
  activity_id,
  day_number,
  destination,
  title,
  caption,
  notes,
  case
    when author_id = auth.uid() then private_notes
    else null
  end as private_notes,
  favourite_moment,
  rating,
  is_favourite,
  is_must_revisit,
  is_private,
  author_id,
  created_at,
  updated_at
from public.memories
where (is_private = false or author_id = auth.uid());

-- CHECKLISTS POLICIES
create policy "Trip members can view checklist tasks"
  on public.checklists for select
  to authenticated
  using (public.is_trip_member(trip_id, 'viewer'));

create policy "Trip editors can modify checklists"
  on public.checklists for all
  to authenticated
  using (public.is_trip_member(trip_id, 'editor'));

-- ==============================================================================
-- INVITATION REDEMPTION STORED PROCEDURE
-- ==============================================================================

create or replace function public.redeem_trip_invitation(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  current_user_id uuid := auth.uid();
  already_member boolean;
begin
  if current_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required.');
  end if;

  select * into inv from public.trip_invitations
  where token = invite_token
    and (expires_at > now())
    and redeemed_at is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid, expired, or already redeemed invitation.');
  end if;

  -- Check if user is already a member
  select exists (
    select 1 from public.trip_members
    where trip_id = inv.trip_id and user_id = current_user_id
  ) into already_member;

  if already_member then
    return jsonb_build_object('success', true, 'message', 'You are already a member of this trip.', 'trip_id', inv.trip_id);
  end if;

  -- Enforce 2-traveller maximum per trip
  if (select count(*) from public.trip_members where trip_id = inv.trip_id and status = 'active') >= 2 then
    return jsonb_build_object('success', false, 'error', 'Trip membership limit (2 travellers) reached.');
  end if;

  -- Insert member
  insert into public.trip_members (trip_id, user_id, role, status)
  values (inv.trip_id, current_user_id, inv.role, 'active');

  -- Mark invitation redeemed
  update public.trip_invitations
  set redeemed_by = current_user_id, redeemed_at = now()
  where id = inv.id;

  return jsonb_build_object('success', true, 'message', 'Joined trip successfully!', 'trip_id', inv.trip_id);
end;
$$;
