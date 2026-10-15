-- ==============================================================================
-- OntheGO Initial Master Trip Seed
-- Seeds the 16–20 October 2026 Kochi–Alleppey Coastal Scooter Expedition
-- Requires an existing authenticated user ID for owner_id
-- ==============================================================================

do $$
declare
  trip_uuid uuid := 'a0000000-0000-0000-0000-000000000001';
  day1_uuid uuid := 'b0000000-0000-0000-0000-000000000001';
  day2_uuid uuid := 'b0000000-0000-0000-0000-000000000002';
  day3_uuid uuid := 'b0000000-0000-0000-0000-000000000003';
  day4_uuid uuid := 'b0000000-0000-0000-0000-000000000004';
  day5_uuid uuid := 'b0000000-0000-0000-0000-000000000005';
  default_owner_id uuid;
begin
  -- Resolve owner or fallback to first auth user
  select id into default_owner_id from auth.users limit 1;
  if default_owner_id is null then
    default_owner_id := 'c0000000-0000-0000-0000-000000000001';
  end if;

  -- 1. Create Trip Record
  insert into public.trips (id, name, description, start_date, end_date, owner_id, is_private, target_daily_budget_paise)
  values (
    trip_uuid,
    'Kochi–Alleppey Coastal Scooter Escape',
    '5-Day Kerala Road Expedition for Two Travellers • 165 km Coastal Ride',
    '2026-10-16',
    '2026-10-20',
    default_owner_id,
    true,
    320000
  ) on conflict (id) do nothing;

  -- 2. Create Itinerary Days
  insert into public.itinerary_days (id, trip_id, day_number, date, title, night_stay_name, night_stay_phone)
  values
    (day1_uuid, trip_uuid, 1, '2026-10-16', 'Ernakulam Arrival ➔ Fort Kochi Heritage & Sunset', 'Calvin''s Inn', '+91 99951 65493'),
    (day2_uuid, trip_uuid, 2, '2026-10-17', 'Fort Kochi Heritage Walk ➔ Coastal Highway ➔ Alleppey', 'Ocean Aura Beach Stay', '+91 79944 55407'),
    (day3_uuid, trip_uuid, 3, '2026-10-18', 'Morning Backwater Kayaking & Coastal Marari Sunset', 'Ocean Aura Beach Stay', '+91 79944 55407'),
    (day4_uuid, trip_uuid, 4, '2026-10-19', 'Alleppey Canals ➔ Country Roads ➔ Kumbalangi Sunset', 'Zostel Kumbalangi', '+91 98470 12345'),
    (day5_uuid, trip_uuid, 5, '2026-10-20', 'Fort Kochi Morning ➔ Scooter Handover ➔ Vande Bharat Departure', 'Return Journey (Train)', '139 (IRCTC)')
  on conflict (id) do nothing;

  -- 3. Create Critical Fixed Commitments
  insert into public.activities (day_id, trip_id, title, category, scheduled_time, duration_mins, location, is_fixed_commitment, is_user_provided, cost_paise, sort_order)
  values
    (day1_uuid, trip_uuid, 'Arrive at Ernakulam Junction (Booked Vande Bharat)', 'Transport', '02:00 PM', 30, 'Ernakulam Junction Railway Station (ERS)', true, true, 341600, 1),
    (day1_uuid, trip_uuid, 'Collect Scooter Rental (Access 125)', 'Transport', '02:30 PM', 30, 'Near Ernakulam Junction Railway Station', true, true, 280000, 2),
    (day1_uuid, trip_uuid, 'Check in at Calvin''s Inn', 'Accommodation', '03:15 PM', 30, 'Fort Kochi, Kerala 682001', true, true, 0, 3),
    (day5_uuid, trip_uuid, 'Return Scooter Rental (Vendor Handover)', 'Transport', '01:00 PM', 30, 'Near Ernakulam Junction Station', true, true, 230000, 5),
    (day5_uuid, trip_uuid, 'Board Return Vande Bharat Express (Train Departs 2:00 PM Sharp)', 'Transport', '01:30 PM', 30, 'Ernakulam Junction Railway Station (Platform 1)', true, true, 0, 6)
  on conflict (id) do nothing;

  -- 4. Initial Expense: Scooter Advance Deposit
  insert into public.expenses (trip_id, description, category, amount_inr_paise, paid_by_user_id, split_method, is_prepaid, expense_date, notes)
  values (
    trip_uuid,
    'Scooter Rental Advance (Contact: 9003955156)',
    'Scooter Rental',
    50000, -- ?500.00
    default_owner_id,
    'equal',
    true,
    '2026-10-16',
    'Prepaid deposit. Balance of ?2,300 due upon return.'
  ) on conflict do nothing;

end $$;
