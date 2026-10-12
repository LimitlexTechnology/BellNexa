CREATE OR REPLACE FUNCTION public.is_valid_iana_timezone(timezone_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
STRICT
SET search_path = pg_catalog
AS $$
SELECT (
    timezone_name = 'UTC'
    OR (
        timezone_name ~ '^[A-Za-z][A-Za-z0-9._+-]*/[A-Za-z0-9._+-]+(/[A-Za-z0-9._+-]+)*$'
        AND EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE name = timezone_name
        )
    )
);
$$;

REVOKE ALL ON FUNCTION public.is_valid_iana_timezone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_iana_timezone(TEXT) TO anon, authenticated, service_role;

ALTER TABLE public.profiles
    ADD COLUMN preferred_timezone TEXT;

ALTER TABLE public.schools
    ADD COLUMN country TEXT NOT NULL DEFAULT 'Ghana',
    ADD COLUMN region TEXT,
    ADD COLUMN city TEXT,
    ADD COLUMN address TEXT,
    ADD COLUMN default_open_time TIME NOT NULL DEFAULT '07:00',
    ADD COLUMN default_close_time TIME NOT NULL DEFAULT '16:00',
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.school_settings
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::JSONB;

INSERT INTO public.school_settings (school_id)
SELECT school.id
FROM public.schools AS school
ON CONFLICT (school_id) DO NOTHING;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_timezone_check
        CHECK (preferred_timezone IS NULL OR public.is_valid_iana_timezone(preferred_timezone));

ALTER TABLE public.schools
    ADD CONSTRAINT schools_timezone_check
        CHECK (public.is_valid_iana_timezone(timezone));

CREATE TABLE public.campuses (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    city TEXT,
    address TEXT,
    timezone TEXT NOT NULL,
    logo_url TEXT,
    default_open_time TIME NOT NULL DEFAULT '07:00',
    default_close_time TIME NOT NULL DEFAULT '16:00',
    settings JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (school_id, id),
    CONSTRAINT campuses_timezone_check
        CHECK (public.is_valid_iana_timezone(timezone))
);

CREATE UNIQUE INDEX campuses_one_default_per_school_idx
    ON public.campuses (school_id)
    WHERE is_default;

CREATE UNIQUE INDEX campuses_school_name_idx
    ON public.campuses (school_id, LOWER(name));

CREATE INDEX campuses_school_id_idx ON public.campuses (school_id);

INSERT INTO public.campuses (
    school_id,
    name,
    country,
    region,
    city,
    address,
    timezone,
    logo_url,
    default_open_time,
    default_close_time,
    is_default
)
SELECT
    s.id,
    'Main Campus',
    s.country,
    s.region,
    s.city,
    s.address,
    s.timezone,
    s.logo_url,
    s.default_open_time,
    s.default_close_time,
    TRUE
FROM public.schools AS s
WHERE NOT EXISTS (
    SELECT 1
    FROM public.campuses AS c
    WHERE c.school_id = s.id
      AND c.is_default
);

ALTER TABLE public.school_memberships
    ADD COLUMN campus_id UUID;

UPDATE public.school_memberships AS membership
SET campus_id = campus.id
FROM public.campuses AS campus
WHERE campus.school_id = membership.school_id
  AND campus.is_default
  AND membership.campus_id IS NULL;

ALTER TABLE public.school_memberships
    ALTER COLUMN campus_id SET NOT NULL,
    DROP CONSTRAINT IF EXISTS school_memberships_school_id_user_id_key;

ALTER TABLE public.school_memberships
    ADD CONSTRAINT school_memberships_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT school_memberships_school_user_campus_key
        UNIQUE (school_id, user_id, campus_id);

CREATE INDEX school_memberships_campus_user_idx
    ON public.school_memberships (campus_id, user_id);

ALTER TABLE public.invitations
    ADD COLUMN campus_id UUID,
    ADD COLUMN reference TEXT;

UPDATE public.invitations AS invitation
SET campus_id = campus.id,
    reference = 'INV-' || UPPER(SUBSTRING(REPLACE(invitation.id::TEXT, '-', '') FROM 1 FOR 10))
