import React, { useState, useEffect } from 'react';
import {
  Building2,
  Smartphone,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Send,
  Key,
  Copy,
  ArrowRight,
  Shield,
  Calendar,
  AlertTriangle,
  LifeBuoy,
  Bell,
  Volume2,
  FileAudio,
  PauseCircle,
  PlayCircle,
  Plus,
  Edit3,
  Trash2,
  Play,
  Upload,
  Check,
  X,
  History,
  ChevronLeft,
  Wifi,
  BatteryCharging,
  Radio,
  UserCheck
} from 'lucide-react';
import { useBellState } from '../context/BellStateContext';
import { useAuth, MOCK_VILAC_SCHOOL } from '../context/AuthContext';
import { School, SupportTicket, ScheduleEvent, EventCategory, EventApprovalStatus } from '../types/database';
import { VilacEmblem } from '../components/VilacEmblem';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

type SchoolTab = 'overview' | 'timetable' | 'approvals' | 'device' | 'invitations' | 'audit';

// ─── Main Component ──────────────────────────────────────────────────────────

export const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    events,
    pendingApprovals,
    playbackHistory,
    auditLogs,
    invitations,
    isBellsPaused,
    isEmergencyStopped,
    speakerConnected,
    isRingingNow,
    activeRingingEvent,
    deviceOnline,
    lastSyncTime,
    scheduleRevision,
    // Regulator powers
    createDraftEvent,
    updateEventAsDraft,
    submitEventForApproval,
    deleteEvent,
    uploadAudioAnnouncement,
    // Principal powers
    approvePendingItem,
    rejectPendingItem,
    togglePauseAllBells,
    triggerEmergencyStop,
    resumeFromEmergencyStop,
    // SA powers
    createInvitation,
    revokeInvitation,
    deleteSchool,
    playTestChime,
    stopRinging,
  } = useBellState();

  // ── Platform schools list ──
  const [schools, setSchools] = useState<School[]>(() => {
    const initialSchools: School[] = [
      MOCK_VILAC_SCHOOL,
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Achimota Preparatory School',
        code: 'ACHIMOTA-ACCRA',
        timezone: 'Africa/Accra',
        branding_primary: '#1E3A8A',
        branding_secondary: '#D97706',
        branding_accent: '#F59E0B',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Prempeh College',
        code: 'PREMPEH-KUMASI',
        timezone: 'Africa/Accra',
        branding_primary: '#065F46',
        branding_secondary: '#B45309',
        branding_accent: '#FBBF24',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    try {
      const deletedIds = JSON.parse(window.localStorage.getItem('bellnexa-deleted-schools') || '[]');
      return initialSchools.filter(school => !deletedIds.includes(school.id));
    } catch {
      return initialSchools;
    }
  });

  // ── Navigation state ──
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<SchoolTab>('overview');

  // ── Timetable state ──
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<EventCategory>('lesson_change');
  const [formTime, setFormTime] = useState('09:00');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [formAnnouncement, setFormAnnouncement] = useState('');
  const [formRepeatCount, setFormRepeatCount] = useState(3);
  const [formVolume, setFormVolume] = useState(100);

  // ── Approval state ──
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Delete school state ──
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);

  // ── Invitation state ──
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'principal' | 'regulator'>('principal');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  // ── Audio state ──
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDuration, setAudioDuration] = useState('30');
  const [audioSuccess, setAudioSuccess] = useState<string | null>(null);

  // ── Support tickets ──
  const [supportTickets] = useState<SupportTicket[]>([
    {
      id: 'tick-1',
      school_id: MOCK_VILAC_SCHOOL.id,
      user_id: 'usr-principal',
      device_id: 'VILAC-HW01',
      title: 'Aux Cable Grounding Hum on Courtyard Speakers',
      category: 'Audio Hardware',
      severity: 'low',
      status: 'acknowledged',
      description: 'Minor audio static detected when volume set above 90% during morning assembly.',
      created_at: 'Yesterday at 14:20',
      updated_at: 'Today at 08:00',
    },
  ]);

  // ── Clock for countdown ──
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const liveEvents = events.filter(e => e.approval_status === 'live_on_device' && e.is_enabled);
  const currentTimeStr = now.toTimeString().substring(0, 5);
  const sortedLive = [...liveEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextBell = sortedLive.find(e => e.start_time > currentTimeStr) || sortedLive[0];

  const getCountdown = () => {
    if (!nextBell) return '00:00:00';
    const [h, m] = nextBell.start_time.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    let diff = target.getTime() - now.getTime();
    if (diff < 0) { target.setDate(target.getDate() + 1); diff = target.getTime() - now.getTime(); }
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  };

  // ── Helpers ──
  const isVilac = (s: School) => s.id === MOCK_VILAC_SCHOOL.id;

  const handleIssueInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedSchool) return;
    const inv = createInvitation(inviteEmail.trim(), inviteRole, selectedSchool.id, selectedSchool.name);
    setGeneratedToken(inv.token);
    setInviteEmail('');
  };

  const copyToken = (t: string) => {
    navigator.clipboard.writeText(t);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 2000);
  };

  const handleConfirmDeleteSchool = () => {
    if (!schoolToDelete) return;
    deleteSchool(schoolToDelete.id);
    setSchools(prev => prev.filter(s => s.id !== schoolToDelete.id));
    try {
      const deletedIds = JSON.parse(window.localStorage.getItem('bellnexa-deleted-schools') || '[]') as string[];
      window.localStorage.setItem('bellnexa-deleted-schools', JSON.stringify([...new Set([...deletedIds, schoolToDelete.id])]));
    } catch {
      // Keep the current deletion in memory if browser storage is unavailable.
    }
    if (selectedSchool?.id === schoolToDelete.id) {
      setSelectedSchool(null);
    }
    setSchoolToDelete(null);
  };

  const openAddModal = () => {
    setEditingEventId(null);
    setFormName(''); setFormCategory('lesson_change'); setFormTime('09:00');
    setFormDays([1,2,3,4,5,6,7]); setFormAnnouncement(''); setFormRepeatCount(3); setFormVolume(100);
    setIsAddModalOpen(true);
  };

  const openEditModal = (ev: ScheduleEvent) => {
    setEditingEventId(ev.id);
    setFormName(ev.event_name); setFormCategory(ev.category); setFormTime(ev.start_time);
    setFormDays(ev.days_of_week); setFormAnnouncement(ev.announcement_text || '');
    setFormRepeatCount(ev.repeat_count || 3); setFormVolume(ev.volume || 100);
    setIsAddModalOpen(true);
  };

  const saveEvent = (submitNow = false) => {
    if (!formName.trim() || !formTime.trim()) return;
    if (editingEventId) {
      updateEventAsDraft(editingEventId, {
        event_name: formName, category: formCategory, start_time: formTime,
        days_of_week: formDays, announcement_text: formAnnouncement,
        repeat_count: formRepeatCount, volume: formVolume,
        change_summary: `Edited by Super Admin at ${formTime}`,
      });
      if (submitNow) submitEventForApproval(editingEventId);
    } else {
      createDraftEvent({
        schedule_id: 'sched-vilac-1',
        school_id: selectedSchool?.id || MOCK_VILAC_SCHOOL.id,
        event_name: formName, category: formCategory, start_time: formTime,
        days_of_week: formDays, is_enabled: true, announcement_text: formAnnouncement,
        language: 'en', volume: formVolume, repeat_count: formRepeatCount,
        change_summary: 'Created by Super Admin', last_edited_by: user?.full_name || 'Super Admin',
      });
    }
    setIsAddModalOpen(false);
  };

  const handleAudioUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioTitle.trim()) return;
    uploadAudioAnnouncement(audioTitle, parseInt(audioDuration) || 30, `audio/${audioTitle.toLowerCase().replace(/\s+/g,'_')}.mp3`);
    setAudioSuccess(`"${audioTitle}" staged and sent for approval.`);
    setAudioTitle('');
    setTimeout(() => setAudioSuccess(null), 3000);
  };

  // ── BADGE COUNTS ──
  const pendingCount = pendingApprovals.length;
  const draftCount   = events.filter(e => e.approval_status === 'draft').length;
  const liveCount    = liveEvents.length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: GLOBAL OVERVIEW (no school selected)
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedSchool) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 text-[#F4511E] text-xs font-bold mb-1">
            <Shield className="w-4 h-4" />
            <span className="uppercase tracking-wider">Super Admin — Platform Governance</span>
          </div>
          <h1 className="text-2xl font-black text-white">Select a School to Manage</h1>
          <p className="text-xs text-slate-400 mt-1">
            Click any school card below to enter its full workspace. You have unrestricted access to all roles — Principal, Schedule Regulator, and platform settings — inside every school.
          </p>
        </div>

        {/* Platform-wide metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Schools', value: schools.length, icon: Building2, color: 'text-emerald-400', sub: 'Registered tenants' },
            { label: 'Bell Devices Online', value: '3 / 3', icon: Smartphone, color: 'text-blue-400', sub: '100% heartbeat' },
            { label: 'Pending Approvals', value: pendingCount, icon: UserCheck, color: 'text-amber-400', sub: 'Awaiting principal' },
            { label: 'Support Tickets', value: supportTickets.length, icon: LifeBuoy, color: 'text-rose-400', sub: '1 acknowledged' },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{m.label}</span>
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div className="text-3xl font-black text-white">{m.value}</div>
                <div className={`text-[11px] font-medium ${m.color}`}>{m.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Clickable school cards */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Registered Schools — Click to Enter Full Workspace
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {schools.map((school) => (
              <div key={school.id} className="text-left bg-slate-900 border border-slate-800 hover:border-[#F4511E] hover:shadow-lg hover:shadow-orange-950/30 rounded-2xl p-5 transition-all duration-150 space-y-4">
                <button
                  onClick={() => { setSelectedSchool(school); setActiveTab('overview'); }}
                  className="group w-full text-left space-y-4"
                >
                {/* School colour swatch + code */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border"
                    style={{ color: school.branding_primary, borderColor: school.branding_primary + '60', background: school.branding_primary + '18' }}
                  >
                    {school.code}
                  </span>
                  {isVilac(school) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      PILOT ACTIVE
                    </span>
                  )}
                </div>

                {/* School name */}
                <div>
                  <h3 className="text-base font-black text-white group-hover:text-[#F4511E] transition-colors">
                    {school.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{school.timezone}</p>
                </div>

                {/* Device quick status */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-medium">Device Online</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 group-hover:text-[#F4511E] transition-colors font-bold">
                    <span>Enter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                </button>
                <div className="flex justify-end border-t border-slate-800 pt-3">
                  <button onClick={() => setSchoolToDelete(school)} className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300" title={`Delete ${school.name}`}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete school
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent platform audit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Recent Platform Activity</h3>
          <div className="space-y-2">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="font-semibold text-slate-200">{log.action.replace(/_/g, ' ')}</span>
                <span className="font-mono text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        {schoolToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div role="alertdialog" aria-modal="true" aria-labelledby="delete-school-title" className="bg-slate-900 border border-rose-900/70 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h2 id="delete-school-title" className="text-base font-bold text-white">Delete {schoolToDelete.name}?</h2>
                  <p className="mt-2 text-sm text-slate-300">This pilot removes the school, its invitations and school-owned data, including schedules, approvals and playback history. A connected Supabase deployment also removes school memberships; global sign-in accounts are retained.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <button onClick={() => setSchoolToDelete(null)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300">Cancel</button>
                <button onClick={handleConfirmDeleteSchool} className="flex items-center gap-1.5 px-3 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-xs font-bold text-white">
                  <Trash2 className="w-3.5 h-3.5" /> Delete school
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: SCHOOL WORKSPACE (school selected — all roles unified)
  // ─────────────────────────────────────────────────────────────────────────
  const tabs: { id: SchoolTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview',     label: 'Overview & Device',   icon: Smartphone },
    { id: 'approvals',    label: 'Pending Approvals',   icon: UserCheck,  badge: pendingCount },
    { id: 'timetable',    label: 'Timetable Editor',    icon: Calendar },
    { id: 'invitations',  label: 'Invitations',         icon: Key },
    { id: 'audit',        label: 'Audit Log',           icon: History },
  ];

  const dayEvents = events
    .filter(e => e.days_of_week.includes(selectedDay))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const schoolInvitations = invitations.filter(i => i.school_id === selectedSchool.id);

  return (
    <div className="space-y-5">

      {/* ── School breadcrumb header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
                      bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center space-x-4">
          {/* Back to schools list */}
          <button
            onClick={() => setSelectedSchool(null)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Back to all schools"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {isVilac(selectedSchool) && (
            <VilacEmblem size="sm" className="hidden sm:inline-flex" />
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4511E]/15 text-[#F4511E] border border-[#F4511E]/30">
                Super Admin Full Access
              </span>
              <span className="text-[10px] font-mono text-slate-400">Rev #{scheduleRevision}</span>
            </div>
            <h1 className="text-xl font-black text-white mt-0.5">{selectedSchool.name}</h1>
            <p className="text-[11px] text-slate-400">{selectedSchool.code} &bull; {selectedSchool.timezone}</p>
          </div>
        </div>

        {/* Emergency master controls visible at all times */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={togglePauseAllBells}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
              isBellsPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isBellsPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            <span>{isBellsPaused ? 'Resume Bells' : 'Pause Bells'}</span>
          </button>

          <button
            onClick={() => isEmergencyStopped ? resumeFromEmergencyStop() : triggerEmergencyStop()}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black border transition ${
              isEmergencyStopped
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500'
                : 'bg-red-600 hover:bg-red-700 text-white border-red-500 shadow-md shadow-red-950/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{isEmergencyStopped ? 'Clear Emergency Stop' : 'Emergency Stop'}</span>
          </button>
        </div>
      </div>

      {/* Emergency banners */}
      {isEmergencyStopped && (
        <div className="p-4 rounded-2xl bg-red-600 text-white flex items-center justify-between border-2 border-red-400">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-7 h-7 animate-pulse" />
            <div>
              <p className="font-black text-sm uppercase tracking-wide">Emergency Stop Active — All Bells Halted</p>
              <p className="text-xs text-red-100">Click "Clear Emergency Stop" above to resume normal timetable.</p>
            </div>
          </div>
        </div>
      )}
      {isBellsPaused && !isEmergencyStopped && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center space-x-2">
          <PauseCircle className="w-4 h-4" />
          <span>All bells are paused (quiet study/exam mode). Click Resume Bells to re-arm.</span>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === id
                ? 'bg-[#00563F] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[#F4511E] text-white font-extrabold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW & DEVICE                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* 3-card row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* NEXT BELL */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Next Bell</span>
                <Clock className="w-4 h-4 text-[#E6AD00]" />
              </div>
              <div className="text-lg font-black text-white">{nextBell?.event_name || 'None today'}</div>
              <div className="text-3xl font-black font-mono text-[#E6AD00]">{getCountdown()}</div>
              <div className="text-[11px] text-slate-400 font-mono">Fires at {nextBell?.start_time || '--:--'} &bull; ×{nextBell?.repeat_count || 3}</div>
            </div>

            {/* DEVICE STATUS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Bell Phone</span>
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-base font-bold text-white">Online &amp; Unattended</span>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Speaker:</span>
                  <span className={speakerConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {speakerConnected ? 'Connected (Aux)' : 'Disconnected!'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last sync:</span>
                  <span className="font-mono">{lastSyncTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Schedule Rev:</span>
                  <span className="font-mono text-[#E6AD00]">#{scheduleRevision}</span>
                </div>
              </div>
            </div>

            {/* SCHEDULE SUMMARY */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Schedule</span>
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-white">{liveCount} <span className="text-sm font-medium text-slate-400">Live</span></div>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">{draftCount} Draft</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">{pendingCount} Awaiting</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">{liveCount} Live</span>
              </div>
            </div>
          </div>

          {/* Today's playback log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Today's Bell Playback Log</h3>
            {playbackHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No playback recorded yet today.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <th className="text-left pb-2">Event</th>
                    <th className="text-left pb-2">Time</th>
                    <th className="text-left pb-2">Duration</th>
                    <th className="text-left pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {playbackHistory.map(item => (
                    <tr key={item.id} className="text-slate-300">
                      <td className="py-2 font-bold text-white">{item.event_name}</td>
                      <td className="py-2 font-mono">{item.played_at}</td>
                      <td className="py-2 font-mono">{item.duration_seconds}s</td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">DONE</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Audio test & support tickets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test play */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => playTestChime('Westminster Bell Test')}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-bold transition"
                >
                  <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                  <span>Test Play Bell Chime (Speakers)</span>
                </button>
                {isRingingNow && (
                  <button
                    onClick={stopRinging}
                    className="w-full flex items-center space-x-2 px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition"
                  >
                    <X className="w-4 h-4" />
                    <span>Stop Test (Currently Ringing: {activeRingingEvent})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Support tickets */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Support Tickets</h3>
              {supportTickets.map(t => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{t.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 uppercase">{t.status}</span>
                  </div>
                  <p className="text-slate-400">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PENDING APPROVALS (principal power)                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Pending Regulator Submissions</h2>
              <p className="text-xs text-slate-400 mt-0.5">As Super Admin you can approve or reject directly, bypassing the Principal if needed.</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{pendingApprovals.length} pending</span>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-white">Nothing pending — all changes are live or drafted.</p>
            </div>
          ) : (
            pendingApprovals.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                      {item.type === 'audio_upload' ? <FileAudio className="w-5 h-5 text-[#F4511E]" /> : <Calendar className="w-5 h-5 text-[#F4511E]" />}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.type.replace(/_/g,' ')} &bull; {item.submitted_at}</div>
                      <h3 className="text-base font-bold text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400">By {item.submitted_by_name}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  {item.description}
                  {item.type === 'audio_upload' && (
                    <button onClick={() => playTestChime(item.audio_title)} className="mt-2 flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 font-bold">
                      <Volume2 className="w-4 h-4" />
                      <span>Preview Audio</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-1">
                  <button
                    onClick={() => { setRejectModalId(item.id); setRejectReason(''); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-300 border border-slate-700 hover:border-red-800 rounded-xl text-xs font-bold text-slate-300 transition flex items-center space-x-1.5"
                  >
                    <X className="w-4 h-4" /><span>Reject</span>
                  </button>
                  <button
                    onClick={() => approvePendingItem(item.id)}
                    className="px-5 py-2.5 bg-[#00563F] hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" /><span>Approve & Push to Phone</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: TIMETABLE EDITOR (regulator power)                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          {/* Ringing banner */}
          {isRingingNow && (
            <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center space-x-2 animate-pulse">
              <Volume2 className="w-4 h-4" />
              <span>Test ringing: {activeRingingEvent}</span>
              <button onClick={stopRinging} className="ml-auto underline">Stop</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold text-white">Weekly Timetable — {DAYS.find(d => d.id === selectedDay)?.name}</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => playTestChime('Westminster Bell Test')} className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition">
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /><span>Test Play</span>
              </button>
              <button onClick={openAddModal} className="flex items-center space-x-1.5 px-4 py-2 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-xs font-black shadow-md transition">
                <Plus className="w-4 h-4" /><span>Add Event</span>
              </button>
            </div>
          </div>

          {/* Day tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {DAYS.map(d => {
              const cnt = events.filter(e => e.days_of_week.includes(d.id)).length;
              return (
                <button key={d.id} onClick={() => setSelectedDay(d.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    selectedDay === d.id ? 'bg-[#00563F] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}>
                  <span>{d.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${selectedDay === d.id ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Event list */}
          <div className="space-y-3">
            {dayEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No events for this day. Use "Add Event" to create one.</div>
            ) : dayEvents.map(ev => (
              <div key={ev.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition">
                <div className="flex items-start space-x-4">
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center min-w-[68px]">
                    <span className="text-sm font-black font-mono text-white">{ev.start_time}</span>
                    <span className="text-[10px] text-slate-400 block">GMT</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{ev.event_name}</span>
                      {ev.approval_status === 'draft' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">Draft</span>}
                      {ev.approval_status === 'awaiting_principal' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">Awaiting Principal</span>}
                      {ev.approval_status === 'live_on_device' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Live on Device</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{ev.announcement_text || 'Standard bell chime'}</p>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                      <span>×{ev.repeat_count || 3}</span><span>&bull;</span><span>{ev.volume || 100}% vol</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end md:self-center">
                  <button onClick={() => playTestChime(ev.event_name, ev.announcement_text, ev.repeat_count || 3)} title="Test Play (chime + repeated voice announcement)" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"><Play className="w-3.5 h-3.5" /></button>
                  {ev.approval_status === 'draft' && (
                    <button onClick={() => submitEventForApproval(ev.id)} className="px-3 py-1.5 bg-[#00563F] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 transition">
                      <Send className="w-3.5 h-3.5" /><span>Submit</span>
                    </button>
                  )}
                  {/* Super Admin can also directly approve own drafts */}
                  {ev.approval_status === 'awaiting_principal' && (
                    <button
                      onClick={() => {
                        const approval = pendingApprovals.find(p => p.target_event_id === ev.id);
                        if (approval) approvePendingItem(approval.id);
                      }}
                      className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-700 text-emerald-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition border border-emerald-800"
                    >
                      <Check className="w-3.5 h-3.5" /><span>Approve</span>
                    </button>
                  )}
                  <button onClick={() => openEditModal(ev)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteEvent(ev.id)} className="p-2 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-800 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Audio upload */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <FileAudio className="w-4 h-4 text-[#F4511E]" />
              <h3 className="text-sm font-bold text-white">Stage Audio Announcement</h3>
            </div>
            {audioSuccess && (
              <div className="p-2.5 bg-emerald-950 border border-emerald-800 rounded-lg text-emerald-300 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" /><span>{audioSuccess}</span>
              </div>
            )}
            <form onSubmit={handleAudioUpload} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Announcement Title</label>
                <input type="text" required value={audioTitle} onChange={e => setAudioTitle(e.target.value)}
                  placeholder="e.g. End of Term Chime"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F4511E]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Duration (seconds)</label>
                <input type="number" min={5} max={180} value={audioDuration} onChange={e => setAudioDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#F4511E]" />
              </div>
              <button type="submit" className="px-4 py-2.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow">
                <Upload className="w-4 h-4" /><span>Stage & Submit</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: INVITATIONS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'invitations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center space-x-2 text-[#F4511E] text-xs font-bold mb-1">
                <Key className="w-4 h-4" /><span>Super Admin Exclusive</span>
              </div>
              <h3 className="text-base font-bold text-white">Invite Principal or Regulator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Single-use tokens. Recipients activate from the sign-in page.</p>
            </div>

            <form onSubmit={handleIssueInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['principal', 'regulator'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setInviteRole(r)}
                      className={`p-3 rounded-xl font-bold text-left border transition ${
                        inviteRole === r
                          ? r === 'principal' ? 'bg-emerald-950/80 border-emerald-500 text-white' : 'bg-orange-950/80 border-orange-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}>
                      <div className={`font-extrabold ${r === 'principal' ? 'text-emerald-400' : 'text-[#F4511E]'}`}>
                        {r === 'principal' ? 'Principal' : 'Schedule Regulator'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {r === 'principal' ? 'Oversight, approvals, emergency stop' : 'Timetables, audio, drafts'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Recipient Email</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder={`e.g. ${inviteRole}@${selectedSchool.code.toLowerCase()}.edu.gh`}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#F4511E]" />
              </div>

              <button type="submit" className="w-full py-3 bg-[#F4511E] hover:bg-[#D84315] text-white font-extrabold rounded-xl shadow-lg transition flex items-center justify-center space-x-2">
                <Send className="w-4 h-4" /><span>Generate Token</span>
              </button>
            </form>

            {generatedToken && (
              <div className="p-3 rounded-xl bg-orange-950/30 border border-orange-700/50 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-orange-400">
                  <span>Generated Token</span>
                  {copyOk && <span className="text-emerald-400">Copied!</span>}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-white">
                  <span>{generatedToken}</span>
                  <button onClick={() => copyToken(generatedToken)} className="p-1 hover:text-[#E6AD00]"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Token list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Issued Invitations for {selectedSchool.name} ({schoolInvitations.length})</h3>
            {schoolInvitations.length === 0 ? (
              <p className="text-xs text-slate-400">No invitations issued yet for this school.</p>
            ) : (
              schoolInvitations.map(inv => (
                <div key={inv.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{inv.email}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      inv.role === 'principal' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-orange-950 text-orange-300 border border-orange-800'
                    }`}>{inv.role}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="text-[#E6AD00]">{inv.token}</span>
                    <span>Expires: {inv.expires_at}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                    <span>{inv.is_used ? 'Account Activated' : 'Pending Activation'}</span>
                    <button onClick={() => revokeInvitation(inv.id)} className="text-rose-400 hover:underline font-bold">Revoke</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: AUDIT LOG                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Platform Audit Trail — {selectedSchool.name}</h3>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-slate-200">{log.action.replace(/_/g,' ')}</span>
                  <span className="text-slate-500 ml-2 font-mono text-[11px]">[{log.resource_type}]</span>
                  {log.metadata && (
                    <span className="text-slate-400 block font-mono text-[11px] mt-0.5">
                      {JSON.stringify(log.metadata).replace(/[{}"]/g,' ')}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500 flex-shrink-0 ml-4">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ADD / EDIT EVENT MODAL                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{editingEventId ? 'Edit Event' : 'Add New Timetable Event'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Event Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Science Lab Transition"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#F4511E]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Category</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value as EventCategory)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#F4511E]">
                    <option value="morning_assembly">Morning Assembly</option>
                    <option value="lesson_commencement">Lesson Commencement</option>
                    <option value="lesson_change">Lesson Change</option>
                    <option value="snack_break">Snack & Recess</option>
                    <option value="lunch_break">Lunch Break</option>
                    <option value="worship_time">Worship & Devotion</option>
                    <option value="closing_time">Closing Time</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Start Time</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-[#F4511E]" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(d => {
                    const active = formDays.includes(d.id);
                    return (
                      <button key={d.id} type="button"
                        onClick={() => setFormDays(active ? formDays.filter(id => id !== d.id) : [...formDays, d.id])}
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${active ? 'bg-[#00563F] text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'}`}>
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-300 mb-1">Voice Announcement</label>
                <textarea rows={2} value={formAnnouncement} onChange={e => setFormAnnouncement(e.target.value)}
                  placeholder="Announcement text read over PA system..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#F4511E]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Repetitions</label>
                  <select value={formRepeatCount} onChange={e => setFormRepeatCount(Number(e.target.value))}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#F4511E]">
                    <option value={1}>1× Once</option>
                    <option value={2}>2× Twice</option>
                    <option value={3}>3× Thrice (default)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Volume ({formVolume}%)</label>
                  <input type="range" min={40} max={100} value={formVolume} onChange={e => setFormVolume(Number(e.target.value))}
                    className="w-full mt-2 accent-[#F4511E]" />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition">Cancel</button>
              <button onClick={() => saveEvent(false)} className="px-4 py-2.5 bg-slate-800 text-amber-300 border border-amber-800/60 text-xs font-bold rounded-xl hover:bg-slate-700 transition">Save as Draft</button>
              <button onClick={() => saveEvent(true)} className="px-5 py-2.5 bg-[#00563F] hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition">Save & Approve Instantly</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Reject Submission</h3>
              <button onClick={() => setRejectModalId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (sent back to regulator as Draft)..."
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500" />
            <div className="flex justify-end space-x-3 pt-1">
              <button onClick={() => setRejectModalId(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">Cancel</button>
              <button onClick={() => { rejectPendingItem(rejectModalId, rejectReason || 'Rejected by Super Admin.'); setRejectModalId(null); setRejectReason(''); }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
