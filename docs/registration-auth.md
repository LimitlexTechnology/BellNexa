# Registration and Invitation Setup

## Implemented application flow

- BellNexa does not offer public self-registration.
- An active Super Admin with a verified TOTP session (`aal2`) can invite a principal or regulator for a school record already stored in Supabase.
- Supabase Auth sends its one-time invitation email. The user confirms the email, chooses a password, then signs in normally.
- School membership and role are created by the trusted invitation function, not by email verification or user-editable metadata.
- Invitation records have a one-hour expiry, a revocation status, and no displayed raw token. Revoking a pending invitation disables and removes its unactivated Auth account while preserving the invitation record.
- Disabled users, users still completing password setup, and users without an approved school role cannot enter the dashboard.
- Password recovery uses Supabase Auth's email recovery flow.

## Apply the backend changes

The repository changes do not automatically update a deployed Supabase project. A project owner must review and deploy them:

1. Link the CLI to the intended project with `npx supabase link --project-ref YOUR_PROJECT_REF`.
2. Review `npx supabase migration list --linked` and `npx supabase db push --dry-run --linked`; `db push` applies every pending repository migration, not only the invitation migration.
3. After reviewing the dry run, apply the pending migrations with `npx supabase db push --linked`.
4. Set `ALLOWED_APP_ORIGINS` to a comma-separated list of exact allowed origins, then deploy the `manage-invitations` Edge Function. For example, after replacing the placeholders, use `npx supabase secrets set ALLOWED_APP_ORIGINS="http://localhost:3000,https://YOUR_CONFIRMED_DOMAIN" --project-ref YOUR_PROJECT_REF` and `npx supabase functions deploy manage-invitations --project-ref YOUR_PROJECT_REF`. Include the local Vite origin used for development and the confirmed production origin; do not add wildcard origins.
5. Confirm the Edge Function has the Supabase URL, publishable/anon key, and server-side secret key supplied by the Supabase runtime. Never add the server-side secret to Vite variables or browser code.
6. Confirm at least one real, active school record exists. The current Super Admin page reads schools from Supabase; creating/editing schools is a later implementation phase.

The repository currently has no Supabase project credentials/configuration, so the migration and function have not been applied to the hosted project.

This change covers the Phase 3 invitation and account-activation path only. International school/campus fields and campus-scoped permissions (Phase 4), plus persistent school/user management and Super Admin profile-photo storage (Phase 5), are not implemented here.

## Supabase Auth dashboard configuration

- Set the development Site URL to the local Vite origin, commonly `http://localhost:3000` in this workspace.
- Add exact local redirect URLs used by the team (for example `http://localhost:3000/**` and, if used, `http://localhost:5173/**`).
- Add the real production callback URL only after confirming the deployed hostname. The repository names the Cloudflare Pages project `bellnexa`, but the final custom domain is not known.
- Ensure the Auth email OTP expiry is **3600 seconds (one hour)** so it matches the invitation record expiry. If this setting changes, update the server-side invitation expiry as well.
- Keep email confirmation enabled and do not enable public signups unless a separately authorized registration flow is implemented.
- Review the password policy and Auth rate limits before production.

## Email delivery limitations

The selected setup is Supabase's default SMTP for development only. Supabase documents this as restricted testing delivery (approximately two emails per hour, with recipients generally limited to verified project/team addresses); it is not a production email service. On some newer free projects, default Auth email templates cannot be customized. The default email therefore cannot be treated as a branded production message. Do not rely on it for real school onboarding.

For production, configure a verified sending domain and custom SMTP provider, then customize the Supabase Auth invitation and recovery templates to include BellNexa branding, `{{ .Email }}`, `{{ .Data.school_name }}`, and `{{ .Data.role }}`. Add a real support contact and test the links, expiry, and recovery flow before inviting users. Provider availability and free-tier limits change, so compare current plans before selecting one.
