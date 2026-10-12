import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Campus, Invitation, Profile, School, UserRole } from '../types/database';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isValidIanaTimeZone } from '../lib/timezone';

interface LoginResult {
  success: boolean;
  requiresMFA?: boolean;
  requiresMFASetup?: boolean;
  error?: string;
}

interface MfaSetup {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface PendingAccount {
  profile: Profile;
  role: UserRole;
  school: School | null;
  campus: Campus | null;
  workspaces: SchoolWorkspace[];
}

interface SchoolWorkspace {
  role: UserRole;
  school: School;
  campus: Campus;
}

interface AuthContextType {
  user: Profile | null;
  currentSchool: School | null;
  currentCampus: Campus | null;
  workspaces: SchoolWorkspace[];
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  accountSyncStatus: 'connecting' | 'connected' | 'polling' | 'offline' | 'error';
  accountSyncError: string | null;
  isBellPhoneMode: boolean;
  mfaSetup: MfaSetup | null;
  requiresMFA: boolean;
  requiresMFASetup: boolean;
  isPasswordRecovery: boolean;
  requiresPasswordSetup: boolean;
  invitations: Invitation[];
  setBellPhoneMode: (active: boolean) => void;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  completeMFA: (code: string) => Promise<LoginResult>;
  cancelPendingSignIn: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string, invitationToken?: string) => Promise<{ error?: string }>;
  updateProfile: (updates: Pick<Profile, 'full_name' | 'phone' | 'preferred_timezone'>) => Promise<void>;
  refreshInvitations: () => Promise<void>;
  createInvitation: (
    email: string,
    fullName: string,
    role: Exclude<UserRole, 'super_admin'>,
    schoolId: string,
    campusId: string,
  ) => Promise<Invitation>;
  revokeInvitation: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentSchool: (school: School | null) => void;
  switchWorkspace: (schoolId: string, campusId: string) => void;
}

export const MOCK_VILAC_SCHOOL: School = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Vilac International School',
  code: 'VILAC-ACCRA',
  timezone: 'Africa/Accra',
  country: 'Ghana',
  city: 'Accra',
  default_open_time: '07:00:00',
  default_close_time: '16:00:00',
  branding_primary: '#0A1B45',
  branding_secondary: '#087F9B',
  branding_accent: '#12C8E8',
  is_active: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const roleFromMembership = (value: string): UserRole | null => {
  switch (value) {
    case 'principal':
    case 'regulator':
    case 'admin':
    case 'support':
    case 'auditor':
      return value;
    default:
      return null;
  }
};

const functionErrorMessage = async (error: Error): Promise<string> => {
  if ('context' in error && error.context instanceof Response) {
    const responseBody = await error.context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof responseBody?.error === 'string') return responseBody.error;
  }
  return error.message;
};