FROM public.campuses AS campus
WHERE campus.school_id = invitation.school_id
  AND campus.is_default
  AND (invitation.campus_id IS NULL OR invitation.reference IS NULL);

ALTER TABLE public.invitations
    ALTER COLUMN campus_id SET NOT NULL,
    ALTER COLUMN reference SET NOT NULL,
    ADD CONSTRAINT invitations_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT invitations_reference_key UNIQUE (reference),
    ADD CONSTRAINT invitations_token_hash_format_check
        CHECK (token_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX invitations_campus_created_at_idx
    ON public.invitations (campus_id, created_at DESC);

ALTER TABLE public.devices
    ADD COLUMN campus_id UUID;

UPDATE public.devices AS device
SET campus_id = campus.id
FROM public.campuses AS campus
WHERE campus.school_id = device.school_id
  AND campus.is_default
  AND device.campus_id IS NULL;

ALTER TABLE public.devices
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT devices_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE;

CREATE INDEX devices_campus_id_idx ON public.devices (campus_id);

ALTER TABLE public.schedules
    ADD COLUMN campus_id UUID;

UPDATE public.schedules AS schedule
SET campus_id = campus.id
FROM public.campuses AS campus
WHERE campus.school_id = schedule.school_id
  AND campus.is_default
  AND schedule.campus_id IS NULL;

ALTER TABLE public.schedules
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT schedules_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT schedules_school_campus_id_key
        UNIQUE (school_id, campus_id, id);

CREATE INDEX schedules_campus_id_idx ON public.schedules (campus_id);

INSERT INTO public.schedules (school_id, campus_id, name)
SELECT campus.school_id, campus.id, 'Standard Timetable'
FROM public.campuses AS campus
WHERE NOT EXISTS (
    SELECT 1
    FROM public.schedules AS schedule
    WHERE schedule.school_id = campus.school_id
      AND schedule.campus_id = campus.id
);

ALTER TABLE public.schedule_events
    ADD COLUMN campus_id UUID;

UPDATE public.schedule_events AS event
SET campus_id = schedule.campus_id
FROM public.schedules AS schedule
WHERE schedule.id = event.schedule_id
  AND schedule.school_id = event.school_id
  AND event.campus_id IS NULL;

ALTER TABLE public.schedule_events
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT schedule_events_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE,
    ADD CONSTRAINT schedule_events_schedule_campus_fk
        FOREIGN KEY (school_id, campus_id, schedule_id)
        REFERENCES public.schedules (school_id, campus_id, id)
        ON DELETE CASCADE;

CREATE INDEX schedule_events_campus_id_idx ON public.schedule_events (campus_id);

ALTER TABLE public.schedule_events
    ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'live_on_device',
    ADD COLUMN change_summary TEXT,
    ADD COLUMN last_edited_by TEXT,
    ADD CONSTRAINT schedule_events_approval_status_check
        CHECK (approval_status IN ('draft', 'awaiting_principal', 'live_on_device'));

CREATE INDEX schedule_events_pending_approval_idx
    ON public.schedule_events (campus_id, created_at DESC)
    WHERE approval_status = 'awaiting_principal';

CREATE OR REPLACE FUNCTION public.advance_schedule_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    target_schedule_id UUID;
    target_school_id UUID;
    target_campus_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_schedule_id := OLD.schedule_id;
        target_school_id := OLD.school_id;
        target_campus_id := OLD.campus_id;
    ELSE
        target_schedule_id := NEW.schedule_id;
        target_school_id := NEW.school_id;
        target_campus_id := NEW.campus_id;
    END IF;

    UPDATE public.schedules AS schedule
       SET revision = revision + 1,
           updated_at = NOW()
     WHERE schedule.id = target_schedule_id
       AND schedule.school_id = target_school_id
       AND schedule.campus_id = target_campus_id;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_schedule_revision() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER advance_schedule_revision_after_event_change
    AFTER INSERT OR UPDATE OR DELETE ON public.schedule_events
    FOR EACH ROW
    EXECUTE FUNCTION public.advance_schedule_revision();

ALTER TABLE public.device_sync_state
    ADD COLUMN campus_id UUID;

UPDATE public.device_sync_state AS sync_state
SET campus_id = device.campus_id
FROM public.devices AS device
WHERE device.id = sync_state.device_id
  AND device.school_id = sync_state.school_id
  AND sync_state.campus_id IS NULL;

ALTER TABLE public.device_sync_state
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT device_sync_state_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE;

ALTER TABLE public.playback_events
    ADD COLUMN campus_id UUID;

UPDATE public.playback_events AS playback
SET campus_id = device.campus_id
FROM public.devices AS device
WHERE device.id = playback.device_id
  AND device.school_id = playback.school_id
  AND playback.campus_id IS NULL;

ALTER TABLE public.playback_events
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT playback_events_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE;

CREATE INDEX playback_events_campus_created_at_idx
    ON public.playback_events (campus_id, created_at DESC);

ALTER TABLE public.device_commands
    ADD COLUMN campus_id UUID;

UPDATE public.device_commands AS command
SET campus_id = device.campus_id
FROM public.devices AS device
WHERE device.id = command.device_id
  AND device.school_id = command.school_id
  AND command.campus_id IS NULL;

ALTER TABLE public.device_commands
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT device_commands_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE;

CREATE INDEX device_commands_campus_status_idx
    ON public.device_commands (campus_id, status);

ALTER TABLE public.support_tickets
    ADD COLUMN campus_id UUID;

UPDATE public.support_tickets AS ticket
SET campus_id = device.campus_id
FROM public.devices AS device
WHERE device.id = ticket.device_id
  AND device.school_id = ticket.school_id
  AND ticket.campus_id IS NULL;

UPDATE public.support_tickets AS ticket
SET campus_id = campus.id
FROM public.campuses AS campus
WHERE campus.school_id = ticket.school_id
  AND campus.is_default
  AND ticket.campus_id IS NULL;

ALTER TABLE public.support_tickets
    ALTER COLUMN campus_id SET NOT NULL,
    ADD CONSTRAINT support_tickets_campus_fk
        FOREIGN KEY (school_id, campus_id)
        REFERENCES public.campuses (school_id, id)
        ON DELETE CASCADE;

CREATE INDEX support_tickets_campus_created_at_idx
    ON public.support_tickets (campus_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_school_role(
    user_uuid UUID,
    check_school_id UUID,
    allowed_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        auth.uid() = user_uuid
        AND (
            public.is_super_admin(user_uuid)
            OR EXISTS (
                SELECT 1
                FROM public.school_memberships AS membership
                JOIN public.profiles AS profile ON profile.id = membership.user_id
                WHERE membership.user_id = user_uuid
                  AND membership.school_id = check_school_id
                  AND membership.is_approved
                  AND membership.role = ANY (allowed_roles)
                  AND profile.is_active
                  AND NOT profile.must_change_password
            )
        ),
        FALSE
    );
$$;

CREATE OR REPLACE FUNCTION public.has_campus_access(
    user_uuid UUID,
    check_school_id UUID,
    check_campus_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        auth.uid() = user_uuid
        AND (
            public.is_super_admin(user_uuid)
            OR EXISTS (
                SELECT 1
                FROM public.school_memberships AS membership
                JOIN public.profiles AS profile ON profile.id = membership.user_id
                WHERE membership.user_id = user_uuid
                  AND membership.school_id = check_school_id
                  AND membership.is_approved
                  AND (membership.campus_id IS NULL OR membership.campus_id = check_campus_id)
                  AND profile.is_active
                  AND NOT profile.must_change_password
            )
        ),
        FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.has_school_role(UUID, UUID, TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_campus_access(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_school_role(UUID, UUID, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_campus_access(UUID, UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_default_campus_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    campus_uuid UUID;
BEGIN
    INSERT INTO public.campuses (
        school_id,
        name,
        country,
        region,
        city,
        address,
        timezone,
        logo_url,
        default_open_time,
        default_close_time,
        is_default
    )
    VALUES (
        NEW.id,
        'Main Campus',
        NEW.country,
        NEW.region,
        NEW.city,
        NEW.address,
        NEW.timezone,
        NEW.logo_url,
        NEW.default_open_time,
        NEW.default_close_time,
        TRUE
    )
    RETURNING id INTO campus_uuid;

    INSERT INTO public.school_settings (school_id)
    VALUES (NEW.id)
    ON CONFLICT (school_id) DO NOTHING;

    INSERT INTO public.schedules (school_id, campus_id, name)
    VALUES (NEW.id, campus_uuid, 'Standard Timetable');

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_default_campus_records() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_default_campus_records_after_school_insert
    AFTER INSERT ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_campus_records();

CREATE OR REPLACE FUNCTION public.create_default_campus_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.schedules (school_id, campus_id, name)
    VALUES (NEW.school_id, NEW.id, 'Standard Timetable');
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_default_campus_settings() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_default_schedule_after_campus_insert
    AFTER INSERT ON public.campuses
    FOR EACH ROW
    WHEN (NOT NEW.is_default)
    EXECUTE FUNCTION public.create_default_campus_settings();

DROP POLICY IF EXISTS "Schools managed by super admin only" ON public.schools;
CREATE POLICY "Schools created by super admins"
    ON public.schools
    FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Schools deleted by super admins"
    ON public.schools
    FOR DELETE
    USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Schools managed by super admin or school administrators"
    ON public.schools
    FOR UPDATE
    USING (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), id, ARRAY['admin', 'principal'])
    );

CREATE POLICY "Campuses viewable by school members"
    ON public.campuses
    FOR SELECT
    USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Campuses managed by school administrators"
    ON public.campuses
    FOR ALL
    USING (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    );

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitations viewable by Super Admin" ON public.invitations;
DROP POLICY IF EXISTS "Invitations manageable by Super Admin" ON public.invitations;
DROP POLICY IF EXISTS "Invitations viewable by school administrators" ON public.invitations;
DROP POLICY IF EXISTS "Invitations viewable by school admin or super admin" ON public.invitations;
CREATE POLICY "Invitations viewable by school administrators"
    ON public.invitations
    FOR SELECT
    USING (
        public.is_super_admin(auth.uid())
        OR (
            public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
            AND public.has_campus_access(auth.uid(), school_id, campus_id)
        )
    );

DROP POLICY IF EXISTS "Schools viewable by members or super admin" ON public.schools;
CREATE POLICY "Schools viewable by members or super admin"
    ON public.schools
    FOR SELECT
    USING (public.has_school_access(auth.uid(), id));

DROP POLICY IF EXISTS "Campus-scoped schedules viewable" ON public.schedules;
DROP POLICY IF EXISTS "Campus-scoped schedules manageable" ON public.schedules;
DROP POLICY IF EXISTS "Schedules viewable by school members or super admin" ON public.schedules;
DROP POLICY IF EXISTS "Schedules editable by school admin or super admin" ON public.schedules;
CREATE POLICY "Campus-scoped schedules viewable"
    ON public.schedules
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));
CREATE POLICY "Campus-scoped schedules manageable"
    ON public.schedules
    FOR ALL
    USING (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal', 'regulator'])
    )
    WITH CHECK (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal', 'regulator'])
    );

DROP POLICY IF EXISTS "Schedule events viewable by school members or super admin" ON public.schedule_events;
DROP POLICY IF EXISTS "Schedule events editable by school admin or super admin" ON public.schedule_events;
CREATE POLICY "Campus-scoped schedule events viewable"
    ON public.schedule_events
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));
CREATE POLICY "Campus-scoped schedule events manageable"
    ON public.schedule_events
    FOR ALL
    USING (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    );
CREATE POLICY "Campus-scoped regulators manage unapproved events"
    ON public.schedule_events
    FOR ALL
    USING (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['regulator'])
        AND approval_status <> 'live_on_device'
    )
    WITH CHECK (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['regulator'])
        AND approval_status <> 'live_on_device'
    );

