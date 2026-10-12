-- BellNexa Production Migration: Initial Schema & Row Level Security (RLS)
-- Enables UUID generation, creates multi-tenant tables, functions, and RLS policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Schools Table
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
    logo_url TEXT,
    branding_primary TEXT NOT NULL DEFAULT '#00563F', -- Forest Green (Vilac pilot default)
    branding_secondary TEXT NOT NULL DEFAULT '#F4511E', -- Orange
    branding_accent TEXT NOT NULL DEFAULT '#E6AD00', -- Gold
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. School Memberships Table
CREATE TABLE IF NOT EXISTS public.school_memberships (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'support', 'auditor')),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(school_id, user_id)
);

-- 4. Single-Use Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'support', 'auditor')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Registered Android Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_hardware_id TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    app_version TEXT NOT NULL DEFAULT '1.0.0',
    battery_level INT CHECK (battery_level BETWEEN 0 AND 100),
    storage_free_mb INT,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_checkin_at TIMESTAMPTZ,
    applied_revision INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(school_id, device_hardware_id)
);

-- 6. Bell Schedules Table
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Audio Assets Metadata Table
CREATE TABLE IF NOT EXISTS public.audio_assets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    checksum_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Schedule Events Table
CREATE TABLE IF NOT EXISTS public.schedule_events (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'morning_assembly', 'lesson_commencement', 'lesson_change', 
        'snack_break', 'worship_time', 'lunch_break', 
        'closing_time', 'emergency', 'custom'
    )),
    start_time TIME NOT NULL,
    days_of_week INT[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Monday .. 7=Sunday
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    audio_asset_id UUID REFERENCES public.audio_assets(id) ON DELETE SET NULL,
    announcement_text TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    volume INT NOT NULL DEFAULT 100 CHECK (volume BETWEEN 0 AND 100),
    repeat_count INT NOT NULL DEFAULT 3 CHECK (repeat_count BETWEEN 1 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Device Sync State Table
CREATE TABLE IF NOT EXISTS public.device_sync_state (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    synced_revision INT NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    UNIQUE(device_id)
);

-- 10. Playback Audit Events Log Table (Offline buffered upload)
CREATE TABLE IF NOT EXISTS public.playback_events (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.schedule_events(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    actual_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'skipped', 'error')),
    audio_route TEXT,
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Remote Device Commands Queue Table
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL CHECK (command_type IN ('sync_schedule', 'sync_audio', 'run_diagnostic', 'pause_ringing', 'resume_ringing', 'play_test_announcement')),
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'failed')),
    created_by UUID REFERENCES public.profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    device_id UUID REFERENCES public.devices(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'waiting_for_school', 'resolved', 'closed')),
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Support Messages Thread Table
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. School Settings Table
CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    school_id UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
    allow_late_playback BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_contacts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR AUTHORIZATION & RLS
--------------------------------------------------------------------------------

-- Helper: Check if a user is a Platform Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND is_super_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if a user has approved membership access to a specific school
CREATE OR REPLACE FUNCTION public.has_school_access(user_uuid UUID, check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_super_admin(user_uuid) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.school_memberships
        WHERE user_id = user_uuid 
          AND school_id = check_school_id 
          AND is_approved = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Profiles viewable by self or super admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Profiles editable by self or super admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

-- 2. Schools RLS
CREATE POLICY "Schools viewable by members or super admin" ON public.schools
    FOR SELECT USING (public.has_school_access(auth.uid(), id));

CREATE POLICY "Schools managed by super admin only" ON public.schools
    FOR ALL USING (public.is_super_admin(auth.uid()));

-- 3. School Memberships RLS
CREATE POLICY "Memberships viewable by school members or super admin" ON public.school_memberships
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Memberships managed by super admin" ON public.school_memberships
    FOR ALL USING (public.is_super_admin(auth.uid()));

-- 4. Invitations RLS
CREATE POLICY "Invitations viewable by school admin or super admin" ON public.invitations
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Invitations manageable by school admin or super admin" ON public.invitations
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 5. Devices RLS
CREATE POLICY "Devices viewable by school members or super admin" ON public.devices
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Devices manageable by school admin or super admin" ON public.devices
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 6. Schedules RLS
CREATE POLICY "Schedules viewable by school members or super admin" ON public.schedules
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Schedules editable by school admin or super admin" ON public.schedules
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 7. Schedule Events RLS
CREATE POLICY "Schedule events viewable by school members or super admin" ON public.schedule_events
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Schedule events editable by school admin or super admin" ON public.schedule_events
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 8. Audio Assets RLS
CREATE POLICY "Audio assets viewable by school members or super admin" ON public.audio_assets
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Audio assets editable by school admin or super admin" ON public.audio_assets
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 9. Device Sync State RLS
CREATE POLICY "Sync state viewable by school members or super admin" ON public.device_sync_state
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

-- 10. Playback Events RLS
CREATE POLICY "Playback events viewable by school members or super admin" ON public.playback_events
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

-- 11. Device Commands RLS
CREATE POLICY "Commands viewable by school members or super admin" ON public.device_commands
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Commands manageable by school admin or super admin" ON public.device_commands
    FOR ALL USING (public.has_school_access(auth.uid(), school_id));

-- 12. Support Tickets RLS
CREATE POLICY "Support tickets viewable by school members or super admin" ON public.support_tickets
    FOR SELECT USING (public.has_school_access(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Support tickets editable by school members or super admin" ON public.support_tickets
    FOR ALL USING (public.has_school_access(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

-- 13. Audit Logs RLS
CREATE POLICY "Audit logs viewable by super admin or authorized school admin" ON public.audit_logs
    FOR SELECT USING (public.is_super_admin(auth.uid()) OR (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id)));
