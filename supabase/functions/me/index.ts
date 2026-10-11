import { withSupabase } from 'npm:@supabase/server@1';

export default {
  fetch: withSupabase({ auth: 'user' }, async (_request, { supabase, userClaims }) => {
    if (!userClaims) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, is_super_admin')
      .eq('id', userClaims.id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: 'Unable to load profile' }, { status: 500 });
    }

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    return Response.json({ profile });
  }),
};
