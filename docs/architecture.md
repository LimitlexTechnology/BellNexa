# BellNexa System Architecture Blueprint & Operational Specification

## 1. System Vision
BellNexa is designed as a multi-school bell scheduling and announcement platform.
Its intended delivery model has two components:
1. **Web Administration Dashboard**: Centralized management for Super Administrators (founder) and School Administrators (e.g., Vilac International School).
2. **Native Android Bell Engine (planned)**: A dedicated school device app may use `AlarmManager` exact alarms, a local schedule database, and Media3 audio rendering.

The repository currently contains the React/Vite web app only. Authentication uses Supabase Auth and account roles are read from Supabase profiles and approved school memberships. Super Admin school invitations use a Supabase Edge Function after the invitation migration and function are deployed; bell schedules, audio, and device workflows still include demo/local state. There is no Android app or automatic scheduled-playback engine in this repository.

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
- Invitations are issued only to principals and regulators by an active Super Admin with `aal2` MFA. Email confirmation is followed by first-login password setup; it does not create or approve school membership. The invitation API and database migration are not active on a hosted project until explicitly deployed.
- Invitation expiry is one hour and should match the Supabase Auth email OTP expiry setting. Supabase's default development SMTP may restrict recipients and does not provide production delivery or branded templates; see [registration and invitation setup](./registration-auth.md).

## 5. Data synchronization status
- The Super Admin dashboard subscribes to Supabase Realtime changes for `schools` and `invitations`, then reloads those records through the authenticated Supabase client. Existing RLS policies remain the access-control boundary.
- Authenticated school accounts subscribe to their own profile and membership changes and their assigned school's record. The app rechecks the current session's profile, approved membership, and school when changes arrive.
- The Realtime publication migrations include the existing profile, membership, schedule, event, device, and device-sync tables. Publication membership alone does not implement client synchronization for every table.
- School and invitation views refresh on reconnect, window focus, and once per minute as a fallback. Connection and refresh errors are surfaced in the Super Admin dashboard or account status indicator.
- Schedule editing/approval, playback state, device reporting, support tickets, and most audit/dashboard data remain demo or local state. They are not yet synchronized by the UI; schedules and device telemetry require backend-backed workflows before Phase 6 is complete.

---

## 6. Offline and Background Playback
- The web app's service worker caches the production app shell and static assets for offline loading after an initial successful visit.
- The web app does not currently persist approved schedules/audio for offline playback and does not run an automatic schedule trigger. Browser audio and background execution are best-effort and vary by operating system, browser, power settings, and user interaction.
- A dedicated Android app is planned for supported school hardware. It must be implemented and tested with approved schedule sync, local storage, exact-alarm permissions, audio playback, and reboot recovery before offline/background playback can be claimed.
- No solution can guarantee browser-based audio playback on every device, particularly when the operating system suspends or terminates the page.
