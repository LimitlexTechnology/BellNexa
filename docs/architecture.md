# BellNexa System Architecture Blueprint & Operational Specification

## 1. System Vision
BellNexa is designed as a multi-school bell scheduling and announcement platform.
Its intended delivery model has two components:
1. **Web Administration Dashboard**: Centralized management for Super Administrators (founder) and School Administrators (e.g., Vilac International School).
2. **Native Android Bell Engine (planned)**: A dedicated school device app may use `AlarmManager` exact alarms, a local schedule database, and Media3 audio rendering.

The repository currently contains the React/Vite web app only. Authentication uses Supabase Auth and account roles are read from Supabase profiles and approved school memberships. Bell schedules, invitations, audio, and device workflows still include demo/local state; there is no Android app or automatic scheduled-playback engine in this repository.

---

## 2. Multi-Tenant Data Isolation Strategy
- All tables contain a strict `school_id` foreign key.
- Supabase Row Level Security (RLS) policies enforce database-level access control.
- `is_super_admin(auth.uid())` grants platform-wide RLS access only when the authenticated profile is explicitly assigned Super Admin status and the JWT has MFA assurance level `aal2`.
- `has_school_access(auth.uid(), school_id)` validates user membership in `school_memberships`.

---

## 3. Authentication status
- Email/password sign-in, password recovery, and TOTP verification use Supabase Auth; demo passwords, role heuristics, sample OTPs, and client-side role switchers have been removed.
- Profiles are created with `is_super_admin = FALSE` when an email-based Supabase Auth user is created. Non-Super Admin access requires an approved school membership.
- The browser only uses the public Supabase anon key. Super Admin assignment is a deliberate project-owner SQL operation after account/email verification; registration, user metadata, and client profile edits cannot grant it.
- The secure Super Admin migration must be applied to the hosted Supabase project before this access model is active there. See [Super Admin access](./super-admin-access.md) for provisioning and recovery.
- The designated Super Admin account's existence and current role have not been verified against the hosted project. The public anon key cannot list Auth users; only a trusted project owner can perform that check.

---

## 4. Offline and Background Playback
- The web app's service worker caches the production app shell and static assets for offline loading after an initial successful visit.
- The web app does not currently persist approved schedules/audio for offline playback and does not run an automatic schedule trigger. Browser audio and background execution are best-effort and vary by operating system, browser, power settings, and user interaction.
- A dedicated Android app is planned for supported school hardware. It must be implemented and tested with approved schedule sync, local storage, exact-alarm permissions, audio playback, and reboot recovery before offline/background playback can be claimed.
- No solution can guarantee browser-based audio playback on every device, particularly when the operating system suspends or terminates the page.
