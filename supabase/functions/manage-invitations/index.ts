import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Caller = { id: string; email?: string; emailConfirmed: boolean };
type InviteRequest = {
  action: 'invite';
  email: string;
  fullName: string;
  role: 'principal' | 'regulator';
  schoolId: string;
};
type RevokeRequest = { action: 'revoke'; invitationId: string };

const configuredOrigins = (Deno.env.get('ALLOWED_APP_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  configuredOrigins.length ? configuredOrigins : ['http://localhost:3000', 'http://localhost:5173'],
);

const jsonResponse = (body: Record<string, unknown>, status = 200, origin?: string): Response =>
  Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    },
  });

const getKey = (variable: string, mapVariable: string): string | undefined => {
  const direct = Deno.env.get(variable);
  if (direct) return direct;
  const keyMap = Deno.env.get(mapVariable);
  if (!keyMap) return undefined;
  try {
    const parsed: unknown = JSON.parse(keyMap);
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed).find((value): value is string => typeof value === 'string');
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const makeClients = (url: string, publishableKey: string, serviceKey: string, accessToken: string) => ({
  userClient: createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }),
  adminClient: createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }),
});

const authenticateUser = async (
  userClient: SupabaseClient,
  accessToken: string,
): Promise<Caller | Response> => {
  const { data, error } = await userClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return jsonResponse({ error: 'Your sign-in session is invalid. Please sign in again.' }, 401);
  }
  return {
    id: data.user.id,
    email: data.user.email,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
};

