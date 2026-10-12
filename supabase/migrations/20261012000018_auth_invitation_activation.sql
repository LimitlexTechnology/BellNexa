ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS invitations_school_created_at_idx
    ON public.invitations (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS invitations_auth_user_id_idx
    ON public.invitations (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

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

        IF TG_OP = 'INSERT' AND (NOT NEW.is_active OR NEW.must_change_password) THEN
            RAISE EXCEPTION 'Account activation state can only be changed by a trusted administrator';
        END IF;

        IF TG_OP = 'UPDATE' AND (
            NEW.is_active IS DISTINCT FROM OLD.is_active
            OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
        ) THEN
            RAISE EXCEPTION 'Account activation state can only be changed by a trusted administrator';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_super_admin_status ON public.profiles;
CREATE TRIGGER protect_profile_super_admin_status
    BEFORE INSERT OR UPDATE OF is_super_admin, is_active, must_change_password
    ON public.profiles
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
              AND is_active = TRUE
              AND must_change_password = FALSE
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = user_uuid
          AND is_active = TRUE
          AND must_change_password = FALSE
    ) THEN
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

DROP POLICY IF EXISTS "Invited users can read their own membership during password setup"
    ON public.school_memberships;
CREATE POLICY "Invited users can read their own membership during password setup"
    ON public.school_memberships
    FOR SELECT
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
              AND is_active = TRUE
              AND must_change_password = TRUE
        )
    );

DROP POLICY IF EXISTS "Invitations viewable by school admin or super admin"
    ON public.invitations;
CREATE POLICY "Invitations viewable by Super Admin"
    ON public.invitations
    FOR SELECT
    USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Invitations manageable by school admin or super admin"
    ON public.invitations;
CREATE POLICY "Invitations manageable by Super Admin"
    ON public.invitations
    FOR ALL
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_invitation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    audit_action TEXT;
    audit_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        audit_action := 'INVITATION_CREATED';
        audit_user_id := NEW.created_by;
    ELSIF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND NEW.revoked_at IS NOT NULL THEN
        audit_action := 'INVITATION_REVOKED';
        audit_user_id := NEW.created_by;
    ELSIF NEW.is_used IS DISTINCT FROM OLD.is_used AND NEW.is_used THEN
        audit_action := 'INVITATION_ACTIVATED';
        audit_user_id := NEW.auth_user_id;
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.audit_logs (school_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (
        NEW.school_id,
        audit_user_id,
        audit_action,
        'invitation',
        NEW.id::TEXT,
        jsonb_build_object('email', NEW.email, 'role', NEW.role)
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_invitation_changes() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_invitation_changes ON public.invitations;
CREATE TRIGGER audit_invitation_changes
    AFTER INSERT OR UPDATE OF revoked_at, is_used
    ON public.invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_invitation_changes();

CREATE OR REPLACE FUNCTION public.complete_invitation_password_setup()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    account_is_active BOOLEAN;
    password_setup_required BOOLEAN;
    invitation_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'A signed-in account is required';
    END IF;

    SELECT is_active, must_change_password
      INTO account_is_active, password_setup_required
      FROM public.profiles
     WHERE id = current_user_id
     FOR UPDATE;

    IF NOT FOUND OR NOT account_is_active THEN
        RAISE EXCEPTION 'This account is disabled or unavailable';
    END IF;
    IF NOT password_setup_required THEN
        RETURN TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM auth.users
         WHERE id = current_user_id
           AND email_confirmed_at IS NOT NULL
            AND encrypted_password IS NOT NULL
            AND encrypted_password <> ''
    ) THEN
        RAISE EXCEPTION 'Email confirmation is required before account setup';
    END IF;

    UPDATE public.invitations
       SET is_used = TRUE,
           updated_at = NOW()
     WHERE auth_user_id = current_user_id
       AND is_used = FALSE
       AND revoked_at IS NULL
       AND expires_at > NOW()
    RETURNING id INTO invitation_id;

    IF invitation_id IS NULL THEN
        RAISE EXCEPTION 'This invitation has expired or was revoked';
    END IF;

    UPDATE public.profiles
       SET must_change_password = FALSE,
           updated_at = NOW()
     WHERE id = current_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_invitation_password_setup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_invitation_password_setup() TO authenticated;