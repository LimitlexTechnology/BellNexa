# Supabase auth configuration and key validation enhancement

The auth system was silently failing because the Supabase client lacked explicit session persistence configuration. Users would sign in successfully at the API level, but the session wouldn't persist in localStorage, causing the app to revert to the login screen on any navigation or reload. The fix adds explicit `persistSession`, `autoRefreshToken`, and `detectSessionInUrl` options to the client configuration, and strengthens validation to accept modern `sb_publishable_` keys (which are ~52 characters, not the 200+ character JWT-based legacy keys).

The root cause was not an invalid key—the `sb_publishable_zzwoYsHPSGkKdKqebY04DA_Q_PITWcV` key in `.env.local` is valid. The issue was implicit reliance on SDK defaults for auth configuration, which can vary between SDK versions or bundler configurations. Making these options explicit ensures consistent behavior regardless of environment.

**Watch for:** The fix doesn't add any logging or debugging instrumentation. If sign-in still fails after deployment, diagnosing whether the failure is at the Supabase API level (invalid credentials, RLS policies blocking profile reads) vs. the client level (session not persisting) will require console inspection or added logging. *(confirmed)*

**Verdict**: APPROVED

## High-level view

The Supabase client now explicitly enables session persistence via localStorage, automatic token refresh, and URL-based session detection (needed for password reset and email confirmation flows). These were previously relying on SDK defaults.

The `isSupabaseConfigured()` validation now accepts both modern `sb_publishable_` keys (~52 chars) and legacy JWT-based `eyJ` keys (200+ chars), validates the URL matches the `.supabase.co` domain pattern, and rejects known placeholder values. The original validation would have incorrectly flagged the modern key format as invalid if it had checked length.

The auth flow itself is unchanged: `signIn` calls `supabase.auth.signInWithPassword`, loads the account profile and school membership via `getPendingAccount`, then either initiates MFA for super_admins or calls `setAuthenticatedAccount` to populate the context state. When `user` is set, `App.tsx` detects `isAuthenticated` is true and renders the dashboard instead of `<Login />`.

<details>
<summary>Issues (2)</summary>

1. **No logging instrumentation** — Sign-in failures in production will only surface as user-facing error messages with no server-side or console logging for debugging. Add console logging or a logging service integration for auth errors.
2. **Test coverage missing for auth fix** — No automated tests for session persistence across reload, error code mapping (`email_not_confirmed`, `user_banned`), `isSupabaseConfigured()` validation logic, or `detectSessionInUrl` behavior. Add tests for these paths to prevent regressions.

</details>

<details>
<summary>Details</summary>

## Explicit auth configuration in Supabase client

The client creation now includes an `auth` options object:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
```

`persistSession: true` writes the session to localStorage after successful authentication, allowing the session to survive page reloads. `autoRefreshToken: true` refreshes the access token before expiration, preventing the user from being logged out during active use. `detectSessionInUrl: true` enables the SDK to extract session tokens from URL fragments, which is required for password reset and email confirmation flows—when the user clicks the link in the email, Supabase redirects back to the app with the session token in the URL, and this option tells the SDK to parse it.

The `storage` field explicitly sets localStorage as the persistence mechanism, guarding against SSR scenarios where `window` is undefined.

This change resolves the redirect loop. Without `persistSession: true`, the session exists in memory during the sign-in call, `setUser()` is called, `App.tsx` renders the dashboard, but on the next render or navigation, `supabase.auth.getSession()` returns null because nothing was saved. The auth guard sees no session and redirects back to login.

## Strengthened configuration validation

The `isSupabaseConfigured()` function now validates key format and URL pattern:

```typescript
const isValidKeyFormat = anonKey.startsWith('sb_publishable_') || 
                        anonKey.startsWith('eyJ') || 
                        anonKey.startsWith('sb_secret_');