const authorizeSuperAdmin = async (
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  accessToken: string,
  caller: Caller,
): Promise<Response | null> => {
  if (!caller.emailConfirmed) {
    return jsonResponse({ error: 'Confirm your Super Admin email before managing invitations.' }, 403);
  }
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(accessToken);
  if (claimsError || claimsData?.claims?.aal !== 'aal2') {
    return jsonResponse({ error: 'Verified Super Admin authenticator verification is required.' }, 403);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_super_admin, is_active, must_change_password')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileError) return jsonResponse({ error: 'Unable to verify Super Admin permissions.' }, 500);
  if (!profile?.is_super_admin || !profile.is_active || profile.must_change_password) {
    return jsonResponse({ error: 'This action requires an active Super Admin account.' }, 403);
  }
  return null;
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const removePartialInvite = async (adminClient: SupabaseClient, userId: string): Promise<boolean> => {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) console.error('Failed to remove an incomplete invited account');
  return !error;
};

const handleInvite = async (
  body: InviteRequest,
  caller: Caller,
  adminClient: SupabaseClient,
  origin: string,
): Promise<Response> => {
  if (!origin) return jsonResponse({ error: 'The application origin is required to create an invitation.' }, 400);
  const email = body.email.trim().toLowerCase();
  const fullName = body.fullName.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Enter a valid recipient email address.' }, 400, origin);
  }
  if (!fullName || fullName.length > 120) {
    return jsonResponse({ error: 'Enter the recipient’s name (up to 120 characters).' }, 400, origin);
  }
  if (!caller.email) return jsonResponse({ error: 'The signed-in account has no verified email address.' }, 403, origin);

  const { data: school, error: schoolError } = await adminClient
    .from('schools')
    .select('id, name, is_active')
    .eq('id', body.schoolId)
    .maybeSingle();
  if (schoolError) return jsonResponse({ error: 'Unable to verify the selected school.' }, 500, origin);
  if (!school || !school.is_active) {
    return jsonResponse({ error: 'Choose an active school registered in BellNexa.' }, 404, origin);
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingProfileError) return jsonResponse({ error: 'Unable to check the recipient account.' }, 500, origin);
  if (existingProfile) {
    return jsonResponse({ error: 'This email already has a BellNexa account. Manage its school membership instead of sending a new invitation.' }, 409, origin);
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/`,
    data: { full_name: fullName, school_name: school.name, role: body.role },
  });
  if (inviteError || !inviteData.user) {
    return jsonResponse({ error: inviteError?.message ?? 'Unable to create the account invitation.' }, 400, origin);
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: true, must_change_password: true, full_name: fullName })
    .eq('id', inviteData.user.id);
  if (profileError) {
    const removed = await removePartialInvite(adminClient, inviteData.user.id);
    return jsonResponse({
      error: removed
        ? 'The invitation could not be prepared. No active invitation was created.'
        : 'Invitation setup failed and an incomplete account could not be removed. Contact the platform administrator.',
    }, 500, origin);
  }

  const { error: membershipError } = await adminClient
    .from('school_memberships')
    .insert({
      school_id: school.id,
      user_id: inviteData.user.id,
      role: body.role,
      is_approved: true,
    });
  if (membershipError) {
    const removed = await removePartialInvite(adminClient, inviteData.user.id);
    return jsonResponse({
      error: removed
        ? 'The invitation could not be assigned to this school. No active invitation was created.'
        : 'Invitation setup failed and an incomplete account could not be removed. Contact the platform administrator.',
    }, 500, origin);
  }

  const { data: invitation, error: invitationError } = await adminClient
    .from('invitations')
    .insert({
      school_id: school.id,
      email,
      role: body.role,
      token_hash: await sha256(crypto.randomUUID()),
      expires_at: expiresAt,
      created_by: caller.id,
      auth_user_id: inviteData.user.id,
    })
    .select('id, school_id, email, role, expires_at, is_used, revoked_at, created_at')
    .single();
  if (invitationError) {
    const now = new Date().toISOString();
    const { error: revokeError } = await adminClient
      .from('invitations')
      .update({ revoked_at: now, updated_at: now })
      .eq('auth_user_id', inviteData.user.id)
      .is('revoked_at', null);
    const removed = await removePartialInvite(adminClient, inviteData.user.id);
    return jsonResponse({
      error: removed && !revokeError
        ? 'The invitation could not be recorded. No active invitation was created.'
        : 'Invitation setup failed and an incomplete account could not be removed. Contact the platform administrator.',
    }, 500, origin);
  }
  return jsonResponse({ invitation }, 201, origin);
};

const handleRevoke = async (
  invitationId: string,
  adminClient: SupabaseClient,
  origin: string,
): Promise<Response> => {
  const { data: invitation, error: lookupError } = await adminClient
    .from('invitations')
    .select('id, auth_user_id, is_used, revoked_at')
    .eq('id', invitationId)
    .maybeSingle();
  if (lookupError) return jsonResponse({ error: 'Unable to load this invitation.' }, 500, origin);
  if (!invitation) return jsonResponse({ error: 'Invitation not found.' }, 404, origin);
  if (invitation.is_used) return jsonResponse({ error: 'This invitation has already been activated and cannot be revoked as an invitation.' }, 409, origin);
  if (invitation.revoked_at) return jsonResponse({ error: 'This invitation was already revoked.' }, 409, origin);

  const now = new Date().toISOString();
  const { error: revokeError } = await adminClient
    .from('invitations')
    .update({ revoked_at: now, updated_at: now })
    .eq('id', invitation.id);
  if (revokeError) return jsonResponse({ error: 'Unable to revoke this invitation.' }, 500, origin);

  if (invitation.auth_user_id) {
    const { error: disableError } = await adminClient
      .from('profiles')
      .update({ is_active: false })
      .eq('id', invitation.auth_user_id);
    if (disableError) {
      const { error: restoreError } = await adminClient.from('invitations')
        .update({ revoked_at: null, updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
      if (restoreError) console.error('Invitation revoke rollback was incomplete');
      return jsonResponse({
        error: restoreError
          ? 'Revocation failed and invitation state may need administrator review.'
          : 'Unable to disable the pending invited account.',
      }, 500, origin);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(invitation.auth_user_id);
    if (deleteError) {
      const [{ error: profileRestoreError }, { error: invitationRestoreError }] = await Promise.all([
        adminClient.from('profiles').update({ is_active: true }).eq('id', invitation.auth_user_id),
        adminClient.from('invitations').update({ revoked_at: null, updated_at: new Date().toISOString() }).eq('id', invitation.id),
      ]);
      if (profileRestoreError || invitationRestoreError) console.error('Invitation revoke rollback was incomplete');
      return jsonResponse({
        error: profileRestoreError || invitationRestoreError
          ? 'Revocation failed and account or invitation state may need administrator review.'
          : 'The pending account could not be revoked. Please try again.',
      }, 500, origin);
    }
  }
  return jsonResponse({ success: true }, 200, origin);
};

const handleCompleteSetup = async (
  userClient: SupabaseClient,
  origin: string,
): Promise<Response> => {
  const { error } = await userClient.rpc('complete_invitation_password_setup');
  if (error) {
    const expired = error.message.toLowerCase().includes('expired or was revoked');
    return jsonResponse({
      error: expired
        ? 'This invitation has expired or was revoked. Ask an administrator to send a new invitation.'
        : error.message,
    }, expired ? 403 : 400, origin);
  }
  return jsonResponse({ success: true }, 200, origin);
};

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin') ?? '';
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: 'This application origin is not allowed.' }, 403);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      },
    });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = getKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
  const serviceKey = getKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !publishableKey || !serviceKey) {
    console.error('Invitation function is missing Supabase server configuration');
    return jsonResponse({ error: 'Invitation service is not configured. Contact the platform administrator.' }, 503, origin);
  }
  if (!accessToken) return jsonResponse({ error: 'Sign in again to continue.' }, 401, origin);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, origin);
  }
  if (!isRecord(payload)) return jsonResponse({ error: 'Invalid request.' }, 400, origin);

  const { userClient, adminClient } = makeClients(url, publishableKey, serviceKey, accessToken);
  const caller = await authenticateUser(userClient, accessToken);
  if (caller instanceof Response) return jsonResponse(await caller.json() as Record<string, unknown>, caller.status, origin);

  if (payload.action === 'complete-setup') {
    return handleCompleteSetup(userClient, origin);
  }

  const authorizationError = await authorizeSuperAdmin(userClient, adminClient, accessToken, caller);
  if (authorizationError) {
    return jsonResponse(await authorizationError.json() as Record<string, unknown>, authorizationError.status, origin);
  }

  if (payload.action === 'revoke' && isUuid(payload.invitationId)) {
    return handleRevoke(payload.invitationId, adminClient, origin);
  }
  if (
    payload.action === 'invite'
    && typeof payload.email === 'string'
    && typeof payload.fullName === 'string'
    && (payload.role === 'principal' || payload.role === 'regulator')
    && isUuid(payload.schoolId)
  ) {
    return handleInvite(payload as InviteRequest, caller, adminClient, origin);
  }
  return jsonResponse({ error: 'Invalid invitation operation.' }, 400, origin);
});
