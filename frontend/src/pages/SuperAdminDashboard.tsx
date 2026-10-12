import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Building2,
  Smartphone,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Send,
  Key,
  ArrowRight,
  Shield,
  Calendar,
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
  UserCheck,
  Settings
} from 'lucide-react';
import { useBellState } from '../context/BellStateContext';
import { useAuth } from '../context/AuthContext';
import { Campus, School, SupportTicket, ScheduleEvent, EventCategory, UserRole } from '../types/database';
import { SchoolSettingsPanel } from '../components/SchoolSettingsPanel';
import { SchoolLogo } from '../components/SchoolLogo';
import { supabase } from '../lib/supabase';
import { formatCountdown, formatDateTimeInTimeZone, formatTimeInTimeZone, getNextScheduleOccurrence, getPreferredTimeZone, isValidIanaTimeZone } from '../lib/timezone';

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

type SchoolTab = 'overview' | 'timetable' | 'approvals' | 'device' | 'invitations' | 'audit' | 'settings';

// ─── Main Component ──────────────────────────────────────────────────────────

export const SuperAdminDashboard: React.FC = () => {
  const { user, currentSchool, currentCampus, invitations, refreshInvitations, createInvitation, revokeInvitation } = useAuth();
  const {
    playbackHistory,
    auditLogs,
    isBellsPaused,
    isEmergencyStopped,
    speakerConnected,
    isRingingNow,
    activeRingingEvent,
    lastSyncTime,
    // Regulator powers
    uploadAudioAnnouncement,
    // Principal powers
    togglePauseAllBells,
    triggerEmergencyStop,
    resumeFromEmergencyStop,
    playTestChime,
    stopRinging,
  } = useBellState();

  // ── Platform schools list ──
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'polling' | 'offline' | 'error'>('connecting');
  const [lastDataSyncAt, setLastDataSyncAt] = useState<Date | null>(null);
  const refreshPromise = useRef<Promise<void> | null>(null);
  const realtimeConnected = useRef(false);

  const refreshSharedRecords = useCallback(async (): Promise<void> => {
    if (refreshPromise.current) return refreshPromise.current;

    const refreshTask = (async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, code, timezone, country, region, city, address, default_open_time, default_close_time, logo_url, branding_primary, branding_secondary, branding_accent, is_active, created_at, updated_at')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (error) throw error;
        setSchools(data ?? []);
        await refreshInvitations();
        setLastDataSyncAt(new Date());
        setSyncError(null);
        setSyncStatus(realtimeConnected.current && navigator.onLine ? 'connected' : navigator.onLine ? 'polling' : 'offline');
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Unable to refresh school and invitation data.');
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      } finally {
        setSchoolsLoading(false);
      }
    })();

    refreshPromise.current = refreshTask;
    await refreshTask;
    refreshPromise.current = null;
  }, [refreshInvitations]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshDebounce: number | null = null;

    const refreshAfterChange = () => {
      if (refreshDebounce !== null) window.clearTimeout(refreshDebounce);
      refreshDebounce = window.setTimeout(() => {
        if (active) void refreshSharedRecords();
      }, 200);
    };

    const subscribe = () => {
      if (!active || !navigator.onLine) return;
      setSyncStatus('connecting');
      channel = supabase
        .channel(`super-admin-live-data-${user?.id ?? 'unknown'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, refreshAfterChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, refreshAfterChange)
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            realtimeConnected.current = true;
            setSyncStatus('connected');
            void refreshSharedRecords();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            realtimeConnected.current = false;
            setSyncStatus(navigator.onLine ? 'polling' : 'offline');
            setSyncError('Live updates are unavailable; BellNexa will retry and periodically refresh this data.');
          }
        });
    };

    const handleOffline = () => {
      realtimeConnected.current = false;
      setSyncStatus('offline');
      setSyncError('You are offline. Showing the last data loaded; updates will resume when you reconnect.');
    };
    const handleOnline = () => {
      setSyncError(null);
      void refreshSharedRecords();
      if (channel) {
        const oldChannel = channel;
        channel = null;
        void supabase.removeChannel(oldChannel).then(subscribe).catch((error: unknown) => {
          if (!active) return;
          setSyncStatus('polling');
          setSyncError(error instanceof Error ? error.message : 'Unable to restart live updates.');
          subscribe();
        });
      } else {
        subscribe();
      }
    };
    const handleFocus = () => {
      if (navigator.onLine) void refreshSharedRecords();
    };

    void refreshSharedRecords();
    subscribe();
    const pollTimer = window.setInterval(() => {
      if (!realtimeConnected.current && navigator.onLine) void refreshSharedRecords();
    }, 60_000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      realtimeConnected.current = false;
      window.clearInterval(pollTimer);
      if (refreshDebounce !== null) window.clearTimeout(refreshDebounce);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshSharedRecords, user?.id]);

  // ── Navigation state ──
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<SchoolTab>('overview');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [campusLoadError, setCampusLoadError] = useState<string | null>(null);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [activeScheduleRevision, setActiveScheduleRevision] = useState<number | null>(null);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [createSchoolError, setCreateSchoolError] = useState<string | null>(null);
  const [createSchoolForm, setCreateSchoolForm] = useState({
    name: '',
    code: '',
    country: '',
    region: '',
    city: '',
    address: '',
    timezone: 'UTC',
    logo_url: '',
    default_open_time: '07:00',
    default_close_time: '16:00',
  });

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

  // ── Invitation state ──
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<UserRole, 'super_admin'>>('principal');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  // ── Audio state ──
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDuration, setAudioDuration] = useState('30');
  const [audioSuccess, setAudioSuccess] = useState<string | null>(null);

  // ── Support tickets ──
  const [supportTickets] = useState<SupportTicket[]>([]);

  // ── Clock for countdown ──
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const selectedCampus = campuses.find(campus => campus.id === selectedCampusId) ?? null;
  const liveEvents = scheduleEvents.filter(e => e.approval_status === 'live_on_device' && e.is_enabled);
  const displayTimeZone = getPreferredTimeZone(
    user?.preferred_timezone,
    selectedCampusId ? campuses.find(campus => campus.id === selectedCampusId)?.timezone : currentCampus?.timezone,
    selectedSchool?.timezone ?? currentSchool?.timezone,
  );
  const scheduleTimeZone = selectedCampus?.timezone ?? selectedSchool?.timezone ?? displayTimeZone;
  const sortedLive = [...liveEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextBellOccurrence = sortedLive
    .map(event => ({
      event,
      occurrence: getNextScheduleOccurrence(event.start_time, event.days_of_week, scheduleTimeZone, now),
    }))
    .filter((item): item is { event: ScheduleEvent; occurrence: Date } => item.occurrence !== null)
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())[0];
  const nextBell = nextBellOccurrence?.event;

  const getCountdown = () => {
    return formatCountdown(nextBellOccurrence?.occurrence ?? null, now);
  };

  const updateCampusEvent = async (eventId: string, values: Partial<ScheduleEvent>) => {
    if (!selectedSchool || !selectedCampus || !activeScheduleId) {
      throw new Error('Select a campus with an active timetable first.');
    }
    const { data, error } = await supabase
      .from('schedule_events')
      .update(values)
      .eq('id', eventId)
      .eq('school_id', selectedSchool.id)
      .eq('campus_id', selectedCampus.id)
      .eq('schedule_id', activeScheduleId)
      .select('*')
      .single();
    if (error) throw error;
    setScheduleEvents(previous => previous.map(event => event.id === eventId ? data as ScheduleEvent : event));
    setActiveScheduleRevision(previous => previous === null ? null : previous + 1);
  };

  const submitCampusEvent = (eventId: string) => {
    void updateCampusEvent(eventId, { approval_status: 'awaiting_principal' })
      .catch(error => setScheduleLoadError(error instanceof Error ? error.message : 'Unable to submit this event.'));
  };

  const approveCampusEvent = (eventId: string) => {
    void updateCampusEvent(eventId, { approval_status: 'live_on_device' })
      .catch(error => setScheduleLoadError(error instanceof Error ? error.message : 'Unable to approve this event.'));
  };

  const rejectCampusEvent = (eventId: string, reason: string) => {
    void updateCampusEvent(eventId, {
      approval_status: 'draft',
      change_summary: reason,
    }).catch(error => setScheduleLoadError(error instanceof Error ? error.message : 'Unable to return this event to draft.'));
  };

  const removeCampusEvent = (eventId: string) => {
    if (!selectedSchool || !selectedCampus || !activeScheduleId) return;
    const remove = async () => {
      const { data, error } = await supabase
        .from('schedule_events')
        .delete()
        .eq('id', eventId)
        .eq('school_id', selectedSchool.id)
        .eq('campus_id', selectedCampus.id)
        .eq('schedule_id', activeScheduleId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The event was not deleted; check your access to this campus.');
      setScheduleEvents(previous => previous.filter(event => event.id !== eventId));
      setActiveScheduleRevision(previous => previous === null ? null : previous + 1);
    };
    void remove().catch(error => setScheduleLoadError(error instanceof Error ? error.message : 'Unable to delete this event.'));
  };

  // ── Helpers ──
  useEffect(() => {
    let active = true;
    if (!selectedSchool) {
      setCampuses([]);
      setSelectedCampusId('');
      setCampusLoadError(null);
      return;
    }
    void supabase
      .from('campuses')
      .select('id, school_id, name, country, region, city, address, timezone, logo_url, default_open_time, default_close_time, settings, is_default, is_active, created_at, updated_at')
      .eq('school_id', selectedSchool.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setCampusLoadError(error.message);
          return;
        }
        const nextCampuses = data ?? [];
        setCampuses(nextCampuses);
        setSelectedCampusId(current => nextCampuses.some(campus => campus.id === current)
          ? current
          : nextCampuses[0]?.id ?? '');
      });
    return () => { active = false; };
  }, [selectedSchool]);

  useEffect(() => {
    let active = true;
    if (!selectedSchool || !selectedCampus) {
      setScheduleEvents([]);
      setActiveScheduleId(null);
      setActiveScheduleRevision(null);
      setScheduleLoadError(null);
      return;
    }

    setScheduleEvents([]);
    setActiveScheduleId(null);
    setActiveScheduleRevision(null);
    setScheduleLoadError(null);
    const loadCampusSchedule = async () => {
      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .select('id, revision')
        .eq('school_id', selectedSchool.id)
        .eq('campus_id', selectedCampus.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (scheduleError) throw scheduleError;
      if (!active) return;
      if (!schedule) {
        setScheduleEvents([]);
        setActiveScheduleId(null);
        setActiveScheduleRevision(null);
        return;
      }

      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('school_id', selectedSchool.id)
        .eq('campus_id', selectedCampus.id)
        .eq('schedule_id', schedule.id)
        .order('start_time', { ascending: true });
      if (error) throw error;
      if (!active) return;
      setActiveScheduleId(schedule.id);
      setActiveScheduleRevision(schedule.revision);
      setScheduleEvents((data || []) as ScheduleEvent[]);
    };
    void loadCampusSchedule().catch(error => {
      if (active) setScheduleLoadError(error instanceof Error ? error.message : 'Unable to load this campus timetable.');
    });
    return () => { active = false; };
  }, [selectedCampus?.id, selectedSchool?.id]);

  const handleIssueInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim() || !selectedSchool) return;
    setInviteError(null);
    setInviteMessage(null);
    setInviteBusy(true);
    try {
      if (!selectedCampus) throw new Error('Select a campus for this invitation.');
      await createInvitation(inviteEmail.trim(), inviteName.trim(), inviteRole, selectedSchool.id, selectedCampus.id);
      setInviteEmail('');
      setInviteName('');
      setInviteMessage('Invitation created. The invitation email includes its one-time token. Confirm that your Supabase invite email template includes the invitation_token field.');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Unable to send the invitation.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    setInviteError(null);
    setInviteMessage(null);
    try {
      await revokeInvitation(id);
      setInviteMessage('Invitation revoked. Its pending account has been removed.');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Unable to revoke the invitation.');
    }
  };

  const handleCampusesUpdated = useCallback((updatedCampuses: Campus[]) => {
    setCampuses(updatedCampuses);
    setSelectedCampusId(current => updatedCampuses.some(campus => campus.id === current)
      ? current
      : updatedCampuses[0]?.id ?? '');
  }, []);

  const handleCreateSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateSchoolError(null);
    const timezone = createSchoolForm.timezone.trim();
    if (!isValidIanaTimeZone(timezone)) {
      setCreateSchoolError('Enter a valid IANA time zone, such as Europe/London.');
      return;
    }
    if (!createSchoolForm.name.trim() || !createSchoolForm.code.trim() || !createSchoolForm.country.trim()) {
      setCreateSchoolError('School name, code, and country are required.');
      return;
    }
    setIsCreatingSchool(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .insert({
          name: createSchoolForm.name.trim(),
          code: createSchoolForm.code.trim().toUpperCase(),
          country: createSchoolForm.country.trim(),
          region: createSchoolForm.region.trim() || null,
          city: createSchoolForm.city.trim() || null,
          address: createSchoolForm.address.trim() || null,
          timezone,
          logo_url: createSchoolForm.logo_url.trim() || null,
          default_open_time: createSchoolForm.default_open_time,
          default_close_time: createSchoolForm.default_close_time,
          branding_primary: '#0A1B45',
          branding_secondary: '#087F9B',
          branding_accent: '#12C8E8',
        })
        .select('id, name, code, timezone, country, region, city, address, default_open_time, default_close_time, logo_url, branding_primary, branding_secondary, branding_accent, is_active, created_at, updated_at')
        .single();
      if (error) throw error;
      setSchools(current => [...current, data].sort((left, right) => left.name.localeCompare(right.name)));
      setCreateSchoolForm({
        name: '',
        code: '',
        country: '',
        region: '',
        city: '',
        address: '',
        timezone: 'UTC',
        logo_url: '',
        default_open_time: '07:00',
        default_close_time: '16:00',
      });
      setIsCreateSchoolOpen(false);
      setInviteMessage('School created with a main campus and a separate timetable.');
    } catch (error) {
      setCreateSchoolError(error instanceof Error ? error.message : 'Unable to create the school.');
    } finally {
      setIsCreatingSchool(false);
    }
  };

  const openAddModal = () => {
    if (!selectedSchool || !selectedCampus || !activeScheduleId) {
      setScheduleLoadError('An active timetable is not available for this campus yet.');
      return;
    }
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
    if (!selectedSchool || !selectedCampus || !activeScheduleId) {
      setScheduleLoadError('An active timetable is not available for this campus yet.');
      return;
    }
    const save = async () => {
      const values = {
        ...(editingEventId ? { id: editingEventId } : {}),
        schedule_id: activeScheduleId,
        school_id: selectedSchool.id,
        campus_id: selectedCampus.id,
        event_name: formName.trim(),
        category: formCategory,
        start_time: formTime,
        days_of_week: formDays,
        is_enabled: true,
        announcement_text: formAnnouncement,
        language: 'en',
        volume: formVolume,
        repeat_count: formRepeatCount,
        approval_status: submitNow ? 'awaiting_principal' : 'draft',
        change_summary: editingEventId ? `Edited by ${user?.full_name || 'Super Admin'}` : 'Created by Super Admin',
        last_edited_by: user?.full_name || 'Super Admin',
      };
      const { data, error } = await supabase
        .from('schedule_events')
        .upsert(values)
        .select('*')
        .single();
      if (error) throw error;
      if (!data) throw new Error('The timetable event was not returned after saving.');
      setScheduleEvents(previous => [...previous.filter(event => event.id !== data.id), data as ScheduleEvent]
        .sort((left, right) => left.start_time.localeCompare(right.start_time)));
      setActiveScheduleRevision(previous => previous === null ? null : previous + 1);
      setIsAddModalOpen(false);
      setScheduleLoadError(null);
    };
    void save().catch(error => setScheduleLoadError(error instanceof Error ? error.message : 'Unable to save this timetable event.'));
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
  const pendingScheduleEvents = scheduleEvents.filter(event => event.approval_status === 'awaiting_principal');
  const pendingCount = pendingScheduleEvents.length;
  const draftCount   = scheduleEvents.filter(e => e.approval_status === 'draft').length;
  const liveCount    = liveEvents.length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: GLOBAL OVERVIEW (no school selected)
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedSchool) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center space-x-2 text-[#12C8E8] text-xs font-bold mb-1">
                <Shield className="w-4 h-4" />
                <span className="uppercase tracking-wider">Super Admin — Platform Governance</span>
              </div>
              <h1 className="text-2xl font-black text-white">Manage schools</h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure schools worldwide, including each school’s time zone, operating hours, and campuses.
              </p>
            </div>
            <button
              onClick={() => { setCreateSchoolError(null); setIsCreateSchoolOpen(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-600"
            >
              <Plus className="h-4 w-4" /> Add school
            </button>
          </div>
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
          {schoolsLoading && (
            <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
              Loading registered schools…
            </p>
          )}
          {syncError && (
            <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-xs text-rose-200">
              {syncError}
            </p>
          )}
          <p role="status" className="text-[11px] text-slate-400 px-1">
            {syncStatus === 'connected'
              ? 'Live updates connected'
              : syncStatus === 'polling'
                ? 'Live updates reconnecting; periodic refresh is active'
                : syncStatus === 'offline'
                  ? 'Offline; showing last loaded data'
                  : syncStatus === 'error'
                    ? 'Could not refresh shared data'
                    : 'Connecting to live updates…'}
            {lastDataSyncAt && ` · Last updated ${formatTimeInTimeZone(lastDataSyncAt, displayTimeZone)} (${displayTimeZone})`}
          </p>
          {!schoolsLoading && !syncError && schools.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
              No schools are registered yet. Add a school to create its main campus and timetable.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {schools.map((school) => (
              <div key={school.id} className="text-left bg-slate-900 border border-slate-800 hover:border-[#12C8E8] hover:shadow-lg hover:shadow-cyan-950/30 rounded-2xl p-5 transition-all duration-150 space-y-4">
                <button
                  onClick={() => { setSelectedSchool(school); setActiveTab('overview'); }}
                  className="group w-full text-left space-y-4"
                >
                <SchoolLogo school={school} className="h-12 w-12" />
                {/* School colour swatch + code */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border"
                    style={{ color: school.branding_primary, borderColor: school.branding_primary + '60', background: school.branding_primary + '18' }}
                  >
                    {school.code}
                  </span>
                </div>

                {/* School name */}
                <div>
                  <h3 className="text-base font-black text-white group-hover:text-[#12C8E8] transition-colors">
                    {school.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {[school.city, school.region, school.country].filter(Boolean).join(', ')} · {school.timezone}
                  </p>
                </div>

                {isCreateSchoolOpen && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
                    <form onSubmit={handleCreateSchool} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">Register a school</h2>
                        <button type="button" onClick={() => setIsCreateSchoolOpen(false)} className="p-2 text-slate-400 hover:text-white" aria-label="Close school form"><X className="h-4 w-4" /></button>
                      </div>
                      {createSchoolError && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200">{createSchoolError}</p>}
                      <p className="text-xs text-slate-400">The time zone must be an IANA identifier. A main campus and an empty timetable will be created automatically.</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ['name', 'School name', true],
                          ['code', 'School code', true],
                          ['country', 'Country', true],
                          ['region', 'Region or state', false],
                          ['city', 'City or locality', false],
                          ['timezone', 'IANA time zone', true],
                          ['address', 'Street address', false],
                          ['logo_url', 'School logo URL', false],
                        ] as const).map(([key, label, required]) => (
                          <label key={key} className="text-xs font-semibold text-slate-300">
                            {label}
                            <input
                              required={required}
                              type={key === 'logo_url' ? 'url' : 'text'}
                              placeholder={key === 'timezone' ? 'Europe/London' : ''}
                              value={createSchoolForm[key]}
                              onChange={event => setCreateSchoolForm({ ...createSchoolForm, [key]: event.target.value })}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </label>
                        ))}
                        <label className="text-xs font-semibold text-slate-300">Default opening time ({createSchoolForm.timezone})
                          <input required type="time" value={createSchoolForm.default_open_time} onChange={event => setCreateSchoolForm({ ...createSchoolForm, default_open_time: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                        </label>
                        <label className="text-xs font-semibold text-slate-300">Default closing time ({createSchoolForm.timezone})
                          <input required type="time" value={createSchoolForm.default_close_time} onChange={event => setCreateSchoolForm({ ...createSchoolForm, default_close_time: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                        </label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsCreateSchoolOpen(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200">Cancel</button>
                        <button disabled={isCreatingSchool} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                          {isCreatingSchool ? 'Creating…' : 'Create school'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {activeTab === 'settings' && selectedSchool && (
                  <SchoolSettingsPanel
                    school={selectedSchool}
                    onUpdated={updatedSchool => {
                      setSelectedSchool(updatedSchool);
                      setSchools(current => current.map(school => school.id === updatedSchool.id ? updatedSchool : school));
                    }}
                    onCampusesUpdated={handleCampusesUpdated}
                  />
                )}

                {/* Device quick status */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-medium">Device Online</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 group-hover:text-[#12C8E8] transition-colors font-bold">
                    <span>Enter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                </button>
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
                <span className="font-mono text-slate-500">{formatDateTimeInTimeZone(new Date(log.created_at), displayTimeZone)}</span>
              </div>
            ))}
          </div>
        </div>

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
    { id: 'settings',     label: 'School Settings',     icon: Settings },
  ];

  const dayEvents = scheduleEvents
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

          <SchoolLogo school={selectedSchool} className="hidden h-12 w-12 sm:inline-flex" />

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#12C8E8]/15 text-[#12C8E8] border border-[#12C8E8]/30">
                Super Admin Full Access
              </span>
              <span className="text-[10px] font-mono text-slate-400">Rev #{activeScheduleRevision ?? 0}</span>
            </div>
            <h1 className="text-xl font-black text-white mt-0.5">{selectedSchool.name}</h1>
            <p className="text-[11px] text-slate-400">
              {selectedSchool.code} · {[selectedSchool.city, selectedSchool.country].filter(Boolean).join(', ')} · {scheduleTimeZone}
            </p>
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
                ? 'bg-[#0A1B45] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[#12C8E8] text-white font-extrabold">
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
                <Clock className="w-4 h-4 text-[#54DDF4]" />
              </div>
              <div className="text-lg font-black text-white">{nextBell?.event_name || 'None today'}</div>
              <div className="text-3xl font-black font-mono text-[#54DDF4]">{getCountdown()}</div>
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
                  <span className="font-mono text-[#54DDF4]">#{activeScheduleRevision ?? 0}</span>
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
            <span className="text-xs font-mono font-bold text-slate-400">{pendingScheduleEvents.length} pending</span>
          </div>

          {pendingScheduleEvents.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-white">Nothing pending — all changes are live or drafted.</p>
            </div>
          ) : (
            pendingScheduleEvents.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <Calendar className="w-5 h-5 text-[#12C8E8]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Timetable submission &bull; {formatDateTimeInTimeZone(new Date(item.updated_at || item.created_at), scheduleTimeZone)}
                      </div>
                      <h3 className="text-base font-bold text-white">{item.event_name} ({item.start_time})</h3>
                      <p className="text-xs text-slate-400">By {item.last_edited_by || 'Campus regulator'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  {item.change_summary || item.announcement_text || 'Review the submitted schedule change.'}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-1">
                  <button
                    onClick={() => { setRejectModalId(item.id); setRejectReason(''); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-300 border border-slate-700 hover:border-red-800 rounded-xl text-xs font-bold text-slate-300 transition flex items-center space-x-1.5"
                  >
                    <X className="w-4 h-4" /><span>Reject</span>
                  </button>
                  <button
                    onClick={() => approveCampusEvent(item.id)}
                    className="px-5 py-2.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white rounded-xl text-xs font-black shadow-lg transition flex items-center space-x-2"
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

          {scheduleLoadError && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {scheduleLoadError}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold text-white">Weekly Timetable — {DAYS.find(d => d.id === selectedDay)?.name}</h2>
            <div className="flex items-center space-x-2">
              <button onClick={() => playTestChime('Westminster Bell Test')} className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition">
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /><span>Test Play</span>
              </button>
              <button onClick={openAddModal} className="flex items-center space-x-1.5 px-4 py-2 bg-[#12C8E8] hover:bg-[#087F9B] text-white rounded-xl text-xs font-black shadow-md transition">
                <Plus className="w-4 h-4" /><span>Add Event</span>
              </button>
            </div>
          </div>

          {/* Day tabs */}
          <div className="flex space-x-2 overflow-x-auto">
            {DAYS.map(d => {
              const cnt = scheduleEvents.filter(e => e.days_of_week.includes(d.id)).length;
              return (
                <button key={d.id} onClick={() => setSelectedDay(d.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    selectedDay === d.id ? 'bg-[#0A1B45] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                    <span className="text-[10px] text-slate-400 block">{scheduleTimeZone}</span>
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
                    <button onClick={() => submitCampusEvent(ev.id)} className="px-3 py-1.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white rounded-lg text-xs font-bold flex items-center space-x-1 transition">
                      <Send className="w-3.5 h-3.5" /><span>Submit</span>
                    </button>
                  )}
                  {/* Super Admin can also directly approve own drafts */}
                  {ev.approval_status === 'awaiting_principal' && (
                    <button
                      onClick={() => approveCampusEvent(ev.id)}
                      className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-700 text-emerald-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition border border-emerald-800"
                    >
                      <Check className="w-3.5 h-3.5" /><span>Approve</span>
                    </button>
                  )}
                  <button onClick={() => openEditModal(ev)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeCampusEvent(ev.id)} className="p-2 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 hover:border-red-800 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Audio upload */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <FileAudio className="w-4 h-4 text-[#12C8E8]" />
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#12C8E8]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Duration (seconds)</label>
                <input type="number" min={5} max={180} value={audioDuration} onChange={e => setAudioDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#12C8E8]" />
              </div>
              <button type="submit" className="px-4 py-2.5 bg-[#12C8E8] hover:bg-[#087F9B] text-white rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow">
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
              <div className="flex items-center space-x-2 text-[#12C8E8] text-xs font-bold mb-1">
                <Key className="w-4 h-4" /><span>Invitation Management</span>
              </div>
              <h3 className="text-base font-bold text-white">Invite an authorised user</h3>
              <p className="text-xs text-slate-400 mt-0.5">The invitation is linked to one campus, expires after one hour, and can only be activated once.</p>
            </div>

            <form onSubmit={handleIssueInvite} className="space-y-4 text-xs">
              <div>
                <label htmlFor="invite-role" className="block font-bold text-slate-300 mb-1">Role</label>
                <select id="invite-role" value={inviteRole} onChange={event => setInviteRole(event.target.value as Exclude<UserRole, 'super_admin'>)} className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-white">
                  <option value="principal">Principal</option>
                  <option value="regulator">Schedule Regulator</option>
                  <option value="admin">School Administrator</option>
                  <option value="support">Support</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div>
                <label htmlFor="invite-campus" className="block font-bold text-slate-300 mb-1">Campus</label>
                <select
                  id="invite-campus"
                  required
                  value={selectedCampusId}
                  onChange={event => setSelectedCampusId(event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-white"
                >
                  <option value="">Select a campus</option>
                  {campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name} · {campus.timezone}</option>)}
                </select>
                {campusLoadError && <p role="alert" className="mt-1 text-rose-300">{campusLoadError}</p>}
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1" htmlFor="invite-name">Recipient Name</label>
                <input id="invite-name" type="text" required maxLength={120} value={inviteName} onChange={e => setInviteName(e.target.value)}
                  placeholder="Full name"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#12C8E8]" />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1" htmlFor="invite-email">Recipient Email</label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  id="invite-email" autoComplete="email"
                  placeholder="name@example.com"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#12C8E8]" />
              </div>

              <button type="submit" disabled={inviteBusy || !selectedCampus} className="w-full py-3 bg-[#12C8E8] hover:bg-[#087F9B] disabled:opacity-60 text-white font-extrabold rounded-xl shadow-lg transition flex items-center justify-center space-x-2">
                <Send className="w-4 h-4" /><span>{inviteBusy ? 'Sending invitation…' : 'Send secure invitation'}</span>
              </button>
            </form>

            {inviteError && (
              <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{inviteError}</p>
            )}
            {inviteMessage && (
              <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-200">{inviteMessage}</p>
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
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">{inv.role}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Expires: {formatDateTimeInTimeZone(
                      new Date(inv.expires_at),
                      campuses.find(campus => campus.id === inv.campus_id)?.timezone ?? selectedSchool.timezone,
                    )} ({campuses.find(campus => campus.id === inv.campus_id)?.timezone ?? selectedSchool.timezone})</span>
                    <span>{inv.is_used ? 'Activated' : inv.revoked_at ? 'Revoked' : Date.parse(inv.expires_at) <= now.getTime() ? 'Expired' : 'Pending'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Ref {inv.reference} · {campuses.find(campus => campus.id === inv.campus_id)?.name ?? 'Campus'}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                    <span>{inv.is_used ? 'Account activated' : 'Activation by email'}</span>
                    {!inv.is_used && !inv.revoked_at && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Revoke the invitation for ${inv.email}? Its pending account will be removed.`)) {
                            void handleRevokeInvitation(inv.id);
                          }
                        }}
                        className="text-rose-400 hover:underline font-bold"
                      >
                        Revoke
                      </button>
                    )}
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
                  {formatDateTimeInTimeZone(new Date(log.created_at), displayTimeZone)} ({displayTimeZone})
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
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Category</label>
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value as EventCategory)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]">
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
                  <label className="block font-bold text-slate-300 mb-1">Start Time ({scheduleTimeZone})</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-[#12C8E8]" />
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
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${active ? 'bg-[#0A1B45] text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'}`}>
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
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Repetitions</label>
                  <select value={formRepeatCount} onChange={e => setFormRepeatCount(Number(e.target.value))}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]">
                    <option value={1}>1× Once</option>
                    <option value={2}>2× Twice</option>
                    <option value={3}>3× Thrice (default)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Volume ({formVolume}%)</label>
                  <input type="range" min={40} max={100} value={formVolume} onChange={e => setFormVolume(Number(e.target.value))}
                    className="w-full mt-2 accent-[#12C8E8]" />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition">Cancel</button>
              <button onClick={() => saveEvent(false)} className="px-4 py-2.5 bg-slate-800 text-amber-300 border border-amber-800/60 text-xs font-bold rounded-xl hover:bg-slate-700 transition">Save as Draft</button>
              <button onClick={() => saveEvent(true)} className="px-5 py-2.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white text-xs font-black rounded-xl transition">Save & Approve Instantly</button>
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
              <button onClick={() => { rejectCampusEvent(rejectModalId, rejectReason || 'Rejected by Super Admin.'); setRejectModalId(null); setRejectReason(''); }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
