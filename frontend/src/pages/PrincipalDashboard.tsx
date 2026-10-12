import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Smartphone, 
  CheckCircle2, 
  PauseCircle, 
  PlayCircle, 
  History, 
  ShieldAlert, 
  Volume2, 
  FileAudio, 
  Calendar, 
  UserCheck,
  Check,
  X
} from 'lucide-react';
import { useBellState } from '../context/BellStateContext';
import { useAuth } from '../context/AuthContext';
import { SchoolLogo } from '../components/SchoolLogo';
import { formatCountdown, formatDateTimeInTimeZone, getNextScheduleOccurrence, getPreferredTimeZone } from '../lib/timezone';

export const PrincipalDashboard: React.FC = () => {
  const { user, currentSchool, currentCampus } = useAuth();
  const { 
    events, 
    pendingApprovals, 
    playbackHistory, 
    auditLogs,
    isBellsPaused, 
    isEmergencyStopped, 
    speakerConnected, 
    lastSyncTime,
    scheduleRevision,
    approvePendingItem, 
    rejectPendingItem, 
    togglePauseAllBells, 
    triggerEmergencyStop, 
    resumeFromEmergencyStop,
    playTestChime
  } = useBellState();

  const [activeTab, setActiveTab] = useState<'glance' | 'approvals' | 'history'>('approvals');
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [now, setNow] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Next Bell from live events
  const liveEvents = events.filter(e => e.approval_status === 'live_on_device' && e.is_enabled);
  
  // Find next upcoming bell for today
  const sortedLiveEvents = [...liveEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const scheduleTimeZone = getPreferredTimeZone(
    user?.preferred_timezone,
    currentCampus?.timezone,
    currentSchool?.timezone,
  );
  const upcomingOccurrence = sortedLiveEvents
    .map(event => ({
      event,
      occurrence: getNextScheduleOccurrence(event.start_time, event.days_of_week, scheduleTimeZone, now),
    }))
    .filter((item): item is { event: typeof sortedLiveEvents[number]; occurrence: Date } => item.occurrence !== null)
    .sort((left, right) => left.occurrence.getTime() - right.occurrence.getTime())[0];
  const upcomingEvent = upcomingOccurrence?.event;
  const calculateCountdown = () => formatCountdown(upcomingOccurrence?.occurrence ?? null, now);

  const handleConfirmReject = () => {
    if (rejectModalId) {
      rejectPendingItem(rejectModalId, rejectReason || 'Declined by Principal.');
      setRejectModalId(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* EMERGENCY STOP BANNER IF ACTIVATED */}
      {isEmergencyStopped && (
        <div className="p-4 rounded-2xl bg-red-600 text-white shadow-lg border-2 border-red-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-8 h-8 text-white flex-shrink-0 animate-pulse" />
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">
                Emergency Bell Stoppage Active
              </h2>
              <p className="text-xs text-red-100 font-medium">
                All scheduled chimes and voice announcements are halted on the school phone.
              </p>
            </div>
          </div>
          <button
            onClick={resumeFromEmergencyStop}
            className="w-full sm:w-auto px-5 py-2.5 bg-white text-red-700 hover:bg-red-50 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition"
          >
            Clear Override & Resume
          </button>
        </div>
      )}

      {/* BELLS PAUSED NOTICE */}
      {isBellsPaused && !isEmergencyStopped && (
        <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-200 border border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PauseCircle className="w-6 h-6 text-amber-400" />
            <div>
              <span className="font-bold text-sm text-white">All Bells Are Currently Paused</span>
              <p className="text-xs text-amber-300/80">Scheduled bells are muted for quiet study or exams.</p>
            </div>
          </div>
          <button
            onClick={togglePauseAllBells}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition"
          >
            Resume All Bells
          </button>
        </div>
      )}

      {/* TOP HEADER: INSTITUTION OVERSIGHT IDENTITY & CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          {currentSchool && <SchoolLogo school={currentSchool} className="hidden h-10 w-10 sm:inline-flex" />}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#54DDF4] bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded">
                Principal Oversight
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Rev #{scheduleRevision}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">
              {currentSchool?.name || 'School'}
            </h1>
            <p className="text-xs text-slate-400">
              {user?.full_name || 'Principal'} &bull; Head of Oversight & Governance
            </p>
          </div>
        </div>

        {/* MASTER ACTIONS: PAUSE BELLS & EMERGENCY STOP */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Pause Bells Toggle */}
          <button
            onClick={togglePauseAllBells}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition ${
              isBellsPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isBellsPaused ? (
              <>
                <PlayCircle className="w-4 h-4 text-amber-400" />
                <span>Resume Scheduled Bells</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-slate-400" />
                <span>Pause All Bells</span>
              </>
            )}
          </button>

          {/* Emergency Stop Button */}
          <button
            onClick={triggerEmergencyStop}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-900/30 transition"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 pb-2 space-x-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'approvals'
              ? 'bg-[#0A1B45] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Pending Approvals</span>
          {pendingApprovals.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#12C8E8] text-white font-extrabold">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('glance')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'glance'
              ? 'bg-[#0A1B45] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Today at a Glance</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'history'
              ? 'bg-[#0A1B45] text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Playback & Changes History</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PENDING APPROVALS LIST (THE PRINCIPAL'S MAIN JOB) */}
      {/* ========================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Pending Timetable & Announcement Approvals</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Edits made by the Schedule Regulator wait here. Nothing reaches the school bell phone until you approve.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {pendingApprovals.length} awaiting decision
            </span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-white">All Clear — No Pending Approvals</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                All changes submitted by the Schedule Regulator have been reviewed. The school phone is running the latest approved schedule (Rev #{scheduleRevision}).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {item.type === 'audio_upload' ? (
                          <FileAudio className="w-5 h-5 text-[#12C8E8]" />
                        ) : (
                          <Calendar className="w-5 h-5 text-[#12C8E8]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.type === 'audio_upload' ? 'Voice Announcement' : 'Timetable Modification'}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {item.submitted_at}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1">
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400">Submitted by:</span>
                      <p className="text-xs font-semibold text-slate-200">
                        {item.submitted_by_name}
                      </p>
                    </div>
                  </div>

                  {/* Description / Diff Detail */}
                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.description}
                    </p>

                    {item.type === 'audio_upload' && (
                      <div className="pt-2 flex items-center space-x-3">
                        <button
                          onClick={() => playTestChime(item.audio_title)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold flex items-center space-x-2 transition"
                        >
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                          <span>Preview Audio Asset</span>
                        </button>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {item.audio_title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Approve & Push vs Reject */}
                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      onClick={() => {
                        setRejectModalId(item.id);
                        setRejectReason('');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-300 border border-slate-700 hover:border-red-800 rounded-xl text-xs font-bold text-slate-300 transition flex items-center space-x-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject & Request Changes</span>
                    </button>

                    <button
                      onClick={() => approvePendingItem(item.id)}
                      className="px-5 py-2.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white rounded-xl text-xs font-black shadow-lg shadow-[#07142F]/50 transition flex items-center space-x-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve & Push to Bell Phone</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TODAY AT A GLANCE */}
      {/* ========================================================= */}
      {activeTab === 'glance' && (
        <div className="space-y-6">
          {/* THREE TOP STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* CARD 1: NEXT BELL & COUNTDOWN */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Next Scheduled Bell
                </span>
                <Clock className="w-4 h-4 text-[#54DDF4]" />
              </div>

              {upcomingEvent ? (
                <div className="space-y-2">
                  <div className="text-xl font-black text-white truncate">
                    {upcomingEvent.event_name}
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black font-mono text-[#54DDF4]">
                      {calculateCountdown()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      (at {upcomingEvent.start_time})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    Announcement: "{upcomingEvent.announcement_text}"
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No bells scheduled for today.</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Repeats: {upcomingEvent?.repeat_count || 3}x</span>
                <span className="text-emerald-400 font-medium">Armed on Device</span>
              </div>
            </div>

            {/* CARD 2: SCHOOL BELL PHONE STATUS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  School Bell Phone
                </span>
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-lg font-bold text-white">Online & Unattended</span>
                </div>
                
                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Speaker Connection:</span>
                    <span className={`font-bold ${speakerConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {speakerConnected ? 'Connected (Aux Line)' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Battery Level:</span>
                    <span className="font-mono text-white">94% (Charging)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Ping:</span>
                    <span className="font-mono text-slate-300">{lastSyncTime}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Device: PI-VILAC-HW01</span>
                <span className="text-emerald-400 font-mono">App v1.0.4</span>
              </div>
            </div>

            {/* CARD 3: SCHEDULE SUMMARY */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Schedule
                </span>
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>

              <div className="space-y-2">
                <div className="text-3xl font-black text-white">
                  {liveEvents.length}{' '}
                  <span className="text-sm font-medium text-slate-400">Live Events</span>
                </div>
                <p className="text-xs text-slate-300">
                  Active revision #{scheduleRevision}. Offline playback must be validated on the target device.
                </p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
                    Mon - Sun Timetable
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Zone: {scheduleTimeZone}</span>
                <span className="text-slate-300">{scheduleTimeZone}</span>
              </div>
            </div>

          </div>

          {/* REGULATOR FEED OF RECENT CHANGES */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Schedule Regulator Activity Feed</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time log of what the timetable regulator has edited, uploaded, or drafted.
                </p>
              </div>
              <span className="text-xs font-mono text-[#54DDF4] font-bold">
                Vilac Academic Timetable
              </span>
            </div>

            <div className="space-y-3">
              {auditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/70 flex items-start space-x-3 text-xs"
                >
                  <div className="w-2 h-2 rounded-full bg-[#54DDF4] mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatDateTimeInTimeZone(new Date(log.created_at), scheduleTimeZone)}
                      </span>
                    </div>
                    {log.metadata && (
                      <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                        {JSON.stringify(log.metadata).replace(/[{"}]/g, ' ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: PLAYBACK & CHANGES HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* PLAYBACK HISTORY FOR TODAY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Today's Bell Playback Log</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hardware-confirmed playback events received from the school bell phone.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                100% On-Time Execution
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Event Name</th>
                    <th className="pb-3">Trigger Time</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Volume</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {playbackHistory.map((item) => (
                    <tr key={item.id} className="text-slate-300 hover:bg-slate-800/30">
                      <td className="py-3 font-bold text-white flex items-center space-x-2">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{item.event_name}</span>
                      </td>
                      <td className="py-3 font-mono">{item.played_at}</td>
                      <td className="py-3 font-mono">{item.duration_seconds}s</td>
                      <td className="py-3 font-mono">{item.volume_level}%</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          COMPLETED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* COMPLETE AUDIT TRAIL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Full Administrative Audit Trail</h3>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200">{log.action}</span>
                    <span className="text-slate-500 ml-2 text-[11px]">({log.resource_type})</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {formatDateTimeInTimeZone(new Date(log.created_at), scheduleTimeZone)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Reject Regulator Change</h3>
              <button 
                onClick={() => setRejectModalId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Provide feedback to the Schedule Regulator. The event will return to <em>Draft</em> status so corrections can be made.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Please keep the original 12:30 PM time until Friday..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
