import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  Volume2, 
  VolumeX, 
  Radio, 
  ShieldAlert, 
  RotateCw, 
  BatteryCharging, 
  Wifi, 
  CheckCircle2, 
  AlertTriangle,
  ArrowLeft,
  Sliders
} from 'lucide-react';
import { useBellState } from '../context/BellStateContext';
import { useAuth } from '../context/AuthContext';
import { VilacEmblem } from '../components/VilacEmblem';

export const BellPhoneScreen: React.FC = () => {
  const { setBellPhoneMode } = useAuth();
  const { 
    events, 
    speakerConnected, 
    toggleSpeakerConnection, 
    isBellsPaused, 
    isEmergencyStopped, 
    triggerEmergencyStop, 
    resumeFromEmergencyStop,
    lastSyncTime,
    scheduleRevision,
    isRingingNow,
    activeRingingEvent,
    playTestChime,
    stopRinging
  } = useBellState();

  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter live approved events
  const liveEvents = events.filter(e => e.approval_status === 'live_on_device' && e.is_enabled);
  const currentTimeString = currentTime.toTimeString().substring(0, 5);
  const sortedLiveEvents = [...liveEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextBell = sortedLiveEvents.find(e => e.start_time > currentTimeString) || sortedLiveEvents[0];

  // Countdown computation
  const getCountdown = () => {
    if (!nextBell) return '00:00:00';
    const [h, m] = nextBell.start_time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);

    let diff = target.getTime() - currentTime.getTime();
    if (diff < 0) {
      target.setDate(target.getDate() + 1);
      diff = target.getTime() - currentTime.getTime();
    }

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none font-sans relative overflow-hidden">
      
      {/* TOP STATUS BAR: UNATTENDED HARDWARE INDICATORS */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        {/* School Crest & Mode */}
        <div className="flex items-center space-x-3">
          <VilacEmblem size="sm" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-wider uppercase text-white">
                Vilac International School
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold">
                UNATTENDED KIOSK
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Dedicated Android Bell Hardware &bull; AlarmManager Armed
            </p>
          </div>
        </div>

        {/* Top Hardware Metrics & Return Button */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-3 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="flex items-center space-x-1 text-emerald-400">
              <BatteryCharging className="w-4 h-4" />
              <span>94%</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center space-x-1 text-blue-400">
              <Wifi className="w-4 h-4" />
              <span>Sync OK</span>
            </span>
            <span>&bull;</span>
            <span>Rev #{scheduleRevision}</span>
          </div>

          {/* Switch back to Web Portal */}
          <button
            onClick={() => setBellPhoneMode(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition"
            title="Return to Web Console"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Console</span>
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* CENTER STAGE: NEXT BELL, LIVE COUNTDOWN & SPEAKER STATUS */}
      {/* ========================================================= */}
      <main className="my-auto py-8 flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto w-full">
        
        {/* SPEAKER CONNECTED / DISCONNECTED INDICATOR */}
        <div className="flex flex-col items-center space-y-2">
          <div 
            onClick={toggleSpeakerConnection}
            className={`cursor-pointer inline-flex items-center space-x-2.5 px-5 py-2.5 rounded-2xl border-2 transition shadow-lg ${
              speakerConnected 
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300' 
                : 'bg-rose-950/70 border-rose-600 text-rose-300 animate-pulse'
            }`}
            title="Click to toggle speaker connection status"
          >
            <span className={`w-3.5 h-3.5 rounded-full ${speakerConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
            <span className="text-sm font-black tracking-wider uppercase">
              {speakerConnected ? 'Speaker Connected (PA Line Active)' : 'Speaker Disconnected!'}
            </span>
            {speakerConnected ? (
              <Volume2 className="w-4 h-4 text-emerald-400 ml-1" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400 ml-1" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {speakerConnected ? '3.5mm Aux Audio Out OK' : 'Check physical amplifier cable'}
          </span>
        </div>

        {/* RINGING NOW BANNER */}
        {isRingingNow && (
          <div className="w-full bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-emerald-400 animate-bounce">
            <div className="flex items-center space-x-3 text-left">
              <Bell className="w-8 h-8 text-white animate-spin" />
              <div>
                <span className="text-base font-black uppercase">
                  Bell Currently Ringing
                </span>
                <p className="text-xs text-emerald-100 font-mono">
                  {activeRingingEvent || 'School Bell Sound Active'}
                </p>
              </div>
            </div>
            <button
              onClick={stopRinging}
              className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              Silence
            </button>
          </div>
        )}

        {/* EMERGENCY OVERRIDE BANNER */}
        {isEmergencyStopped && (
          <div className="w-full bg-red-600 text-white p-4 rounded-2xl shadow-2xl border-2 border-red-400 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-left">
              <ShieldAlert className="w-8 h-8 text-white flex-shrink-0" />
              <div>
                <span className="text-base font-black uppercase">
                  Bell Engine Halted &bull; Emergency Stop
                </span>
                <p className="text-xs text-red-100">
                  Audio output muted. Tap green button to restore normal timetable.
                </p>
              </div>
            </div>
            <button
              onClick={resumeFromEmergencyStop}
              className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 font-black text-xs uppercase rounded-xl transition"
            >
              Reset
            </button>
          </div>
        )}

        {/* PAUSED BANNER */}
        {isBellsPaused && !isEmergencyStopped && (
          <div className="w-full bg-amber-500/20 border border-amber-500/40 text-amber-300 p-3 rounded-2xl text-xs font-bold">
            Bells Paused by Principal (Quiet Study Mode)
          </div>
        )}

        {/* COUNTDOWN CARD */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 w-full shadow-2xl space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Next Scheduled Bell
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {nextBell?.event_name || 'No Upcoming Events'}
            </h2>
            <div className="text-xs font-mono text-[#54DDF4] font-bold">
              Scheduled at {nextBell?.start_time || '--:--'} GMT &bull; Repeats {nextBell?.repeat_count || 3}x
            </div>
          </div>

          {/* LARGE COUNTDOWN TIMER */}
          <div className="py-4">
            <div className="text-6xl sm:text-8xl font-black font-mono text-emerald-400 tracking-tighter drop-shadow-md">
              {getCountdown()}
            </div>
            <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">
              Hours : Minutes : Seconds
            </span>
          </div>

          {/* Announcement Preview */}
          {nextBell?.announcement_text && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 italic">
              "{nextBell.announcement_text}"
              <button
                onClick={() => playTestChime(nextBell.event_name, nextBell.announcement_text, nextBell.repeat_count || 3)}
                className="ml-2 not-italic text-emerald-400 hover:text-emerald-300 font-bold no-underline"
                title="Hear this announcement now"
              >
                ▶ Hear
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ONE LARGE RED STOP BUTTON */}
        {/* ========================================================= */}
        <div className="w-full pt-4 flex flex-col items-center">
          <button
            onClick={() => {
              if (isEmergencyStopped) {
                resumeFromEmergencyStop();
              } else {
                triggerEmergencyStop();
              }
            }}
            className={`w-full max-w-md py-6 sm:py-8 px-8 rounded-3xl font-black text-xl sm:text-2xl uppercase tracking-widest shadow-2xl transition duration-150 transform active:scale-95 flex items-center justify-center space-x-3 border-4 ${
              isEmergencyStopped
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400 shadow-emerald-950/80'
                : 'bg-red-600 hover:bg-red-700 text-white border-red-500 shadow-red-950/80'
            }`}
          >
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10" />
            <span>{isEmergencyStopped ? 'RESUME BELLS' : 'STOP'}</span>
          </button>

          <span className="text-[11px] text-slate-500 mt-2 font-mono">
            {isEmergencyStopped
              ? 'Click to clear emergency stop and re-arm scheduled alarms'
              : 'Tap large STOP button to immediately cut audio and halt timetable'}
          </span>
        </div>

      </main>

      {/* ========================================================= */}
      {/* FOOTER: LAST SYNC TIME & DEVICE STATUS */}
      {/* ========================================================= */}
      <footer className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Last synchronized: <strong className="text-white">{lastSyncTime}</strong></span>
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
          <span>Vilac Hardware ID: PI-VILAC-HW01</span>
          <span>&bull;</span>
          <button
            onClick={() => playTestChime(nextBell?.event_name || 'School Speaker Test', nextBell?.announcement_text, nextBell?.repeat_count || 3)}
            className="text-emerald-400 hover:underline font-bold"
          >
            Trigger Test Chime
          </button>
        </div>
      </footer>

    </div>
  );
};
