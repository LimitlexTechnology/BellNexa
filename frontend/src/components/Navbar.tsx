import React, { useState } from 'react';
import { 
  Shield, 
  School, 
  LogOut, 
  User, 
  Smartphone, 
  CalendarClock,
  Settings,
  X,
  Volume2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBellState } from '../context/BellStateContext';
import { BellNexaLogo } from './BellNexaLogo';
import { VilacEmblem } from './VilacEmblem';

export const Navbar: React.FC = () => {
  const { 
    user, 
    currentSchool, 
    role, 
    logout,
    setBellPhoneMode,
    updateProfile
  } = useAuth();
  const { availableVoices, selectedVoiceURI, setSpeechVoice, speakAnnouncement } = useBellState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const openSettings = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setIsSettingsOpen(true);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) return;
    setProfileError(null);
    setIsSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName, phone });
      setIsSettingsOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to save your profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 flex items-center justify-between font-sans">
      {/* Brand & Emblem */}
      <div className="flex items-center space-x-3">
        <BellNexaLogo className="w-10 h-10 rounded-xl shadow-md" />
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-black text-lg text-white tracking-tight">BellNexa</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-400/10 text-[#54DDF4] border border-cyan-300/30">
              PILOT v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Smart School Bell and Announcement Management
          </p>
        </div>
      </div>

      {/* Active School Tenant Context */}
      {currentSchool && (
        <div className="hidden md:flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <VilacEmblem size="sm" className="w-5 h-5" />
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Tenant: </span>
            <span className="font-bold text-white">{currentSchool.name}</span>
            <span className="ml-1.5 text-[10px] text-[#54DDF4] font-mono">({currentSchool.code})</span>
          </div>
          <span className="flex h-2 w-2 relative ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      )}

      {/* Right Controls: Bell Phone Kiosk Switcher & User Profile */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        
        {/* Button to open the dedicated School Bell Phone Kiosk screen */}
        <button
          onClick={() => setBellPhoneMode(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-[#102A5C] text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500 text-xs font-bold transition shadow-sm"
          title="Open dedicated unattended School Bell Phone screen"
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">Bell Phone Screen</span>
        </button>

        <button
          onClick={openSettings}
          title="Profile and speech settings"
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Info & Role Badge */}
        <div className="flex items-center space-x-3 border-l border-slate-800 pl-3 sm:pl-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-white leading-tight">
              {user?.full_name}
            </div>
            <div className="text-[10px] font-mono flex items-center justify-end space-x-1 mt-0.5">
              {role === 'super_admin' && (
                <span className="text-cyan-300 font-bold flex items-center">
                  <Shield className="w-3 h-3 mr-0.5 inline" /> Super Admin
                </span>
              )}
              {role === 'principal' && (
                <span className="text-sky-300 font-bold flex items-center">
                  <School className="w-3 h-3 mr-0.5 inline" /> Principal (Oversight)
                </span>
              )}
              {role === 'regulator' && (
                <span className="text-emerald-400 font-bold flex items-center">
                  <CalendarClock className="w-3 h-3 mr-0.5 inline" /> Schedule Regulator
                </span>
              )}
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#102A5C] border border-sky-700/60 flex items-center justify-center text-cyan-200">
            <User className="w-4 h-4" />
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => void handleLogout()}
            title="Sign Out to Login Screen"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={saveProfile} className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Profile & Speech</h2>
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-white" aria-label="Close settings">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {profileError && (
                <p role="alert" className="text-xs text-rose-300">{profileError}</p>
              )}
              <div>
                <label htmlFor="profile-name" className="block text-xs font-bold text-slate-300 mb-1">Full name</label>
                <input id="profile-name" required value={fullName} onChange={event => setFullName(event.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-xs font-bold text-slate-300 mb-1">Email</label>
                <input id="profile-email" value={user?.email || ''} readOnly className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-500" />
              </div>
              <div>
                <label htmlFor="profile-phone" className="block text-xs font-bold text-slate-300 mb-1">Phone</label>
                <input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <label htmlFor="speech-voice" className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Volume2 className="w-4 h-4 text-cyan-300" /> Announcement voice
              </label>
              <select
                id="speech-voice"
                value={availableVoices.some(voice => voice.voiceURI === selectedVoiceURI) ? selectedVoiceURI : ''}
                onChange={event => setSpeechVoice(event.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Automatic (Ghanaian English, then British English)</option>
                {availableVoices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>
                ))}
              </select>
              <button type="button" onClick={() => speakAnnouncement('Good morning. This is a clear voice announcement test.')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200">
                <Volume2 className="w-3.5 h-3.5" /> Test voice
              </button>
              {availableVoices.length === 0 && <p className="text-[11px] text-amber-300">No browser voices are available yet. Voice options depend on the device and browser.</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300">Cancel</button>
              <button type="submit" disabled={isSavingProfile} className="px-3 py-2 bg-[#0A1B45] hover:bg-[#102A5C] rounded-lg text-xs font-bold text-white disabled:opacity-60">
                {isSavingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};
