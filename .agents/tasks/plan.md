# Implementation Plan: Fix Sign-In Bug

## Root Cause Analysis

After investigating the authentication flow in the BellNexa React + Vite + Supabase application, I've identified the following issues causing users to be redirected back to the login page after attempting to sign in:

### Primary Issue: Invalid Supabase Anon Key
**File**: `frontend/.env.local`  
**Line**: 2  
**Problem**: The `VITE_SUPABASE_ANON_KEY` value is `sb_publishable_zzwoYsHPSGkKdKqebY04DA_Q_PITWcV`, which appears to be truncated or invalid. Supabase publishable keys are typically much longer (200+ characters). This invalid key causes authentication requests to fail silently, preventing session creation.

### Secondary Issue: Missing Auth Configuration Options
**File**: `frontend/src/lib/supabase.ts`  
**Lines**: 26  
**Problem**: The Supabase client is created without explicit auth configuration options. While `@supabase/supabase-js` defaults to `persistSession: true` and `detectSessionInUrl: true`, explicitly setting these options ensures consistent behavior and makes the configuration clear.

### Contributing Factors Identified:
1. The `isSupabaseConfigured()` function (lines 29-39 in `supabase.ts`) only validates that keys exist and don't contain placeholder values, but doesn't validate key format or length
2. No error handling for invalid API keys during client initialization
3. The auth error from invalid credentials may not be surfaced clearly to the user

## Implementation Steps

- [ ] 1. **Obtain valid Supabase credentials from the Supabase dashboard**
      Navigate to the Supabase project dashboard at https://ajdblqtbyqrnrwzdipco.supabase.co (based on URL in .env.local), go to Settings → API, and copy the full `publishable key` (starts with `sb_publishable_` or the `anon` key which starts with `eyJ`). The key should be 200+ characters long.
      Files: None (manual step)
      Verify: Confirm the copied key is at least 200 characters long and matches the format from the Supabase dashboard.

- [ ] 2. **Update the .env.local file with the correct Supabase anon/publishable key**
      Replace the truncated key in `frontend/.env.local` line 2 with the full key obtained from step 1.
      Files: `c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa\frontend\.env.local`
      Verify: Run `Get-Content "c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa\frontend\.env.local"` and confirm VITE_SUPABASE_ANON_KEY is 200+ characters.

- [ ] 3. **Add explicit auth configuration to Supabase client initialization**
      In `frontend/src/lib/supabase.ts` line 26, modify the `createClient` call to include explicit auth options: `auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storage: typeof window !== 'undefined' ? window.localStorage : undefined }`. This ensures session persistence works correctly and auth state changes are detected from URL parameters (important for email confirmation flows).
      Files: `c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa\frontend\src\lib\supabase.ts`
      Verify: Run `npm run build` from the frontend directory and confirm no TypeScript errors.

- [ ] 4. **Enhance isSupabaseConfigured validation to check key format**
      In `frontend/src/lib/supabase.ts`, update the `isSupabaseConfigured()` function (lines 29-39) to also validate that the anon key is at least 100 characters long and that the URL follows the pattern `https://*.supabase.co`. Add checks: `url.length > 20 && /^https:\/\/.+\.supabase\.co$/.test(url)` and `anonKey.length >= 100`.
      Files: `c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa\frontend\src\lib\supabase.ts`
      Verify: Run `npm run build` from the frontend directory and confirm no TypeScript errors.

- [ ] 5. **Clear browser storage and test the sign-in flow**
      Clear all browser localStorage and sessionStorage for the app (open DevTools → Application → Storage → Clear site data), restart the dev server with `npm run dev`, navigate to http://localhost:3000, and attempt to sign in with a valid test account. Confirm that after successful authentication, the user is directed to their appropriate dashboard (not back to the login page) and that the session persists after page refresh.
      Files: None (testing step)
      Verify: Sign in successfully, verify dashboard loads, refresh the page, confirm still authenticated without being redirected to login.

- [ ] 6. **Verify Supabase dashboard redirect URL configuration**
      In the Supabase dashboard under Authentication → URL Configuration, confirm that `http://localhost:3000` is listed as the Site URL and that redirect URLs include `http://localhost:3000/**`. If deploying to production, also add the production domain with wildcard path.
      Files: None (Supabase dashboard configuration)
      Verify: Navigate to Supabase dashboard → Authentication → URL Configuration and confirm localhost URLs are present.

- [ ] 7. **Test password recovery and invitation flows**
      Test the password reset flow (click "Forgot password?" on login page, submit email, click link in email) and confirm it redirects back to the app correctly. If invitation flow is set up, test that invited users can activate their accounts.
      Files: None (testing step)  
      Verify: Complete password reset flow end-to-end, confirm redirect back to app with password change form, successfully set new password and sign in.

## Notes

- **Critical**: The primary fix is obtaining the correct, complete Supabase anon/publishable key. The truncated key in `.env.local` will cause all auth operations to fail.
- **Environment**: Changes to `.env.local` require restarting the Vite dev server (`npm run dev`) to take effect.
- **Production deployment**: When deploying (using `npm run deploy:pages` or `npm run deploy:worker`), ensure the build environment has the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured, as the build process embeds these values.
- **Security**: Never commit `.env.local` to git. The `.env.example` file should contain placeholder values only.
- **Testing**: Use a real test account with proper school membership to verify the full authentication flow, as the `getPendingAccount` function requires approved school memberships for non-super-admin users.

## Relevant Files Examined

- `frontend/src/lib/supabase.ts` - Supabase client initialization
- `frontend/src/context/AuthContext.tsx` - Authentication state management and sign-in logic
- `frontend/src/App.tsx` - Route logic that shows login vs dashboard
- `frontend/src/pages/Login.tsx` - Login form component
- `frontend/.env.local` - Environment variables (contains invalid key)
- `frontend/package.json` - Dependencies (@supabase/supabase-js v2.117.3, @supabase/ssr v0.12.7)
- `docs/registration-auth.md` - Documentation on auth setup and configuration requirements
