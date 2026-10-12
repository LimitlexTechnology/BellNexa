# AuthContext Test Plan

## Overview
This document outlines test coverage requirements for the authentication system to prevent regressions in sign-in flows, session persistence, and error handling.

## Test Framework Setup Required
1. Install Vitest: `npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom`
2. Create `vitest.config.ts` in frontend root
3. Add test script to package.json: `"test": "vitest"`

## Unit Tests Required

### 1. Session Persistence Across Page Reload
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ Session persists in localStorage after successful sign-in
- ✓ Session is restored from localStorage on page load
- ✓ User remains authenticated after page reload
- ✓ Super admin MFA state persists during page reload (pendingAccount remains set)

### 2. Error Code Mapping
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ `email_not_confirmed` error returns user-friendly message
- ✓ `user_banned` error returns user-friendly message
- ✓ Generic Supabase errors are passed through
- ✓ Network errors are handled gracefully

### 3. isSupabaseConfigured() Validation
**File:** `src/lib/supabase.test.ts`

Test cases:
- ✓ Accepts modern `sb_publishable_` keys (~52 chars)
- ✓ Accepts legacy JWT `eyJ` keys (200+ chars)
- ✓ Rejects placeholder values
- ✓ Validates URL matches `.supabase.co` domain pattern
- ✓ Rejects URLs containing 'example.com'
- ✓ Rejects keys containing 'placeholder'
- ✓ Requires minimum key length of 40 characters
- ✓ Requires minimum URL length of 20 characters

### 4. detectSessionInUrl Behavior
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ Password reset flow: URL fragment with access_token triggers PASSWORD_RECOVERY event
- ✓ Email confirmation flow: URL fragment is detected and session is created
- ✓ Normal navigation: No URL fragment does not trigger session detection

### 5. MFA Flow for Super Admin
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ Super admin sign-in triggers MFA enrollment when no factor exists
- ✓ Super admin sign-in triggers MFA verification when factor exists
- ✓ MFA code validation rejects non-6-digit codes
- ✓ Successful MFA completion sets authenticated account
- ✓ Failed MFA verification shows error message
- ✓ Cancel pending sign-in clears pending account and signs out

### 6. Regular User Sign-in Flow
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ Non-super-admin roles skip MFA flow
- ✓ User is authenticated immediately after successful password check
- ✓ Account loading failure signs out the session
- ✓ Missing profile throws appropriate error
- ✓ Inactive account throws appropriate error
- ✓ No approved school membership throws appropriate error

### 7. Logging Instrumentation
**File:** `src/context/AuthContext.test.tsx`

Test cases:
- ✓ Console.error is called when sign-in fails (configuration)
- ✓ Console.error is called when sign-in fails (invalid credentials)
- ✓ Console.log is called when account loads successfully
- ✓ Console.error is called when MFA setup fails
- ✓ Console.log is called when MFA verification succeeds

## Integration Tests Required

### 1. End-to-End Super Admin Sign-in with MFA
**File:** `tests/e2e/auth.spec.ts`

Test cases:
- ✓ Fresh sign-in with MFA setup (QR code screen → complete setup → dashboard)
- ✓ Sign-in with existing MFA (6-digit code screen → enter code → dashboard)
- ✓ Page reload during MFA setup (QR code persists)
- ✓ Page reload during MFA verification (code entry screen persists)
- ✓ MFA cancellation returns to credentials form and clears session

### 2. End-to-End Regular User Sign-in
**File:** `tests/e2e/auth.spec.ts`

Test cases:
- ✓ Sign in as principal/admin/regulator → direct redirect to dashboard
- ✓ Page reload after sign-in → session persists, dashboard remains loaded

## Mock Setup Required

### Supabase Client Mock
Create `src/lib/__mocks__/supabase.ts` with:
- Mock `createClient` function
- Mock auth methods: `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`
- Mock MFA methods: `getAuthenticatorAssuranceLevel`, `listFactors`, `enroll`, `challengeAndVerify`, `unenroll`
- Mock database queries: `from().select().eq().maybeSingle()`

### localStorage Mock
Create mock for window.localStorage to test session persistence

## Coverage Goals
- Minimum 80% code coverage for AuthContext.tsx
- 100% coverage for isSupabaseConfigured() function
- 100% coverage for error code mapping logic
- 100% coverage for MFA flow state transitions

## Priority
1. **High:** Session persistence, MFA flow, error code mapping
2. **Medium:** isSupabaseConfigured() validation, logging instrumentation
3. **Low:** Integration tests (can be manual until E2E framework is set up)

## Notes
- Tests should not make real Supabase API calls — all Supabase methods must be mocked
- Use `@testing-library/react` for rendering components and testing hooks
- Use `vi.mock()` from Vitest to mock the Supabase client
- Session data should use realistic mock values (valid UUIDs, proper timestamps)
