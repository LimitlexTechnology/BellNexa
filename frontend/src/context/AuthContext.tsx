import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, School, UserRole } from '../types/database';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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
}

interface AuthContextType {
  user: Profile | null;
  currentSchool: School | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  isBellPhoneMode: boolean;
  mfaSetup: MfaSetup | null;
  isPasswordRecovery: boolean;
  setBellPhoneMode: (active: boolean) => void;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  completeMFA: (code: string) => Promise<LoginResult>;
  cancelPendingSignIn: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  updateProfile: (updates: Pick<Profile, 'full_name' | 'phone'>) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentSchool: (school: School | null) => void;
}

export const MOCK_VILAC_SCHOOL: School = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Vilac International School',
  code: 'VILAC-ACCRA',
  timezone: 'Africa/Accra',
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

const getPendingAccount = async (session: Session): Promise<PendingAccount> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, is_super_admin, created_at, updated_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new Error('Your account profile is not provisioned. Contact the BellNexa administrator.');
  }

  const accountProfile: Profile = {
    ...profile,
    role: profile.is_super_admin ? 'super_admin' : undefined,
    requires_2fa: profile.is_super_admin,
  };

  if (profile.is_super_admin) {
    return { profile: accountProfile, role: 'super_admin', school: null };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('school_memberships')
    .select('school_id, role')
    .eq('user_id', session.user.id)
    .eq('is_approved', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (membershipsError) throw membershipsError;
  const membership = memberships?.[0];
  const role = membership ? roleFromMembership(membership.role) : null;
  if (!membership || !role) {
    throw new Error('Your account does not have an approved school role. Contact your school administrator.');
  }

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, code, timezone, logo_url, branding_primary, branding_secondary, branding_accent, is_active, created_at, updated_at')
    .eq('id', membership.school_id)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school || !school.is_active) {
    throw new Error('Your assigned school is unavailable. Contact your school administrator.');
  }

  return {
    profile: { ...accountProfile, role },
    role,
    school,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [pendingAccount, setPendingAccount] = useState<PendingAccount | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const passwordRecoveryRef = useRef(false);
  const [isBellPhoneMode, setBellPhoneMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('phone') || window.location.hash.includes('phone');
  });

  const setAuthenticatedAccount = useCallback((account: PendingAccount) => {
    setUser(account.profile);
    setRole(account.role);
    setCurrentSchool(account.school);
    setMfaSetup(null);
    setPendingAccount(null);
  }, []);

  const prepareAdminMFA = async (account: PendingAccount): Promise<LoginResult> => {
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
  };

  const loadSession = useCallback(async (session: Session): Promise<void> => {
    const account = await getPendingAccount(session);
    if (account.role === 'super_admin') {
      const { data: assurance, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (assurance.currentLevel !== 'aal2') {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        return;
      }
    }
    setAuthenticatedAccount(account);
  }, [setAuthenticatedAccount]);

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
        setPendingAccount(null);
        setMfaSetup(null);
      }
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }
      if (data.session && !passwordRecoveryRef.current) {
        try {
          await loadSession(data.session);
        } catch (restoreError) {
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
      setAuthError(sessionError instanceof Error ? sessionError.message : 'Unable to check the saved Supabase session.');
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const signIn = async (email: string, password: string): Promise<LoginResult> => {
    if (!isSupabaseConfigured()) {
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
      if (error) return { success: false, error: error.message };
      if (!data.session) return { success: false, error: 'Supabase did not create an authenticated session.' };

      const account = await getPendingAccount(data.session);
      if (account.role === 'super_admin') {
        const result = await prepareAdminMFA(account);
        if (!result.success) {
          try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            if (signOutError) result.error = `${result.error || 'MFA setup failed.'} ${signOutError.message}`;
          } catch (signOutError) {
            result.error = `${result.error || 'MFA setup failed.'} ${signOutError instanceof Error ? signOutError.message : 'Session sign-out failed.'}`;
          }
        }
        return result;
      }

      setAuthenticatedAccount(account);
      return { success: true };
    } catch (error) {
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
    if (!pendingAccount) return { success: false, error: 'Your sign-in step expired. Please sign in again.' };
    if (!/^\d{6}$/.test(code)) return { success: false, error: 'Enter the current 6-digit authenticator code.' };

    setIsLoading(true);
    try {
      const factorId = mfaSetup?.factorId;
      if (factorId) {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) return { success: false, error: error.message };
        setAuthenticatedAccount(pendingAccount);
        return { success: true };
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) return { success: false, error: factorsError.message };
      const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified');
      if (!verifiedFactor) {
        return { success: false, error: 'No verified authenticator is available. Sign in again to set one up.' };
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactor.id,
        code,
      });
      if (error) return { success: false, error: error.message };
      setAuthenticatedAccount(pendingAccount);
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

  const updatePassword = async (password: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    passwordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) return { error: `Password changed, but sign-out failed: ${signOutError.message}` };
    return {};
  };

  const updateProfile = async (updates: Pick<Profile, 'full_name' | 'phone'>): Promise<void> => {
    if (!user) throw new Error('Sign in before changing your profile.');
    const fullName = updates.full_name.trim();
    if (!fullName) throw new Error('Name cannot be empty.');
    const phone = updates.phone?.trim() || null;
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', user.id)
      .select('id, email, full_name, phone, is_super_admin, created_at, updated_at')
      .single();
    if (error) throw error;
    setUser({ ...data, role: role ?? user.role, requires_2fa: data.is_super_admin });
  };

  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentSchool,
        role,
        isAuthenticated: !!user,
        isLoading,
        authError,
        isBellPhoneMode,
        mfaSetup,
        isPasswordRecovery,
        setBellPhoneMode,
        signIn,
        completeMFA,
        cancelPendingSignIn,
        sendPasswordReset,
        updatePassword,
        updateProfile,
        logout,
        setCurrentSchool,
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
