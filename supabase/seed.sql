-- BellNexa Seed Data for Vilac International School Pilot

-- 1. Create Pilot School Record: Vilac International School
INSERT INTO public.schools (
    id,
    name,
    code,
    timezone,
    branding_primary,
    branding_secondary,
    branding_accent,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Vilac International School',
    'VILAC-ACCRA',
    'Africa/Accra',
    '#00563F', -- Forest Green
    '#F4511E', -- Orange
    '#E6AD00', -- Gold
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 2. Create School Settings
INSERT INTO public.school_settings (
    school_id,
    allow_late_playback,
    emergency_contacts
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    FALSE,
    '[{"name": "School Administration", "phone": "+233200000000"}]'::jsonb
) ON CONFLICT (school_id) DO NOTHING;

-- 3. Create Default Active Schedule for Vilac Pilot
INSERT INTO public.schedules (
    id,
    school_id,
    name,
    revision,
    is_active
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Standard Daily Timetable',
    1,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 4. Seed Standard School Events for Vilac
INSERT INTO public.schedule_events (
    schedule_id,
    school_id,
    event_name,
    category,
    start_time,
    days_of_week,
    announcement_text,
    language
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Morning Assembly Bell',
    'morning_assembly',
    '07:30:00',
    '{1,2,3,4,5}',
    'Good morning students and staff. Please proceed to the assembly ground for morning devotion.',
    'en'
),
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'First Period Commencement',
    'lesson_commencement',
    '08:00:00',
    '{1,2,3,4,5}',
    'First period has commenced. All students must be in their respective classrooms.',
    'en'
),
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Snack & Recess Break',
    'snack_break',
    '10:30:00',
    '{1,2,3,4,5}',
    'It is now time for morning break and snacks.',
    'en'
),
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Lunch Break',
    'lunch_break',
    '12:30:00',
    '{1,2,3,4,5}',
    'Lunch break has commenced. Enjoy your meal.',
    'en'
),
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'School Closing Bell',
    'closing_time',
    '15:30:00',
    '{1,2,3,4,5}',
    'School has closed for the day. Safe journey home to all students.',
    'en'
);
