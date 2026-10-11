import React, { useState } from 'react';
import { 
  Bell, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  Key, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth, REGISTERED_ACCOUNTS } from '../context/AuthContext';
import { VilacEmblem } from '../components/VilacEmblem';
import { UserRole } from '../types/database';

export const Login: React.FC = () => {
  const { verifyCredentials, completeLogin, activateInviteAccount } = useAuth();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authCode, setAuthCode] = useState('');

  // Two-Step Authentication State
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [detectedRole, setDetectedRole] = useState<UserRole | null>(null);
  const [requires2FA, setRequires2FA] = useState<boolean>(true);

  // Modals & Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Invitation Form State
  const [inviteToken, setInviteToken] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your institutional email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Verify credentials through server logic (No dropdown on form!)
    const result = verifyCredentials(email, password);

    if (!result.success) {
      setErrorMessage(result.error || 'Invalid email or password.');
      return;
    }

    setDetectedRole(result.role || 'regulator');
    setRequires2FA(result.requires2FA ?? (result.role !== 'regulator'));
    setCurrentStep(2);
  };

  // Step 2: Complete Login with 2FA
  const handleAuthCodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // If 2FA is required, check length
    if (requires2FA && authCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit authenticator code.');
      return;
    }

    const res = completeLogin(email, authCode);
    if (!res.success) {
      setErrorMessage(res.error || 'Authentication code failed.');
    }
  };

  // Step 2 for Regulator: Skip optional 2FA
  const handleSkipRegulator2FA = () => {
    setErrorMessage(null);
    const res = completeLogin(email, '');
    if (!res.success) {
      setErrorMessage(res.error || 'Login could not be completed.');
    }
  };

  // Submit Account Activation
  const handleActivateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!inviteToken.trim()) {
      setErrorMessage('Please enter your invitation token.');
      return;
    }

    if (!invitePassword || invitePassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    const res = activateInviteAccount(inviteToken, invitePassword, inviteFullName);
    if (!res.success) {
      setErrorMessage(res.error || 'Activation token could not be verified.');
    } else {
      setInviteSuccessMsg('Account activated successfully! Redirecting...');
      setTimeout(() => {
        setIsInviteModalOpen(false);
      }, 800);
    }
  };

  // Quick fill helper for evaluator
  const fillCredentials = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword('VilacSecure2026!');
    setErrorMessage(null);
    setCurrentStep(1);
    setAuthCode('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* LAPTOP SPLIT-SCREEN CONTAINER */}
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 w-full flex-1">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN (LAPTOP ONLY: SOLID FOREST GREEN & WATERMARK) */}
        {/* ========================================================= */}
        <div className="hidden lg:flex flex-col justify-between bg-[#00563F] text-white p-12 relative overflow-hidden select-none">
          {/* Soft Bell Watermark Silhouette */}
          <div className="absolute -bottom-16 -right-16 opacity-10 pointer-events-none">
            <svg 
              className="w-[520px] h-[520px] text-white fill-current" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2C7.58 2 4 5.58 4 10v6l-2 2v1h20v-1l-2-2v-6c0-4.42-3.58-8-8-8zm0 20c1.66 0 3-1.34 3-3h-6c0 1.66 1.34 3 3 3z" />
            </svg>
          </div>

          {/* Top Institutional Crest Header */}
          <div className="flex items-center space-x-4 z-10">
            <VilacEmblem size="md" />
            <div>
              <h2 className="text-xl font-extrabold tracking-wide text-white uppercase">
                Vilac International School
              </h2>
              <div className="h-[2px] bg-[#E6AD00] w-48 mt-1" />
              <p className="text-xs text-emerald-100 mt-1 font-medium tracking-wider">
                Excellence &bull; Leadership &bull; Integrity
              </p>
            </div>
          </div>

          {/* Center Brand Statement */}
          <div className="max-w-md z-10 space-y-4 my-auto py-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-950/40 border border-emerald-700/60 rounded-md text-xs font-semibold text-[#E6AD00]">
              <ShieldCheck className="w-4 h-4 text-[#E6AD00]" />
              <span>Strict Role-Based System Access</span>
            </div>
            
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Institutional Bell & Announcement Automation
            </h1>

            <p className="text-sm text-emerald-100/90 leading-relaxed font-normal">
              High-availability schedule distribution and automated bell triggers. All roles authenticate securely through centralized verification.
            </p>

            <div className="pt-4 border-t border-emerald-700/50 space-y-2 text-xs text-emerald-100/80">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E6AD00]" />
                <span>Super Admin: Global infrastructure oversight & invites</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E6AD00]" />
                <span>Principal: Timetable review, approvals & emergency halt</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#E6AD00]" />
                <span>Schedule Regulator: Timetable drafting & audio staging</span>
              </div>
            </div>
          </div>

          {/* Left Footer Note */}
          <div className="z-10 text-xs text-emerald-200/80 font-mono flex items-center justify-between border-t border-emerald-800/80 pt-4">
            <span>BellNexa Automation Core</span>
            <span>Accra, Ghana</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (OR FULL SCREEN ON PHONE): SIGN-IN EXPERIENCE */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between bg-slate-50 lg:bg-white min-h-screen">
          
          {/* PHONE ONLY: FOREST-GREEN HEADER WITH VILAC EMBLEM */}
          <header className="lg:hidden bg-[#00563F] text-white p-6 text-center select-none shadow-md">
            <div className="flex flex-col items-center justify-center space-y-2">
              <VilacEmblem size="lg" className="mx-auto" />
              <h1 className="text-xl font-bold tracking-tight text-white uppercase mt-1">
                Vilac International School
              </h1>
              <div className="h-[2px] bg-[#E6AD00] w-36 mx-auto mt-0.5" />
            </div>
          </header>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-10 w-full max-w-md mx-auto">
            
            {/* Product Identity */}
            <div className="text-center mb-6 w-full">
              <div className="inline-flex items-center justify-center p-2 rounded-lg bg-orange-100 text-[#F4511E] mb-2">
                <Bell className="w-5 h-5 text-[#F4511E]" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                BellNexa
              </h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                School Bell & Announcement Automation
              </p>
            </div>

            {/* ERROR BANNER */}
            {errorMessage && (
              <div className="w-full mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* WHITE CARD WITH ROUNDED CORNERS */}
            <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-300 p-6 sm:p-8">
              
              {/* STEP 1: EMAIL & PASSWORD (NO ROLE DROPDOWN) */}
              {currentStep === 1 && (
                <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div>
                    <label 
                      htmlFor="signin-email" 
                      className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        id="signin-email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. principal@vilac.edu.gh"
                        className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00563F] focus:ring-1 focus:ring-[#00563F] transition min-h-[48px]"
                      />
                    </div>
                  </div>

                  {/* Password Field with Show/Hide Eye */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label 
                        htmlFor="signin-password" 
                        className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordOpen(true)}
                        className="text-xs font-bold text-[#00563F] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00563F] focus:ring-1 focus:ring-[#00563F] transition min-h-[48px]"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-800 transition min-w-[44px] justify-center"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Large Orange Sign in Button */}
                  <button
                    type="submit"
                    className="w-full bg-[#F4511E] hover:bg-[#D84315] active:bg-[#BF360C] text-white font-extrabold py-3.5 px-6 rounded-xl text-base shadow-sm hover:shadow transition duration-150 min-h-[50px] flex items-center justify-center"
                  >
                    Sign in
                  </button>
                </form>
              )}

              {/* STEP 2: 6-DIGIT AUTHENTICATOR CODE */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(1);
                        setErrorMessage(null);
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-500 truncate max-w-[180px]">
                      {email}
                    </span>
                  </div>

                  <div className="text-left space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Step 2: Authenticator Verification
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {requires2FA ? (
                        <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                          Required for Super Admin and Principal roles.
                        </span>
                      ) : (
                        <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                          Optional for Schedule Regulator.
                        </span>
                      )}
                    </p>
                  </div>

                  <form onSubmit={handleAuthCodeSubmit} className="space-y-4">
                    <div>
                      <label 
                        htmlFor="authenticator-code" 
                        className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2"
                      >
                        6-Digit Authenticator Code
                      </label>
                      <input
                        id="authenticator-code"
                        type="text"
                        maxLength={6}
                        autoFocus
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full text-center tracking-[0.5em] text-2xl font-mono font-extrabold py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#00563F] focus:ring-1 focus:ring-[#00563F] transition min-h-[48px]"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-slate-500">
                          Demo OTP: <code className="font-bold text-slate-700">123456</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAuthCode('123456')}
                          className="text-[11px] font-bold text-[#00563F] hover:underline"
                        >
                          Auto-fill Demo Code
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        type="submit"
                        className="w-full bg-[#F4511E] hover:bg-[#D84315] active:bg-[#BF360C] text-white font-extrabold py-3.5 px-6 rounded-xl text-sm shadow-sm transition min-h-[48px] flex items-center justify-center"
                      >
                        Verify & Sign in
                      </button>

                      {/* If regulator, allow skipping 2FA */}
                      {!requires2FA && (
                        <button
                          type="button"
                          onClick={handleSkipRegulator2FA}
                          className="w-full py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition"
                        >
                          Continue without code (Regulator)
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

            </div>

            {/* BELOW THE CARD: INVITATION NOTICE (NO PUBLIC SIGN-UP) */}
            <div className="mt-6 text-center text-xs text-slate-600 max-w-sm">
              <p>
                Accounts are created by invitation only. Have an invitation?{' '}
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="font-extrabold text-[#00563F] hover:underline"
                >
                  Activate your account
                </button>
                .
              </p>
            </div>

            {/* PILOT DEMO QUICK-FILL HELPER (NO DROPDOWN ON FORM - STRICT CONVENIENCE BAR) */}
            <div className="mt-6 pt-4 border-t border-slate-200 w-full text-center">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-2">
                Fast-Test Pilot Accounts (Single Unified Sign-in)
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fillCredentials('founder@bellnexa.com')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px] font-bold text-slate-800 transition"
                >
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('principal@vilac.edu.gh')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold text-[#00563F] transition"
                >
                  Principal
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials('regulator@vilac.edu.gh')}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-300 text-[11px] font-bold text-[#F4511E] transition"
                >
                  Schedule Regulator
                </button>
              </div>
            </div>

          </main>

          {/* FOOTER */}
          <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 lg:border-none">
            Powered by BellNexa.
          </footer>

        </div>
      </div>

      {/* ========================================================= */}
      {/* INVITATION ACTIVATION MODAL */}
      {/* ========================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-300 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-[#00563F]" />
                <h3 className="text-base font-bold text-slate-900">Activate Account</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setErrorMessage(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If your school or the Super Admin has issued you an invitation token, activate your account below.
            </p>

            {inviteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{inviteSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleActivateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Invitation Token
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-VILAC-PRIN-88219"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 font-mono text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#00563F]"
                />
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setInviteToken('INV-VILAC-PRIN-88219')}
                    className="text-[10px] text-[#00563F] hover:underline"
                  >
                    Use Sample Principal Token
                  </button>
                  <span className="text-[10px] text-slate-400">&bull;</span>
                  <button
                    type="button"
                    onClick={() => setInviteToken('INV-VILAC-REG-99412')}
                    className="text-[10px] text-[#00563F] hover:underline"
                  >
                    Use Sample Regulator Token
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kwesi Mensah"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#00563F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Create Institutional Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#00563F]"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#00563F] hover:bg-emerald-900 rounded-xl transition"
                >
                  Activate & Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FORGOT PASSWORD MODAL */}
      {/* ========================================================= */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-300 space-y-4">
            <div className="flex items-center space-x-2 text-[#00563F]">
              <HelpCircle className="w-5 h-5 text-[#00563F]" />
              <h3 className="text-base font-bold text-slate-900">Institutional Password Reset</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              To maintain system integrity and prevent unauthorized schedule disruption, self-service password reset is disabled.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">Contact Super Administrator:</p>
              <p className="font-mono text-emerald-800">founder@bellnexa.com</p>
              <p className="text-[11px] text-slate-500">Or contact your school IT office in Accra.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#00563F] hover:bg-emerald-900 rounded-xl transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
