-- Run only after the shared admin account has been created/verified in Supabase Auth.
update public.profiles p
set role='admin',
    full_name='Rajesh Balaka / Pyla Nani',
    can_view_invoices=true,
    can_edit_invoices=true,
    can_view_surveys=true,
    can_edit_surveys=true
from auth.users u
where p.id=u.id
  and lower(u.email)=lower('shreeaditya2025@gmail.com');
