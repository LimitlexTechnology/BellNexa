# Super Admin access

BellNexa authenticates users with Supabase Auth. A user's email address alone never grants a role: platform-wide access is determined by `public.profiles.is_super_admin`, and the Super Admin session must also have Supabase assurance level `aal2` (a verified authenticator).

## Apply the security migration

Apply `supabase/migrations/20261011000000_secure_super_admin_access.sql` to the configured Supabase project before enabling real sign-in. It creates ordinary profiles with Super Admin status off, protects that status from authenticated clients, and restricts Super Admin RLS access to MFA-verified sessions.

## Check whether the designated account exists

An administrator with project-owner access can inspect Authentication > Users in the Supabase Dashboard, or run this read-only query in that project's SQL Editor:

```sql
SELECT
    u.id,
    u.email,
    (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
    COALESCE(p.is_super_admin, FALSE) AS is_super_admin
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE LOWER(u.email) = LOWER('kobbygazi@gmail.com');
```

No account-existence or role claim should be inferred from frontend code or from entering that email in the sign-in form. The browser anon key cannot list `auth.users`, and BellNexa has no trusted Admin API connection for checking the hosted project from the client.

The migration intentionally preserves pre-existing `is_super_admin` values so it cannot silently lock out an existing legitimate administrator. Before relying on the designated account as the only Super Admin, audit every currently flagged account in the SQL Editor:

```sql
SELECT u.id, u.email, u.email_confirmed_at, p.is_super_admin
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id
WHERE p.is_super_admin = TRUE
ORDER BY u.email;
```

Review any unexpected entries with the project owner and explicitly revoke only roles confirmed to be unauthorised. Do not treat an existing flag as proof that its assignment was originally safe.

## Provision the Super Admin

1. Check for the account using the query above. Do not create a duplicate if it already exists.
2. If it does not exist, create/invite it from Supabase Dashboard > Authentication > Users. Confirm the designated owner controls the mailbox and completes Supabase's email verification. Do not use a frontend registration form to assign the role.
3. Confirm the exact, verified Auth user in the dashboard and run this explicit role assignment in that project's SQL Editor:

```sql
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id
    INTO target_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER('kobbygazi@gmail.com')
      AND email_confirmed_at IS NOT NULL;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'No email-confirmed Auth user exists for the designated Super Admin address';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, is_super_admin)
    SELECT
        id,
        LOWER(email),
        COALESCE(
            NULLIF(BTRIM(raw_user_meta_data ->> 'full_name'), ''),
            SPLIT_PART(email, '@', 1)
        ),
        FALSE
    FROM auth.users
    WHERE id = target_user_id
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.profiles
    SET is_super_admin = TRUE,
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The Auth user has no BellNexa profile; verify the profile trigger and migration';
    END IF;
END;
$$;
```

4. Sign in through BellNexa and enroll a TOTP authenticator when prompted. The login page verifies the code with Supabase MFA; it does not accept a code based on its length alone.
5. Re-run the read-only query to verify the account's role. Keep the authenticator device and its secure backups protected.

The assignment SQL must be run deliberately by a trusted project administrator after verifying the account; it is not part of signup, invitation acceptance, or the migration.

## Account recovery

- Use Supabase's email password-recovery link from the BellNexa sign-in page. The Supabase project's Auth URL Configuration must allow the deployed BellNexa origin as a redirect URL. The link opens BellNexa's password update screen and the user must sign in again after changing the password.
- If the authenticator is lost, first verify the account owner's identity through an independent channel. A project owner should use Supabase's supported account/MFA recovery workflow, remove only the lost factor, then require authenticator re-enrollment before restoring Super Admin work. Do not change `is_super_admin` to recover an account, disable the RLS MFA check, or use a shared browser session as a bypass.
- Never place a Supabase service-role/secret key in Vite variables or browser code. Administrative Auth operations belong in the Supabase Dashboard or a separately secured server-side service.

The repository does not contain a server-side Super Admin recovery endpoint. Recovery after loss of every verified factor must therefore be performed by the Supabase project owner using Supabase's supported recovery tooling.
