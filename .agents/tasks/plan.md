# Implementation Plan: Fix Super Admin Sign-in Redirect Loop

## Root Cause Analysis

The redirect loop occurs because:

1. **Missing SIGNED_IN handler**: The `onAuthStateChange` listener in AuthContext.tsx only handles `PASSWORD_RECOVERY` and `SIGNED_OUT` events. When Supabase fires `SIGNED_IN` after the session is established, nothing runs, so `isAuthenticated` remains false and App.tsx renders Login again.

2. **Page reload during MFA wipes state**: On page load, `getSession()` calls `loadSession()` which calls `prepareAdminMFA()`. If MFA assurance is not `aal2`, `setPendingAccount()` is called but `setIsLoading(false)` runs without setting any user — so `isAuthenticated=false` and App.tsx renders Login, wiping out the pending MFA state.

3. **No INITIAL_SESSION handling**: Supabase v2 fires `INITIAL_SESSION` on page load, which is not handled, so the initial session restoration happens via the separate `getSession()` call rather than through the auth state change listener.

4. **isLoading false while pendingAccount exists for super_admin**: When a super_admin is at the MFA step, `isLoading` becomes false even though `pendingAccount` is non-null and `isAuthenticated` is false. This causes App.tsx to render Login instead of showing the loading screen, which wipes the MFA state when Login remounts.

## Implementation Steps

- [ ] 1. Add SIGNED_IN and INITIAL_SESSION event handling to onAuthStateChange listener in AuthContext.tsx.
      When SIGNED_IN or INITIAL_SESSION fires with a session, call loadSession(event.session) to restore the account state and handle MFA flow for super_admin.
      Files: c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa/frontend/src/context/AuthContext.tsx
      Verify: `npm run build` — TypeScript compilation succeeds with no errors.

- [ ] 2. Keep isLoading true when pendingAccount is non-null for super_admin role.
      Modify the isLoading state management so that when pendingAccount exists (super_admin is in MFA flow), isLoading remains true. This prevents App.tsx from rendering Login and wiping the MFA state.
      Add a condition: after loadSession completes, only set isLoading(false) if pendingAccount is null OR the account is not super_admin.
      Files: c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa/frontend/src/context/AuthContext.tsx
      Verify: `npm run build` — TypeScript compilation succeeds.

- [ ] 3. Remove redundant getSession call or make it idempotent with onAuthStateChange.
      Since INITIAL_SESSION event now handles session restoration, the separate getSession() call in the useEffect becomes redundant. Two options:
      Option A (recommended): Remove the getSession() call entirely and rely on INITIAL_SESSION event.
      Option B: Keep both but add a flag to prevent double-processing of the initial session.
      Decision: Remove the getSession() call and rely on INITIAL_SESSION, as this is the recommended Supabase v2 pattern and simplifies the code.
      Files: c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa/frontend/src/context/AuthContext.tsx
      Verify: `npm run build` — TypeScript compilation succeeds.

- [ ] 4. Ensure Login component respects requiresMFA/requiresMFASetup state during page reloads.
      The Login component already checks requiresMFA and requiresMFASetup flags correctly to show the MFA step UI. However, with the fixes above, these flags will now persist through page reloads because isLoading will stay true and pendingAccount will be maintained.
      No code changes needed in Login.tsx — this is verification only.
      Files: c:\Users\kobby\OneDrive\Documentos\GitHub\BellNexa/frontend/src/pages/Login.tsx (verification only, no changes)
      Verify: Manual test — sign in as super_admin, verify MFA screen appears, reload the page, verify MFA screen persists instead of returning to credentials form.

- [ ] 5. Test the complete super_admin sign-in flow end-to-end.
      - Test 1: Fresh sign-in with MFA setup — sign in as super_admin with no TOTP enrolled, verify QR code screen appears, complete setup, verify dashboard loads.
      - Test 2: Sign-in with existing MFA — sign in as super_admin with TOTP already enrolled, verify 6-digit code screen appears, enter code, verify dashboard loads.
      - Test 3: Page reload during MFA setup — sign in as super_admin, get to QR code screen, reload the page, verify QR code screen persists (not back to credentials).
      - Test 4: Page reload during MFA verification — sign in as super_admin with enrolled TOTP, get to 6-digit code screen, reload the page, verify code entry screen persists.
      - Test 5: MFA cancellation — sign in as super_admin, get to MFA screen, click "Cancel sign-in", verify return to credentials form and session is cleared.
      Files: Manual testing against running app (`npm run dev`)
      Verify: All five test scenarios pass without redirect loop or state loss.

- [ ] 6. Test regular user (non-super_admin) sign-in flow.
      - Test 1: Sign in as principal/admin/regulator — verify direct redirect to dashboard without MFA.
      - Test 2: Page reload after sign-in — verify session persists and dashboard remains loaded.
      Files: Manual testing against running app (`npm run dev`)
      Verify: Regular users can sign in and stay signed in through page reloads.

## Additional Notes

- The Supabase client is configured with `autoRefreshToken: true` and `persistSession: true`, so session persistence across page reloads is already enabled at the client level.
- The MFA flow for super_admin uses `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` to check if aal2 (MFA) is satisfied. The fix ensures this check happens on every page load via the INITIAL_SESSION event.
- The `passwordRecoveryRef` flag correctly prevents loadSession from running during password recovery flows — this logic should remain unchanged.
- The account sync realtime subscriptions (watching profiles, school_memberships, schools tables) are independent of the sign-in flow and do not need changes.

## Expected Outcome

After implementing these changes:
1. Super admin users can sign in, complete MFA (setup or verification), and reach their dashboard without being redirected back to the login page.
2. Page reloads during the MFA flow preserve the MFA state instead of returning to the credentials form.
3. Once authenticated, super admin users stay signed in through page reloads.
4. Regular users (non-super_admin) continue to sign in normally without any MFA flow.
5. The sign-in flow is driven by Supabase's auth state change events (SIGNED_IN, INITIAL_SESSION, SIGNED_OUT) rather than imperative getSession calls, following Supabase v2 best practices.
