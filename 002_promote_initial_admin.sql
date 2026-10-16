-- Run this in the Supabase SQL Editor for SAGT - Verify only, after 001_sagt_verify_schema.sql.
-- It promotes only the exact verified Auth account email; no credentials are included.
insert into public.profiles (
  id, email, full_name, role,
  can_view_invoices, can_edit_invoices,
  can_view_surveys, can_edit_surveys
)
select
  u.id,
  lower(u.email),
  'Shree Aditya Geo Tech Administrator',
  'admin', true, true, true, true
from auth.users u
where lower(u.email) = lower('shreeaditya2025@gmail.com')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'admin',
  can_view_invoices = true,
  can_edit_invoices = true,
  can_view_surveys = true,
  can_edit_surveys = true;

-- Verify that exactly one account is now admin.
select p.email, p.role, p.can_view_invoices, p.can_edit_invoices,
       p.can_view_surveys, p.can_edit_surveys
from public.profiles p
where lower(p.email) = lower('shreeaditya2025@gmail.com');
