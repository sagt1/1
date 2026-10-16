// Admin-only employee lifecycle function for SAGT - Verify.
// SUPABASE_SERVICE_ROLE_KEY must exist only in Edge Function secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersForOrigin } from '../_shared/cors.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeadersForOrigin(origin);
  const allowed = Boolean(cors['Access-Control-Allow-Origin']);
  if (origin && !allowed) return json({ error: 'Origin is not allowed' }, 403, cors);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ error: 'Content-Type must be application/json' }, 415, cors);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server function is not configured' }, 500, cors);
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401, cors);
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Invalid session' }, 401, cors);
  const { data: callerProfile, error: profileError } = await adminClient.from('profiles')
    .select('role,is_active').eq('id', authData.user.id).maybeSingle();
  if (profileError || callerProfile?.role !== 'admin' || callerProfile?.is_active !== true) {
    return json({ error: 'Administrator permission required' }, 403, cors);
  }
  let body: { action?: string; email?: string; full_name?: string; user_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, cors); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request body' }, 400, cors);
  if (body.action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const full_name = String(body.full_name || '').trim().replace(/\s+/g, ' ');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !full_name || full_name.length > 120) {
      return json({ error: 'Provide a valid email and employee name (max 120 characters)' }, 400, cors);
    }
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name } });
    if (error) return json({ error: 'Invitation could not be created. Check whether the address already has an account and review Auth logs.' }, 400, cors);
    if (!data.user) return json({ error: 'Invitation request returned no user. Check Auth logs.' }, 502, cors);
    // The auth.users trigger creates a least-privilege profile. Upsert only profile fields,
    // never promote roles or grant document permissions during invitation.
    const { error: profileUpsertError } = await adminClient.from('profiles').upsert({
      id: data.user.id, email, full_name, role: 'employee', nav_dashboard: true, is_active: true,
      can_view_invoices: false, can_edit_invoices: false, can_view_surveys: false, can_edit_surveys: false,
    }, { onConflict: 'id' });
    if (profileUpsertError) return json({ error: 'Invitation was created but profile setup failed. Repair the profile before allowing access.' }, 500, cors);
    const { error: auditError } = await adminClient.from('employee_admin_audit').insert({ actor_id: authData.user.id, target_user_id: data.user.id, action: 'invite', target_email: email });
    if (auditError) return json({ error: 'Invitation was created, but audit logging failed. Check database configuration.' }, 500, cors);
    return json({ ok: true, message: 'Invitation created. Assign module permissions after the employee accepts.' }, 200, cors);
  }
  if (!['deactivate', 'reactivate'].includes(String(body.action))) return json({ error: 'Unsupported action' }, 400, cors);
  const userId = String(body.user_id || '');
  if (!uuidPattern.test(userId) || userId === authData.user.id) return json({ error: 'A valid different employee account is required' }, 400, cors);
  const { data: target, error: targetError } = await adminClient.from('profiles')
    .select('id,role,email,is_active').eq('id', userId).maybeSingle();
  if (targetError || !target) return json({ error: 'Employee profile not found' }, 404, cors);
  if (target.role === 'admin') return json({ error: 'Administrator accounts cannot be managed from this employee screen' }, 400, cors);
  if (body.action === 'deactivate') {
    const { error: profileUpdateError } = await adminClient.from('profiles').update({ is_active: false }).eq('id', userId);
    if (profileUpdateError) return json({ error: 'Could not deactivate profile. Check database policies and logs.' }, 500, cors);
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    if (banError) return json({ error: 'Profile is disabled, but Auth ban failed. Keep the profile inactive and review Auth logs.' }, 500, cors);
  } else {
    // Unban first; profile remains inactive until the Auth update succeeds.
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    if (unbanError) return json({ error: 'Could not reactivate Auth account. Review Auth logs.' }, 400, cors);
    const { error: profileUpdateError } = await adminClient.from('profiles').update({ is_active: true }).eq('id', userId);
    if (profileUpdateError) {
      await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      return json({ error: 'Auth was temporarily unbanned but profile activation failed; Auth access was re-banned. Review database logs.' }, 500, cors);
    }
  }
  const action = body.action as 'deactivate' | 'reactivate';
  const { error: auditError } = await adminClient.from('employee_admin_audit').insert({ actor_id: authData.user.id, target_user_id: userId, action, target_email: target.email });
  if (auditError) return json({ error: 'Employee state changed, but audit logging failed. Review audit table configuration.' }, 500, cors);
  return json({ ok: true, message: action === 'deactivate' ? 'Employee deactivated' : 'Employee reactivated' }, 200, cors);
});
