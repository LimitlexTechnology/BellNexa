import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BellNexaLogo } from '../components/BellNexaLogo';

type LoginStep = 'credentials' | 'mfa' | 'setup-mfa' | 'recovery' | 'new-password';

export const Login: React.FC = () => {
  const {
    signIn,
    completeMFA,
    cancelPendingSignIn,
    sendPasswordReset,
    updatePassword,
    mfaSetup,
    requiresMFA,
    requiresMFASetup,
    isPasswordRecovery,
    requiresPasswordSetup,
    isLoading,
    authError,
  } = useAuth();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error_code') ?? params.get('error');
    return code === 'otp_expired' || code === 'access_denied'
      ? 'This email link is invalid or expired. Request a new password reset or ask your administrator to resend the invitation.'
      : null;
  });
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const visibleStep = requiresPasswordSetup || isPasswordRecovery
    ? 'new-password'
    : requiresMFASetup
      ? 'setup-mfa'
      : requiresMFA
        ? 'mfa'
        : step;

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const result = await signIn(email, password);
    if (!result.success) {
      setErrorMessage(result.error || 'Sign-in failed.');
      return;
    }
    if (result.requiresMFASetup) setStep('setup-mfa');
    else if (result.requiresMFA) setStep('mfa');
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      const result = await completeMFA(authCode);
      if (!result.success) {
        setErrorMessage(result.error || 'Authenticator verification failed.');
        return;
      }
      setAuthCode('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authenticator verification failed.');
    }
  };

  const handleCancelPendingSignIn = async () => {
    setErrorMessage(null);
    try {
      await cancelPendingSignIn();
      setAuthCode('');
      setStep('credentials');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to cancel sign-in.');
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const result = await sendPasswordReset(email);
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }
      setInfoMessage('If an account exists for that email, a password recovery link has been sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to request password recovery.');
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      const result = await updatePassword(newPassword, requiresPasswordSetup ? invitationToken.trim() : undefined);
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }
      setNewPassword('');
      setInvitationToken('');
      setPassword('');
      setStep('credentials');
      setInfoMessage('Password updated. Sign in again with your new password.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update the password.');
    }
  };

  const openRecovery = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setStep('recovery');
  };

  const goBackToCredentials = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setStep('credentials');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 w-full flex-1">
        <section className="hidden lg:flex flex-col justify-between bg-[#0A1B45] text-white p-12 relative overflow-hidden">
          <div className="absolute -bottom-16 -right-16 opacity-10 pointer-events-none">
            <svg className="w-[520px] h-[520px] text-white fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C7.58 2 4 5.58 4 10v6l-2 2v1h20v-1l-2-2v-6c0-4.42-3.58-8-8-8zm0 20c1.66 0 3-1.34 3-3h-6c0 1.66 1.34 3 3 3z" />
            </svg>
          </div>

          <div className="flex items-center space-x-4 z-10">
            <BellNexaLogo className="w-16 h-16 rounded-2xl" />
            <div>
              <h2 className="text-xl font-extrabold tracking-wide text-white">BellNexa</h2>
              <div className="h-[2px] bg-[#12C8E8] w-48 mt-1" />
              <p className="text-xs text-sky-100 mt-1 font-medium tracking-wider">
                Smart School Bell &amp; Announcement Management
              </p>
            </div>
          </div>

          <div className="max-w-md z-10 space-y-4 my-auto py-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#102A5C] border border-sky-700/60 rounded-md text-xs font-semibold text-[#54DDF4]">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure, authorised access</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Smart School Bell and Announcement Management
            </h1>
            <p className="text-sm text-sky-100/90 leading-relaxed">
              BellNexa helps schools manage daily bells, lesson transitions, assemblies, breaks, worship sessions,
              lunch periods, closing times, and voice announcements through a central platform.
            </p>
            <p className="text-xs text-sky-200/80 leading-relaxed">
              Accounts and permissions are assigned through the BellNexa administration system. Super Admin access
              also requires a verified authenticator.
            </p>
          </div>

          <div className="z-10 text-xs text-sky-200/80 font-mono flex items-center justify-between border-t border-sky-800/80 pt-4">
            <span>BellNexa</span>
            <span>School Bell &amp; Announcement Management</span>
          </div>
        </section>

        <section className="flex flex-col justify-between bg-slate-50 lg:bg-white min-h-screen">
          <header className="lg:hidden bg-[#0A1B45] text-white p-6 text-center shadow-md">
            <BellNexaLogo className="w-20 h-20 rounded-3xl mx-auto" />
            <h1 className="text-xl font-bold tracking-tight mt-2">BellNexa</h1>
            <div className="h-[2px] bg-[#12C8E8] w-36 mx-auto mt-1" />
          </header>

          <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-10 w-full max-w-md mx-auto">
            <div className="text-center mb-6 w-full">
              <BellNexaLogo className="w-12 h-12 rounded-xl mx-auto mb-2" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">BellNexa</h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Smart School Bell and Announcement Management
              </p>
            </div>

            {(errorMessage || authError) && (
              <div role="alert" className="w-full mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage || authError}</span>
              </div>
            )}
            {infoMessage && (
              <div role="status" className="w-full mb-4 p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-[#0A1B45] text-xs font-medium">
                {infoMessage}
              </div>
            )}

            <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-300 p-6 sm:p-8">
              {visibleStep === 'credentials' && (
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <label htmlFor="signin-email" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="signin-email"
                        type="email"
                        required
                        autoComplete="username"
                        autoFocus
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="name@school.edu"
                        className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#12C8E8] focus:ring-1 focus:ring-[#12C8E8] min-h-[48px]"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="signin-password" className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Password
                      </label>
                      <button type="button" onClick={openRecovery} className="text-xs font-bold text-[#0A1B45] hover:text-[#087F9B] hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#12C8E8] focus:ring-1 focus:ring-[#12C8E8] min-h-[48px]"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-800"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#0A1B45] hover:bg-[#102A5C] text-white font-extrabold py-3.5 px-6 rounded-xl text-base shadow-sm transition min-h-[50px] disabled:opacity-60"
                  >
                    {isLoading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              )}

              {(visibleStep === 'mfa' || visibleStep === 'setup-mfa') && (
                <div className="space-y-5">
                  <button type="button" onClick={() => void handleCancelPendingSignIn()} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Cancel sign-in</span>
                  </button>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {visibleStep === 'setup-mfa' ? 'Set up your authenticator' : 'Verify your authenticator'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {visibleStep === 'setup-mfa'
                        ? 'Super Admin access requires a time-based one-time password (TOTP). Scan the QR code with an authenticator app, then enter its current 6-digit code.'
                        : 'Enter the current 6-digit code from your authenticator app.'}
                    </p>
                  </div>
                  {visibleStep === 'setup-mfa' && mfaSetup && (
                    <div className="space-y-3 text-center">
                      <img src={mfaSetup.qrCode} alt="Authenticator setup QR code" className="w-44 h-44 mx-auto border border-slate-200 rounded-lg p-2" />
                      <p className="text-[11px] text-slate-500">If you cannot scan it, enter this setup key in your authenticator app:</p>
                      <code className="block break-all select-all bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-800">
                        {mfaSetup.secret}
                      </code>
                    </div>
                  )}
                  <form onSubmit={handleMfaSubmit} className="space-y-4">
                    <label htmlFor="authenticator-code" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      6-digit code
                    </label>
                    <input
                      id="authenticator-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoFocus
                      required
                      value={authCode}
                      onChange={(event) => setAuthCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-[0.5em] text-2xl font-mono font-extrabold py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#12C8E8] min-h-[48px]"
                    />
                    <button type="submit" disabled={isLoading} className="w-full bg-[#0A1B45] hover:bg-[#102A5C] text-white font-extrabold py-3.5 px-6 rounded-xl text-sm min-h-[48px] disabled:opacity-60">
                      Verify and sign in
                    </button>
                  </form>
                </div>
              )}

              {visibleStep === 'recovery' && (
                <form onSubmit={handlePasswordReset} className="space-y-5">
                  <button type="button" onClick={goBackToCredentials} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to sign in</span>
                  </button>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Reset your password</h3>
                    <p className="text-xs text-slate-600 mt-1">We will send a secure recovery link to your account email.</p>
                  </div>
                  <label htmlFor="recovery-email" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#12C8E8]"
                  />
                  <button type="submit" className="w-full bg-[#0A1B45] hover:bg-[#102A5C] text-white font-extrabold py-3 rounded-xl disabled:opacity-60">
                    Send recovery link
                  </button>
                </form>
              )}

              {visibleStep === 'new-password' && (
                <form onSubmit={handlePasswordUpdate} className="space-y-5">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {requiresPasswordSetup ? 'Set up your password' : 'Choose a new password'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {requiresPasswordSetup
                        ? 'Choose a password to activate your invited BellNexa account. You will sign in with it after setup.'
                        : 'Use at least 8 characters. You will need to sign in again after updating it.'}
                    </p>
                  </div>
                  {requiresPasswordSetup && (
                    <div>
                      <label htmlFor="invitation-token" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                        Invitation token
                      </label>
                      <input
                        id="invitation-token"
                        type="text"
                        autoComplete="one-time-code"
                        required
                        pattern="[0-9a-fA-F]{64}"
                        maxLength={64}
                        value={invitationToken}
                        onChange={(event) => setInvitationToken(event.target.value.trim())}
                        placeholder="64-character token from your invitation email"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-[#12C8E8]"
                      />
                    </div>
                  )}
                  <label htmlFor="new-password" className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#12C8E8]"
                  />
                  <button type="submit" className="w-full bg-[#0A1B45] hover:bg-[#102A5C] text-white font-extrabold py-3 rounded-xl">
                    Update password
                  </button>
                </form>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-600">
              Accounts and permissions are provisioned by authorised administrators.
            </p>
          </main>

          <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 lg:border-none">
            Powered by BellNexa.
          </footer>
        </section>
      </div>
    </div>
  );
};