const getPendingAccount = async (session: Session): Promise<PendingAccount> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, preferred_timezone, is_super_admin, is_active, must_change_password, created_at, updated_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new Error('Your account profile is not provisioned. Contact the BellNexa administrator.');
  }
  if (!profile.is_active) {
    throw new Error('Your BellNexa account is disabled. Contact your school administrator or BellNexa support.');
  }

  const accountProfile: Profile = {
    ...profile,
    role: profile.is_super_admin ? 'super_admin' : undefined,
    requires_2fa: profile.is_super_admin,
  };

  if (profile.is_super_admin) {
    return { profile: accountProfile, role: 'super_admin', school: null, campus: null, workspaces: [] };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('school_memberships')
    .select('school_id, campus_id, role')
    .eq('user_id', session.user.id)
    .eq('is_approved', true)
    .order('created_at', { ascending: true });

  if (membershipsError) throw membershipsError;
  if (!memberships?.length) {
    throw new Error('Your account does not have an approved school role. Contact your school administrator.');
  }

  const schoolIds = [...new Set(memberships.map(membership => membership.school_id))];
  const campusIds = [...new Set(memberships.map(membership => membership.campus_id))];
  const [{ data: schools, error: schoolsError }, { data: campuses, error: campusesError }] = await Promise.all([
    supabase.from('schools')
      .select('id, name, code, timezone, country, region, city, address, default_open_time, default_close_time, logo_url, branding_primary, branding_secondary, branding_accent, is_active, created_at, updated_at')
      .in('id', schoolIds),
    supabase.from('campuses')
      .select('id, school_id, name, country, region, city, address, timezone, logo_url, default_open_time, default_close_time, settings, is_default, is_active, created_at, updated_at')
      .in('id', campusIds),
  ]);
  if (schoolsError) throw schoolsError;
  if (campusesError) throw campusesError;
  const schoolById = new Map((schools || []).map(school => [school.id, school]));
  const campusById = new Map((campuses || []).map(campus => [campus.id, campus]));
  const workspaces = memberships.flatMap(membership => {
    const membershipRole = roleFromMembership(membership.role);
    const school = schoolById.get(membership.school_id);
    const campus = campusById.get(membership.campus_id);
    if (!membershipRole || !school?.is_active || !campus?.is_active || campus.school_id !== school.id) return [];
    return [{ role: membershipRole, school, campus }];
  });
  const activeWorkspace = workspaces[0];
  if (!activeWorkspace) {
    throw new Error('Your assigned school or campus is unavailable. Contact your school administrator.');
  }

  if (profile.must_change_password) {
    return {
      profile: { ...accountProfile, role: activeWorkspace.role },
      role: activeWorkspace.role,
      school: null,
      campus: null,
      workspaces,
    };
  }

  return {
    profile: { ...accountProfile, role: activeWorkspace.role },
    role: activeWorkspace.role,
    school: activeWorkspace.school,
    campus: activeWorkspace.campus,
    workspaces,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [currentCampus, setCurrentCampus] = useState<Campus | null>(null);
  const [workspaces, setWorkspaces] = useState<SchoolWorkspace[]>([]);
  const selectedWorkspaceRef = useRef<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountSyncStatus, setAccountSyncStatus] = useState<AuthContextType['accountSyncStatus']>('connecting');
  const [accountSyncError, setAccountSyncError] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [pendingAccount, setPendingAccount] = useState<PendingAccount | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const passwordRecoveryRef = useRef(false);
  const [isBellPhoneMode, setBellPhoneMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('phone') || window.location.hash.includes('phone');
  });

  const setAuthenticatedAccount = useCallback((account: PendingAccount) => {
    const selectedWorkspace = account.workspaces.find(
      workspace => `${workspace.school.id}:${workspace.campus.id}` === selectedWorkspaceRef.current,
    ) ?? account.workspaces[0];
    const activeRole = selectedWorkspace?.role ?? account.role;
    const activeSchool = selectedWorkspace?.school ?? account.school;
    const activeCampus = selectedWorkspace?.campus ?? account.campus;
    if (selectedWorkspace) selectedWorkspaceRef.current = `${activeSchool?.id}:${activeCampus?.id}`;
    setUser({ ...account.profile, role: activeRole });
    setRole(activeRole);
    setCurrentSchool(activeSchool);
    setCurrentCampus(activeCampus);
    setWorkspaces(account.workspaces);
    setRequiresPasswordSetup(account.profile.must_change_password);
    setMfaSetup(null);
    setPendingAccount(null);
  }, []);

  const prepareAdminMFA = useCallback(async (account: PendingAccount): Promise<LoginResult> => {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) return { success: false, error: assuranceError.message };
    if (assurance?.currentLevel === 'aal2') {
      setAuthenticatedAccount(account);
      return { success: true };
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) return { success: false, error: factorsError.message };
    const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified');

    setPendingAccount(account);
    if (verifiedFactor) {
      return { success: true, requiresMFA: true };
    }

    const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'BellNexa Super Admin',
    });
    if (enrollmentError) {
      setPendingAccount(null);
      return { success: false, error: enrollmentError.message };
    }

    setMfaSetup({
      factorId: enrollment.id,
      qrCode: enrollment.totp.qr_code,
      secret: enrollment.totp.secret,
    });
    return { success: true, requiresMFASetup: true };
  }, [setAuthenticatedAccount]);

  const loadSession = useCallback(async (session: Session): Promise<void> => {
    const account = await getPendingAccount(session);
    if (account.role === 'super_admin') {
      const result = await prepareAdminMFA(account);
      if (!result.success) {
        throw new Error(result.error || 'Super Admin MFA verification could not be started.');
      }
      return;
    }
    setAuthenticatedAccount(account);
  }, [prepareAdminMFA, setAuthenticatedAccount]);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryRef.current = true;
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setCurrentSchool(null);
        setCurrentCampus(null);
        setWorkspaces([]);
        selectedWorkspaceRef.current = null;
        setCurrentCampus(null);
        setPendingAccount(null);
        setMfaSetup(null);
        setRequiresPasswordSetup(false);
        setInvitations([]);
      }
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('[Auth] Session restore failed:', error.message);
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }
      if (data.session && !passwordRecoveryRef.current) {
        console.log('[Auth] Restoring session from storage');
        try {
          await loadSession(data.session);
          console.log('[Auth] Session restored successfully');
        } catch (restoreError) {
          console.error('[Auth] Session restore error:', restoreError);
          let signOutMessage = '';
          try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            if (signOutError) signOutMessage = signOutError.message;
          } catch (signOutError) {
            signOutMessage = signOutError instanceof Error ? signOutError.message : 'Session sign-out failed.';
          }
          setAuthError(
            restoreError instanceof Error
              ? `${restoreError.message}${signOutMessage ? ` ${signOutMessage}` : ''}`
              : signOutMessage || 'Unable to restore your authenticated session.'
          );
        }
      }
      if (active) setIsLoading(false);
    }).catch((sessionError: unknown) => {
      if (!active) return;
      console.error('[Auth] Failed to check saved session:', sessionError);
      setAuthError(sessionError instanceof Error ? sessionError.message : 'Unable to check the saved Supabase session.');
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const accountUserId = user?.id;
  useEffect(() => {
    if (!accountUserId || !isSupabaseConfigured()) return;

    const userId = accountUserId;
    const schoolId = currentSchool?.id;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let realtimeConnected = false;
    let refreshInProgress = false;
    const refreshAccount = async () => {
      if (!active || refreshInProgress || !navigator.onLine) return;
      refreshInProgress = true;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error('Your authenticated session is no longer available.');
        await loadSession(data.session);
        if (active) {
          setAccountSyncError(null);
          setAccountSyncStatus(realtimeConnected ? 'connected' : 'polling');
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'Unable to refresh account access.';
          const accessWasRevoked = /disabled|does not have an approved school role|assigned school is unavailable|profile is not provisioned/i.test(message);
          if (accessWasRevoked) {
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            setUser(null);
            setRole(null);
            setCurrentSchool(null);
            setCurrentCampus(null);
            setInvitations([]);
            setAuthError(`${message}${signOutError ? ` Sign-out failed: ${signOutError.message}` : ''}`);
          } else {
            setAccountSyncError(message);
          }
          setAccountSyncStatus('error');
        }
      } finally {
        refreshInProgress = false;
      }
    };

    const subscribe = () => {
      if (!active || !navigator.onLine) return;
      setAccountSyncStatus('connecting');
      channel = supabase.channel(`account-access-${userId}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => { void refreshAccount(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'school_memberships', filter: `user_id=eq.${userId}` }, () => { void refreshAccount(); });
      if (schoolId) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'schools', filter: `id=eq.${schoolId}` }, () => { void refreshAccount(); });
      }
      channel.subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
          setAccountSyncStatus('connected');
          void refreshAccount();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeConnected = false;
          setAccountSyncStatus(navigator.onLine ? 'polling' : 'offline');
          setAccountSyncError('Account live updates are unavailable; periodic refresh will continue.');
        }
      });
    };

    const handleOffline = () => {
      realtimeConnected = false;
      setAccountSyncStatus('offline');
      setAccountSyncError('Offline: account access will refresh when connectivity returns.');
    };
    const handleOnline = () => {
      void refreshAccount();
      if (channel) {
        const previousChannel = channel;
        channel = null;
        void supabase.removeChannel(previousChannel).then(subscribe).catch((error: unknown) => {
          if (!active) return;
          setAccountSyncStatus('polling');
          setAccountSyncError(error instanceof Error ? error.message : 'Unable to reconnect account live updates.');
          subscribe();
        });
      } else {
        subscribe();
      }
    };
    const handleFocus = () => { void refreshAccount(); };

    subscribe();
    const pollTimer = window.setInterval(() => {
      if (!realtimeConnected) void refreshAccount();
    }, 60_000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [accountUserId, currentSchool?.id, loadSession]);

  const signIn = async (email: string, password: string): Promise<LoginResult> => {
    if (!isSupabaseConfigured()) {
      console.error('[Auth] Sign-in failed: Supabase is not configured');
      return { success: false, error: 'Supabase is not configured. Set the public project URL and anon key before signing in.' };
    }
    setIsLoading(true);
    setUser(null);
    setRole(null);
    setCurrentSchool(null);
    setPendingAccount(null);
    setMfaSetup(null);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        console.error('[Auth] Sign-in failed:', { code: error.code, message: error.message, email: email.trim().toLowerCase() });
        if (error.code === 'email_not_confirmed') {
          return { success: false, error: 'Confirm your email using the link we sent before signing in.' };
        }
        if (error.code === 'user_banned') {
          return { success: false, error: 'Your BellNexa account is disabled. Contact your school administrator or BellNexa support.' };
        }
        return { success: false, error: error.message };
      }
      if (!data.session) {
        console.error('[Auth] Sign-in failed: No session created by Supabase');
        return { success: false, error: 'Supabase did not create an authenticated session.' };
      }

      const account = await getPendingAccount(data.session);
      console.log('[Auth] Account loaded:', { role: account.role, userId: account.profile.id, email: account.profile.email });
      if (account.role === 'super_admin') {
        const result = await prepareAdminMFA(account);
        if (!result.success) {
          console.error('[Auth] MFA setup failed for super_admin:', result.error);
          try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            if (signOutError) result.error = `${result.error || 'MFA setup failed.'} ${signOutError.message}`;
          } catch (signOutError) {
            result.error = `${result.error || 'MFA setup failed.'} ${signOutError instanceof Error ? signOutError.message : 'Session sign-out failed.'}`;
          }
        } else {
          console.log('[Auth] MFA flow initiated:', { requiresMFA: result.requiresMFA, requiresMFASetup: result.requiresMFASetup });
        }
        return result;
      }

      setAuthenticatedAccount(account);
      console.log('[Auth] Sign-in successful:', { role: account.role, userId: account.profile.id });
      return { success: true };
    } catch (error) {
      console.error('[Auth] Sign-in error during account load:', error);
      let signOutMessage = '';
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) signOutMessage = signOutError.message;
      } catch (signOutError) {
        signOutMessage = signOutError instanceof Error ? signOutError.message : 'Session sign-out failed.';
      }
      return {
        success: false,
        error: `${error instanceof Error ? error.message : 'Unable to load your authorized account.'}${signOutMessage ? ` ${signOutMessage}` : ''}`,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const completeMFA = async (code: string): Promise<LoginResult> => {
    if (!pendingAccount) {
      console.error('[Auth] MFA completion failed: No pending account');
      return { success: false, error: 'Your sign-in step expired. Please sign in again.' };
    }
    if (!/^\d{6}$/.test(code)) return { success: false, error: 'Enter the current 6-digit authenticator code.' };

    setIsLoading(true);
    try {
      const factorId = mfaSetup?.factorId;
      if (factorId) {
        console.log('[Auth] Verifying MFA setup with code');
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) {
          console.error('[Auth] MFA setup verification failed:', error.message);
          return { success: false, error: error.message };
        }
        setAuthenticatedAccount(pendingAccount);
        console.log('[Auth] MFA setup completed successfully');
        return { success: true };
      }

      console.log('[Auth] Verifying MFA code with existing factor');
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        console.error('[Auth] Failed to list MFA factors:', factorsError.message);
        return { success: false, error: factorsError.message };
      }
      const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified');
      if (!verifiedFactor) {
        console.error('[Auth] No verified MFA factor found');
        return { success: false, error: 'No verified authenticator is available. Sign in again to set one up.' };
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactor.id,
        code,
      });
      if (error) {
        console.error('[Auth] MFA verification failed:', error.message);
        return { success: false, error: error.message };
      }
      setAuthenticatedAccount(pendingAccount);
      console.log('[Auth] MFA verification successful');
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPendingSignIn = async (): Promise<void> => {
    const setupFactorId = mfaSetup?.factorId;
    setPendingAccount(null);
    setMfaSetup(null);
    let cleanupMessage = '';
    if (setupFactorId) {
      try {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: setupFactorId });
        if (error) cleanupMessage = error.message;
      } catch (error) {
        cleanupMessage = error instanceof Error ? error.message : 'Unable to remove the incomplete authenticator.';
      }
    }
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) cleanupMessage = [cleanupMessage, error.message].filter(Boolean).join(' ');
    } catch (error) {
      cleanupMessage = [cleanupMessage, error instanceof Error ? error.message : 'Unable to end the sign-in session.'].filter(Boolean).join(' ');
    }
    if (cleanupMessage) throw new Error(cleanupMessage);
  };

  const sendPasswordReset = async (email: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    return error ? { error: error.message } : {};
  };

  const updatePassword = async (password: string, invitationToken?: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    if (requiresPasswordSetup) {
      if (!invitationToken || !/^[0-9a-f]{64}$/i.test(invitationToken)) {
        return { error: 'Enter the 64-character invitation token from your invitation email.' };
      }
      const { error: setupError } = await supabase.functions.invoke('manage-invitations', {
        body: { action: 'complete-setup', invitationToken },
      });
      if (setupError) return { error: await functionErrorMessage(setupError) };
      setRequiresPasswordSetup(false);
    }
    passwordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) return { error: `Password changed, but sign-out failed: ${signOutError.message}` };
    return {};
  };

  const updateProfile = async (
    updates: Pick<Profile, 'full_name' | 'phone' | 'preferred_timezone'>,
  ): Promise<void> => {
    if (!user) throw new Error('Sign in before changing your profile.');
    const fullName = updates.full_name.trim();
    if (!fullName) throw new Error('Name cannot be empty.');
    const phone = updates.phone?.trim() || null;
    const preferredTimezone = updates.preferred_timezone?.trim() || null;
    if (preferredTimezone && !isValidIanaTimeZone(preferredTimezone)) {
      throw new Error('Enter a valid IANA time zone, such as Europe/London.');
    }
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, preferred_timezone: preferredTimezone })
      .eq('id', user.id)
      .select('id, email, full_name, phone, preferred_timezone, is_super_admin, is_active, must_change_password, created_at, updated_at')
      .single();
    if (error) throw error;
    setUser({ ...data, role: role ?? user.role, requires_2fa: data.is_super_admin });
  };

  const switchWorkspace = useCallback((schoolId: string, campusId: string): void => {
    const workspace = workspaces.find(item =>
      item.school.id === schoolId && item.campus.id === campusId,
    );
    if (!workspace) throw new Error('You do not have access to that school campus.');
    selectedWorkspaceRef.current = `${schoolId}:${campusId}`;
    setCurrentSchool(workspace.school);
    setCurrentCampus(workspace.campus);
    setRole(workspace.role);
    setUser(current => current ? { ...current, role: workspace.role } : current);
  }, [workspaces]);

  const refreshInvitations = useCallback(async (): Promise<void> => {
    if (!user || !['super_admin', 'admin', 'principal'].includes(role ?? '')) {
      setInvitations([]);
      return;
    }
    const { data, error } = await supabase
      .from('invitations')
      .select('id, reference, school_id, campus_id, email, role, expires_at, is_used, revoked_at, created_by, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setInvitations((data ?? []).map((invitation) => ({
      ...invitation,
      invited_by: invitation.created_by,
    })));
  }, [role, user]);

  const createInvitation = useCallback(async (
    email: string,
    fullName: string,
    invitationRole: Exclude<UserRole, 'super_admin'>,
    schoolId: string,
    campusId: string,
  ): Promise<Invitation> => {
    const { data, error } = await supabase.functions.invoke('manage-invitations', {
      body: { action: 'invite', email, fullName, role: invitationRole, schoolId, campusId },
    });
    if (error) throw new Error(await functionErrorMessage(error));
    if (!data?.invitation) throw new Error('The invitation service returned no invitation record.');
    await refreshInvitations();
    return {
      ...data.invitation,
      invited_by: user?.id ?? '',
    } satisfies Invitation;
  }, [refreshInvitations, user?.id]);

  const revokeInvitation = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.functions.invoke('manage-invitations', {
      body: { action: 'revoke', invitationId: id },
    });
    if (error) throw new Error(await functionErrorMessage(error));
    await refreshInvitations();
  }, [refreshInvitations]);

  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentSchool,
        currentCampus,
        workspaces,
        role,
        isAuthenticated: !!user,
        isLoading,
        authError,
        accountSyncStatus: user ? accountSyncStatus : 'connecting',
        accountSyncError: user ? accountSyncError : null,
        isBellPhoneMode,
        mfaSetup,
        requiresMFA: Boolean(pendingAccount && !mfaSetup),
        requiresMFASetup: Boolean(pendingAccount && mfaSetup),
        isPasswordRecovery,
        requiresPasswordSetup,
        invitations,
        setBellPhoneMode,
        signIn,
        completeMFA,
        cancelPendingSignIn,
        sendPasswordReset,
        updatePassword,
        updateProfile,
        refreshInvitations,
        createInvitation,
        revokeInvitation,
        logout,
        setCurrentSchool,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
