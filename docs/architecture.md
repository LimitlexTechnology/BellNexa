# BellNexa System Architecture Blueprint & Operational Specification

## 1. System Vision
BellNexa is designed as a multi-school bell scheduling and announcement platform.
Its intended delivery model has two components:
1. **Web Administration Dashboard**: Centralized management for Super Administrators (founder) and School Administrators (e.g., Vilac International School).
2. **Native Android Bell Engine (planned)**: A dedicated school device app may use `AlarmManager` exact alarms, a local schedule database, and Media3 audio rendering.

The repository currently contains the React/Vite web app only. Its schedule and authentication data are demo state; there is no Android app or automatic scheduled-playback engine in this repository.

---

## 2. Multi-Tenant Data Isolation Strategy
- All tables contain a strict `school_id` foreign key.
- Supabase Row Level Security (RLS) policies enforce database-level access control.
- `is_super_admin(auth.uid())` helper function grants platform-wide access to Super Admins.
- `has_school_access(auth.uid(), school_id)` validates user membership in `school_memberships`.

---

## 3. Offline and Background Playback
- The web app's service worker caches the production app shell and static assets for offline loading after an initial successful visit.
- The web app does not currently persist approved schedules/audio for offline playback and does not run an automatic schedule trigger. Browser audio and background execution are best-effort and vary by operating system, browser, power settings, and user interaction.
- A dedicated Android app is planned for supported school hardware. It must be implemented and tested with approved schedule sync, local storage, exact-alarm permissions, audio playback, and reboot recovery before offline/background playback can be claimed.
- No solution can guarantee browser-based audio playback on every device, particularly when the operating system suspends or terminates the page.