DROP POLICY IF EXISTS "Devices viewable by school members or super admin" ON public.devices;
DROP POLICY IF EXISTS "Devices manageable by school admin or super admin" ON public.devices;
CREATE POLICY "Campus-scoped devices viewable"
    ON public.devices
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));
CREATE POLICY "Campus-scoped devices manageable"
    ON public.devices
    FOR ALL
    USING (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    );

DROP POLICY IF EXISTS "Sync state viewable by school members or super admin" ON public.device_sync_state;
CREATE POLICY "Campus-scoped sync state viewable"
    ON public.device_sync_state
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));

DROP POLICY IF EXISTS "Playback events viewable by school members or super admin" ON public.playback_events;
CREATE POLICY "Campus-scoped playback events viewable"
    ON public.playback_events
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));

DROP POLICY IF EXISTS "Commands viewable by school members or super admin" ON public.device_commands;
DROP POLICY IF EXISTS "Commands manageable by school admin or super admin" ON public.device_commands;
CREATE POLICY "Campus-scoped commands viewable"
    ON public.device_commands
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));

DROP POLICY IF EXISTS "Support tickets viewable by school members or super admin" ON public.support_tickets;
DROP POLICY IF EXISTS "Support tickets editable by school members or super admin" ON public.support_tickets;
CREATE POLICY "Campus-scoped support tickets viewable"
    ON public.support_tickets
    FOR SELECT
    USING (public.has_campus_access(auth.uid(), school_id, campus_id));
