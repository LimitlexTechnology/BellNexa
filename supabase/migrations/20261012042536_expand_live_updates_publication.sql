DO $$
DECLARE
    table_name TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        RAISE EXCEPTION 'The supabase_realtime publication is not available in this database';
    END IF;

    FOREACH table_name IN ARRAY ARRAY[
        'profiles',
        'school_memberships',
        'schedules',
        'schedule_events',
        'devices',
        'device_sync_state'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                table_name
            );
        END IF;
    END LOOP;
END;
$$;