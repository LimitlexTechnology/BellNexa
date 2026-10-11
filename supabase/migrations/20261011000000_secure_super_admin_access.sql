-- Protect Super Admin assignment and require MFA for elevated database access.

ALTER TABLE public.school_memberships
    DROP CONSTRAINT IF EXISTS school_memberships_role_check;
ALTER TABLE public.school_memberships
    ADD CONSTRAINT school_memberships_role_check
    CHECK (role IN ('admin', 'support', 'auditor', 'principal', 'regulator'));

ALTER TABLE public.invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE public.invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'support', 'auditor', 'principal', 'regulator'));

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        LOWER(NEW.email),
        COALESCE(
            NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
            SPLIT_PART(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_bellnexa_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.email IS NOT NULL)
    EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.profiles (id, email, full_name)
SELECT
    id,
    LOWER(email),
    COALESCE(
        NULLIF(BTRIM(raw_user_meta_data ->> 'full_name'), ''),
        SPLIT_PART(email, '@', 1)
    )
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prevent_client_super_admin_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF CURRENT_USER NOT IN ('postgres', 'service_role') THEN
        IF TG_OP = 'INSERT' AND NEW.is_super_admin THEN
            RAISE EXCEPTION 'Super Admin status can only be assigned by a trusted administrator';
        END IF;

        IF TG_OP = 'UPDATE' AND NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
            RAISE EXCEPTION 'Super Admin status can only be changed by a trusted administrator';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_client_super_admin_assignment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_profile_super_admin_status
    BEFORE INSERT OR UPDATE OF is_super_admin ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_client_super_admin_assignment();

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        auth.uid() = user_uuid
        AND auth.jwt() ->> 'aal' = 'aal2'
        AND EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = user_uuid
              AND is_super_admin = TRUE
        ),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.has_school_access(user_uuid UUID, check_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS DISTINCT FROM user_uuid THEN
        RETURN FALSE;
    END IF;

    IF public.is_super_admin(user_uuid) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.school_memberships
        WHERE user_id = user_uuid
          AND school_id = check_school_id
          AND is_approved = TRUE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_school_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_school_access(UUID, UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Profiles editable by self or super admin" ON public.profiles;
CREATE POLICY "Profiles editable by self or super admin" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id OR public.is_super_admin(auth.uid()))
    WITH CHECK (auth.uid() = id OR public.is_super_admin(auth.uid()));