CREATE POLICY "Campus-scoped support tickets manageable"
    ON public.support_tickets
    FOR ALL
    USING (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.has_campus_access(auth.uid(), school_id, campus_id)
        AND public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    );

DROP POLICY IF EXISTS "School settings viewable by school members or super admin" ON public.school_settings;
DROP POLICY IF EXISTS "School settings editable by school admin or super admin" ON public.school_settings;
CREATE POLICY "School settings viewable by school members"
    ON public.school_settings
    FOR SELECT
    USING (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School settings editable by administrators"
    ON public.school_settings
    FOR UPDATE
    USING (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    )
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR public.has_school_role(auth.uid(), school_id, ARRAY['admin', 'principal'])
    );

DROP POLICY IF EXISTS "Memberships viewable by school members or super admin" ON public.school_memberships;
CREATE POLICY "Memberships viewable within assigned campus"
    ON public.school_memberships
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_super_admin(auth.uid())
        OR (
            public.has_school_access(auth.uid(), school_id)
            AND public.has_campus_access(auth.uid(), school_id, campus_id)
        )
    );

DROP FUNCTION IF EXISTS public.complete_invitation_password_setup();

CREATE OR REPLACE FUNCTION public.complete_invitation_password_setup(invite_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    current_email TEXT;
    account_is_active BOOLEAN;
    password_setup_required BOOLEAN;
    invitation_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'A signed-in account is required';
    END IF;

    SELECT LOWER(auth_user.email)
      INTO current_email
      FROM auth.users AS auth_user
     WHERE auth_user.id = current_user_id
       AND auth_user.email_confirmed_at IS NOT NULL
       AND auth_user.encrypted_password IS NOT NULL
       AND auth_user.encrypted_password <> '';

    IF current_email IS NULL THEN
        RAISE EXCEPTION 'Email confirmation and password are required before account setup';
    END IF;

    SELECT profile.is_active, profile.must_change_password
      INTO account_is_active, password_setup_required
      FROM public.profiles AS profile
     WHERE profile.id = current_user_id
     FOR UPDATE;

    IF NOT FOUND OR NOT account_is_active THEN
        RAISE EXCEPTION 'This account is disabled or unavailable';
    END IF;

    IF NOT password_setup_required THEN
        RETURN TRUE;
    END IF;

    UPDATE public.invitations AS invitation
       SET is_used = TRUE,
           updated_at = NOW()
     WHERE invitation.auth_user_id = current_user_id
       AND invitation.email = current_email
       AND invitation.token_hash = invite_token_hash
       AND invitation.is_used = FALSE
       AND invitation.revoked_at IS NULL
       AND invitation.expires_at > NOW()
    RETURNING invitation.id INTO invitation_id;

    IF invitation_id IS NULL THEN
        RAISE EXCEPTION 'This invitation token is invalid, expired, revoked, or already used';
    END IF;

    UPDATE public.profiles
       SET must_change_password = FALSE,
           updated_at = NOW()
     WHERE id = current_user_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_invitation_password_setup(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_invitation_password_setup(TEXT) TO authenticated;