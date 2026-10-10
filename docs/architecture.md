# BellNexa System Architecture Blueprint & Operational Specification

## 1. System Vision
BellNexa is a multi-tenant, offline-first school bell and scheduled announcement platform.
It is built on a dual-component model:
1. **Web Administration Dashboard**: Centralized management for Super Administrators (founder) and School Administrators (e.g., Vilac International School).
2. **Native Android Bell Engine**: Local playback application running on dedicated school Android hardware, utilizing `AlarmManager` exact alarms, `Room` SQLite DB, and Media3 audio rendering.

---

## 2. Multi-Tenant Data Isolation Strategy
- All tables contain a strict `school_id` foreign key.
- Supabase Row Level Security (RLS) policies enforce database-level access control.
- `is_super_admin(auth.uid())` helper function grants platform-wide access to Super Admins.
- `has_school_access(auth.uid(), school_id)` validates user membership in `school_memberships`.

---

## 3. Offline-First Bell Playback Guarantee
- The Android application caches all approved schedule events and audio assets in a local Room database.
- Bell ringing and voice announcements are triggered via `AlarmManager.setAlarmClock()` / `setExactAndAllowWhileIdle()`.
- Alarms fire without network connectivity, when the screen is locked, or when the app is backgrounded.
- Reboot recovery is automatically handled by an Android `RECEIVE_BOOT_COMPLETED` BroadcastReceiver.