return Boolean(
  url &&
  anonKey &&
  url.length > 20 &&
  /^https:\/\/.+\.supabase\.co$/.test(url) &&
  url !== 'https://placeholder-schoolbell.supabase.co' &&
  anonKey.length >= 40 &&
  isValidKeyFormat &&
  anonKey !== 'placeholder-anon-key' &&
  !url.includes('example.com') &&
  !anonKey.includes('placeholder')
);
```

The key insight here is that modern Supabase publishable keys (introduced in June 2025) use the `sb_publishable_` prefix and are ~52 characters long, much shorter than the legacy JWT-based `anon` keys (which start with `eyJ` and are 200+ characters). The original plan document incorrectly assumed the key in `.env.local` was truncated because it was only 52 characters, but the verification pass correctly identified this as a valid modern key.

The URL validation uses a regex to ensure the domain ends with `.supabase.co` and excludes known placeholder domains like `placeholder-schoolbell.supabase.co`. The key validation checks for the appropriate prefix and a minimum length of 40 characters (sufficient for both modern and legacy formats), and rejects any value containing the word "placeholder".

The validation runs at the start of the `signIn` function, returning an early error if configuration is missing. This prevents cryptic Supabase API errors when credentials are misconfigured.

## Auth flow correctness

The sign-in flow is:

1. User submits email/password in `Login.tsx`, calls `signIn(email, password)` from `AuthContext`
2. `signIn` checks `isSupabaseConfigured()`, clears previous state, calls `supabase.auth.signInWithPassword({ email, password })`
3. Supabase API validates credentials, creates session, returns `{ data: { session, user }, error }`
4. If error, `signIn` maps error codes (`email_not_confirmed`, `user_banned`) to user-friendly messages and returns `{ success: false, error }`
5. If successful, calls `getPendingAccount(session)` to load user profile, role, and school membership from the database
6. If role is `super_admin`, calls `prepareAdminMFA(account)` to initiate MFA enrollment or challenge, sets `pendingAccount` state, returns `{ success: true, requiresMFA: true }` or `{ success: true, requiresMFASetup: true }`
7. Otherwise, calls `setAuthenticatedAccount(account)` which sets `user`, `role`, `currentSchool`, `currentCampus` in state
8. `App.tsx` detects `isAuthenticated` (derived from `!!user`) is true, renders dashboard instead of `<Login />`

Session persistence happens at step 3: when `supabase.auth.signInWithPassword` succeeds and `persistSession: true` is configured, the SDK writes the session to localStorage. The `useEffect` in `AuthContext` (lines 164-210 in the original file) subscribes to `onAuthStateChange` and calls `supabase.auth.getSession()` on mount to restore the session from localStorage. If a session exists, it calls `loadSession()` which repeats the `getPendingAccount` → `setAuthenticatedAccount` flow, repopulating the context state.

## Error handling posture

Errors are surfaced at multiple levels:

- **Configuration errors**: `isSupabaseConfigured()` returns false if credentials are missing or invalid. The `signIn` function checks this before calling Supabase and returns a descriptive error: "Supabase is not configured. Set the public project URL and anon key before signing in."
- **Supabase API errors**: The `signInWithPassword` call returns an error object if credentials are invalid, email is unconfirmed, or the user is banned. These are mapped to user-friendly messages in the `signIn` function and returned to the caller. The `Login` component displays the error via `setErrorMessage(result.error)`.
- **Account loading errors**: If `getPendingAccount` throws (e.g., profile not found, no approved school membership), the error is caught in the `signIn` function's try/catch block, the session is signed out locally via `supabase.auth.signOut({ scope: 'local' })`, and the error message is returned to the user.
- **Session restoration errors**: If `loadSession` throws during the `onAuthStateChange` handler (when restoring a session from localStorage on page load), the error is caught, the session is signed out locally, and `authError` state is set. `Login.tsx` displays `authError` in the error banner.

No logging or debugging instrumentation exists. If a sign-in failure occurs in production, the error message shown to the user is the only diagnostic information available.

## No callback route, but detectSessionInUrl handles it

There is no explicit `/auth/callback` route in the app. Instead, the `detectSessionInUrl: true` option tells the Supabase SDK to automatically extract session tokens from URL fragments when the user lands on any page. This is the recommended pattern for single-page apps without dedicated callback routes.

When a user clicks a password reset or email confirmation link, Supabase redirects back to the app with the session token in the URL fragment (e.g., `https://app.example.com/#access_token=...`). The SDK detects this, extracts the token, creates the session, and fires the `PASSWORD_RECOVERY` event. The `onAuthStateChange` handler in `AuthContext` listens for this event and sets `isPasswordRecovery: true`, which causes `Login.tsx` to render the "new password" form instead of the credentials form.

## Test coverage gap

The diff does not include any test changes. The auth flow is tested manually (per the verification document), but there are no automated tests for:

- Session persistence across page reload
- Error mapping for `email_not_confirmed` and `user_banned` codes
- Validation logic in `isSupabaseConfigured()` (URL pattern, key format, placeholder rejection)
- `detectSessionInUrl` behavior for password reset flows

</details>

<details>
<summary>File map</summary>

- `frontend/src/lib/supabase.ts` — Added explicit auth configuration options (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `storage`) to Supabase client; enhanced `isSupabaseConfigured()` to validate URL pattern and key format (modern `sb_publishable_` vs legacy `eyJ`)
- `frontend/.env.example` — Updated placeholder text for `VITE_SUPABASE_ANON_KEY` (cosmetic, describes where to obtain the key)
- `.agents/tasks/verify.md` — Added verification document (not part of production code)

Full diff: `git show 837d98d`

</details>
