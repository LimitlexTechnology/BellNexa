import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, School, UserRole } from '../types/database';

interface AuthVerificationResult {
  success: boolean;
  role?: UserRole;
  requires2FA?: boolean;
  userProfile?: Profile;
  error?: string;
}

interface AuthContextType {
  user: Profile | null;
  currentSchool: School | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBellPhoneMode: boolean;
  setBellPhoneMode: (active: boolean) => void;

  // Single unified login workflow (No role dropdown)
  verifyCredentials: (email: string, password: string) => AuthVerificationResult;
  completeLogin: (email: string, authCode?: string) => { success: boolean; error?: string };
  activateInviteAccount: (token: string, password: string, fullName?: string) => { success: boolean; role?: UserRole; error?: string };

  // Explicit role switchers for pilot evaluation convenience
  loginAsSuperAdmin: () => void;
  loginAsPrincipal: () => void;
  loginAsRegulator: () => void;
  updateProfile: (updates: Pick<Profile, 'full_name' | 'phone'>) => void;
  logout: () => void;
  setCurrentSchool: (school: School | null) => void;
}

// Vilac School Context
export const MOCK_VILAC_SCHOOL: School = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Vilac International School',
  code: 'VILAC-ACCRA',
  timezone: 'Africa/Accra',
  branding_primary: '#00563F', // Forest Green
  branding_secondary: '#F4511E', // Orange
  branding_accent: '#E6AD00', // Gold
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Registered User Directory (Server decides role based on authenticated account)
export const REGISTERED_ACCOUNTS: Record<string, Profile> = {
  'founder@bellnexa.com': {
    id: '00000000-0000-0000-0000-000000000999',
    email: 'founder@bellnexa.com',
    full_name: 'Kobby (Founder & Super Admin)',
    is_super_admin: true,
    role: 'super_admin',
    requires_2fa: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  'principal@vilac.edu.gh': {
    id: '00000000-0000-0000-0000-000000000888',
    email: 'principal@vilac.edu.gh',
    full_name: 'Dr. Kwesi Mensah (Principal)',
    is_super_admin: false,
    role: 'principal',
    requires_2fa: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  'regulator@vilac.edu.gh': {
    id: '00000000-0000-0000-0000-000000000777',
    email: 'regulator@vilac.edu.gh',
    full_name: 'Mr. Emmanuel Osei (Schedule Regulator)',
    is_super_admin: false,
    role: 'regulator',
    requires_2fa: false, // Optional for regulator
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getSavedProfile = (profile: Profile): Profile => {
  if (typeof window === 'undefined') return profile;
  try {
    const saved = JSON.parse(window.localStorage.getItem(`bellnexa-profile-${profile.id}`) || '{}');
    return {
      ...profile,
      ...(typeof saved.full_name === 'string' ? { full_name: saved.full_name } : {}),
      ...(typeof saved.phone === 'string' ? { phone: saved.phone } : {}),
    };
  } catch {
    return profile;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Start logged OUT so first page is the sign-in screen
  const [user, setUser] = useState<Profile | null>(null);
  const [currentSchool, setCurrentSchool] = useState<School | null>(MOCK_VILAC_SCHOOL);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBellPhoneMode, setBellPhoneMode] = useState<boolean>(() => {
    // Check if query param or hash explicitly requests the dedicated bell phone kiosk
    if (typeof window !== 'undefined') {
      return window.location.search.includes('phone') || window.location.hash.includes('phone');
    }
    return false;
  });

  // Step 1: Server verifies credentials and determines the role without a client dropdown
  const verifyCredentials = (email: string, password: string): AuthVerificationResult => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check known registered accounts
    if (REGISTERED_ACCOUNTS[cleanEmail]) {
      const profile = REGISTERED_ACCOUNTS[cleanEmail];
      return {
        success: true,
        role: profile.role,
        requires2FA: profile.requires_2fa,
        userProfile: profile,
      };
    }

    // Role detection heuristics for flexible demo inputs
    if (cleanEmail.includes('founder') || cleanEmail.includes('super') || cleanEmail.includes('kobby')) {
      return {
        success: true,
        role: 'super_admin',
        requires2FA: true,
        userProfile: REGISTERED_ACCOUNTS['founder@bellnexa.com'],
      };
    }

    if (cleanEmail.includes('principal') || cleanEmail.includes('headmaster')) {
      return {
        success: true,
        role: 'principal',
        requires2FA: true,
        userProfile: REGISTERED_ACCOUNTS['principal@vilac.edu.gh'],
      };
    }

    if (cleanEmail.includes('regulator') || cleanEmail.includes('schedule') || cleanEmail.includes('timetable')) {
      return {
        success: true,
        role: 'regulator',
        requires2FA: false,
        userProfile: REGISTERED_ACCOUNTS['regulator@vilac.edu.gh'],
      };
    }

    // For other school emails, default to regulator
    if (cleanEmail.endsWith('@vilac.edu.gh')) {
      return {
        success: true,
        role: 'regulator',
        requires2FA: false,
        userProfile: {
          id: `usr-${Date.now()}`,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0].toUpperCase() + ' (Staff)',
          is_super_admin: false,
          role: 'regulator',
          requires_2fa: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      };
    }

    return {
      success: false,
      error: 'Unrecognized institutional account. Accounts are provisioned by invitation only.'
    };
  };

  // Step 2: Complete login after password and 2FA check
  const completeLogin = (email: string, authCode?: string): { success: boolean; error?: string } => {
    const verification = verifyCredentials(email, 'authenticated');
    if (!verification.success || !verification.userProfile) {
      return { success: false, error: verification.error || 'Authentication failed' };
    }

    // Validate 2FA if required (Super Admin & Principal)
    if (verification.requires2FA) {
      if (!authCode || authCode.trim().length !== 6) {
        return { success: false, error: 'A 6-digit authenticator code is required for institutional oversight.' };
      }
    }

    setUser(getSavedProfile(verification.userProfile));
    setRole(verification.role || 'regulator');
    setCurrentSchool(MOCK_VILAC_SCHOOL);
    return { success: true };
  };

  // Accept single-use invitation
  const activateInviteAccount = (token: string, password: string, fullName?: string): { success: boolean; role?: UserRole; error?: string } => {
    const cleanToken = token.trim().toUpperCase();
    if (cleanToken.includes('PRIN')) {
      const principalProfile: Profile = {
        id: `usr-${Date.now()}`,
        email: 'principal@vilac.edu.gh',
        full_name: fullName || 'Dr. Kwesi Mensah (Principal)',
        is_super_admin: false,
        role: 'principal',
        requires_2fa: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUser(getSavedProfile(principalProfile));
      setRole('principal');
      setCurrentSchool(MOCK_VILAC_SCHOOL);
      return { success: true, role: 'principal' };
    }

    if (cleanToken.includes('REG') || cleanToken.includes('VILAC')) {
      const regulatorProfile: Profile = {
        id: `usr-${Date.now()}`,
        email: 'regulator@vilac.edu.gh',
        full_name: fullName || 'Mr. Emmanuel Osei (Schedule Regulator)',
        is_super_admin: false,
        role: 'regulator',
        requires_2fa: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUser(getSavedProfile(regulatorProfile));
      setRole('regulator');
      setCurrentSchool(MOCK_VILAC_SCHOOL);
      return { success: true, role: 'regulator' };
    }

    return {
      success: false,
      error: 'Invalid or expired invitation token. Please request a new invite from the Super Admin.'
    };
  };

  const loginAsSuperAdmin = () => {
    setUser(getSavedProfile(REGISTERED_ACCOUNTS['founder@bellnexa.com']));
    setCurrentSchool(MOCK_VILAC_SCHOOL);
    setRole('super_admin');
  };

  const loginAsPrincipal = () => {
    setUser(getSavedProfile(REGISTERED_ACCOUNTS['principal@vilac.edu.gh']));
    setCurrentSchool(MOCK_VILAC_SCHOOL);
    setRole('principal');
  };

  const loginAsRegulator = () => {
    setUser(getSavedProfile(REGISTERED_ACCOUNTS['regulator@vilac.edu.gh']));
    setCurrentSchool(MOCK_VILAC_SCHOOL);
    setRole('regulator');
  };

  const logout = () => {
    setUser(null);
    setRole(null);
  };

  const updateProfile = (updates: Pick<Profile, 'full_name' | 'phone'>) => {
    if (!user) return;
    const updatedProfile = {
      ...user,
      full_name: updates.full_name.trim(),
      phone: updates.phone?.trim() || undefined,
      updated_at: new Date().toISOString(),
    };
    setUser(updatedProfile);
    try {
      window.localStorage.setItem(`bellnexa-profile-${user.id}`, JSON.stringify({
        full_name: updatedProfile.full_name,
        phone: updatedProfile.phone,
      }));
    } catch {
      // Keep the in-memory update when browser storage is unavailable.
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentSchool,
        role,
        isAuthenticated: !!user,
        isLoading,
        isBellPhoneMode,
        setBellPhoneMode,
        verifyCredentials,
        completeLogin,
        activateInviteAccount,
        loginAsSuperAdmin,
        loginAsPrincipal,
        loginAsRegulator,
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
