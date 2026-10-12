import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  ScheduleEvent, 
  PendingApproval, 
  PlaybackEvent, 
  AuditLog
} from '../types/database';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface BellStateContextType {
  events: ScheduleEvent[];
  pendingApprovals: PendingApproval[];
  playbackHistory: PlaybackEvent[];
  auditLogs: AuditLog[];
  isBellsPaused: boolean;
  isEmergencyStopped: boolean;
  speakerConnected: boolean;
  isRingingNow: boolean;
  activeRingingEvent: string | null;
  deviceOnline: boolean;
  lastSyncTime: string;
  scheduleLoadError: string | null;
  scheduleRevision: number;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  setSpeechVoice: (voiceURI: string) => void;

  // Actions for Regulator
  createDraftEvent: (event: Omit<ScheduleEvent, 'id' | 'created_at' | 'approval_status'>) => void;
  updateEventAsDraft: (id: string, updates: Partial<ScheduleEvent>) => void;
  submitEventForApproval: (id: string) => void;
  deleteEvent: (id: string) => void;
  uploadAudioAnnouncement: (title: string, duration: number, filePlaceholder: string) => void;

  // Actions for Principal
  approvePendingItem: (approvalId: string) => void;
  rejectPendingItem: (approvalId: string, reason?: string) => void;
  togglePauseAllBells: () => void;
  triggerEmergencyStop: () => void;
  resumeFromEmergencyStop: () => void;

  // Phone / Hardware Controls
  toggleSpeakerConnection: () => void;
  playTestChime: (eventName?: string, announcementText?: string, repeatCount?: number) => void;
  speakAnnouncement: (text: string) => void;
  stopRinging: () => void;
}

// Initial Events with Vilac Pilot Settings
const INITIAL_EVENTS: ScheduleEvent[] = [
  {
    id: 'evt-1',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Morning Assembly Bell',
    category: 'morning_assembly',
    start_time: '07:30',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    announcement_text: 'Good morning students and staff. Please proceed to the assembly courtyard for morning devotion.',
    language: 'en',
    volume: 100,
    repeat_count: 3,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'evt-2',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Period 1 Commencement',
    category: 'lesson_commencement',
    start_time: '08:00',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    announcement_text: 'Period 1 has commenced. All students must be seated in their classrooms.',
    language: 'en',
    volume: 95,
    repeat_count: 3,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'evt-3',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Snack & Recess Break',
    category: 'snack_break',
    start_time: '10:30',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    announcement_text: 'Morning break time. Please observe orderly conduct in the canteen and courtyards.',
    language: 'en',
    volume: 90,
    repeat_count: 3,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'evt-4',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Lunch Break Bell (Adjusted)',
    category: 'lunch_break',
    start_time: '12:45',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    announcement_text: 'Lunch break has commenced. Enjoy your meal in designated dining spaces.',
    language: 'en',
    volume: 95,
    repeat_count: 3,
    approval_status: 'awaiting_principal',
    change_summary: 'Shifted start time from 12:30 to 12:45 for senior mock exams.',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'evt-5',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Closing & Dismissal Bell',
    category: 'closing_time',
    start_time: '15:30',
    days_of_week: [1, 2, 3, 4, 5],
    is_enabled: true,
    announcement_text: 'Classes have concluded for today. Bus boarding in progress at the north gate.',
    language: 'en',
    volume: 100,
    repeat_count: 3,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-6',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Friday Praise & Worship',
    category: 'worship_time',
    start_time: '14:00',
    days_of_week: [5],
    is_enabled: true,
    announcement_text: 'All students assemble in the main auditorium for weekly praise and worship.',
    language: 'en',
    volume: 95,
    repeat_count: 2,
    approval_status: 'draft',
    change_summary: 'New proposed Friday afternoon devotional period.',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  // ── Weekend (Boarders) Events ──────────────────────────────────────────
  {
    id: 'evt-7',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Saturday Boarders\' Morning Assembly',
    category: 'morning_assembly',
    start_time: '08:00',
    days_of_week: [6],
    is_enabled: true,
    announcement_text: 'Good morning boarders. Please assemble in the courtyard for Saturday morning roll call and devotion.',
    language: 'en',
    volume: 100,
    repeat_count: 3,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-8',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Saturday Boarders\' Prep & Study',
    category: 'lesson_commencement',
    start_time: '09:00',
    days_of_week: [6],
    is_enabled: true,
    announcement_text: 'Saturday prep has begun. Boarders report to the library and designated study areas.',
    language: 'en',
    volume: 90,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-9',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Saturday Boarders\' Lunch',
    category: 'lunch_break',
    start_time: '12:30',
    days_of_week: [6],
    is_enabled: true,
    announcement_text: 'Lunch is now being served in the dining hall. Boarders please proceed in an orderly manner.',
    language: 'en',
    volume: 95,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-10',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Saturday Evening Prep',
    category: 'lesson_change',
    start_time: '17:00',
    days_of_week: [6],
    is_enabled: true,
    announcement_text: 'Evening prep for boarders. Please settle in your study areas quietly.',
    language: 'en',
    volume: 90,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-11',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Sunday Chapel Service',
    category: 'worship_time',
    start_time: '09:00',
    days_of_week: [7],
    is_enabled: true,
    announcement_text: 'All boarders and staff proceed to the chapel for Sunday morning worship service.',
    language: 'en',
    volume: 100,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-12',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Sunday Boarders\' Brunch',
    category: 'lunch_break',
    start_time: '12:00',
    days_of_week: [7],
    is_enabled: true,
    announcement_text: 'Sunday brunch is served in the dining hall. Boarders please proceed to the dining area.',
    language: 'en',
    volume: 95,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'evt-13',
    schedule_id: 'sched-vilac-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Sunday Evening Prep',
    category: 'lesson_change',
    start_time: '18:00',
    days_of_week: [7],
    is_enabled: true,
    announcement_text: 'Sunday evening prep. Boarders prepare for the week ahead in the study areas.',
    language: 'en',
    volume: 90,
    repeat_count: 2,
    approval_status: 'live_on_device',
    last_edited_by: 'Emmanuel Osei (Regulator)',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  }
];

const INITIAL_PENDING_APPROVALS: PendingApproval[] = [
  {
    id: 'appr-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    type: 'timetable_edit',
    title: 'Lunch Break Shift (+15 mins)',
    description: 'Modified Lunch Break Bell start time from 12:30 to 12:45 to accommodate Senior Secondary mock examinations.',
    target_event_id: 'evt-4',
    submitted_by: 'regulator@vilac.edu.gh',
    submitted_by_name: 'Emmanuel Osei (Schedule Regulator)',
    submitted_at: '2 hours ago',
    status: 'pending',
  },
  {
    id: 'appr-2',
    school_id: '00000000-0000-0000-0000-000000000001',
    type: 'audio_upload',
    title: 'Mid-Term Exam Silence Protocol Announcement',
    description: 'Uploaded high-fidelity broadcast audio: "Strict exam silence requested across Blocks A, B, and C."',
    audio_title: 'Exam_Silence_Protocol_2026.mp3',
    audio_file: 'audio/exam_silence.mp3',
    submitted_by: 'regulator@vilac.edu.gh',
    submitted_by_name: 'Emmanuel Osei (Schedule Regulator)',
    submitted_at: '45 mins ago',
    status: 'pending',
  }
];

const INITIAL_PLAYBACK_HISTORY: PlaybackEvent[] = [
  {
    id: 'pb-1',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Morning Assembly Bell',
    category: 'morning_assembly',
    played_at: 'Today, 07:30:00 AM',
    duration_seconds: 38,
    volume_level: 100,
    status: 'completed',
  },
  {
    id: 'pb-2',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Period 1 Commencement',
    category: 'lesson_commencement',
    played_at: 'Today, 08:00:00 AM',
    duration_seconds: 24,
    volume_level: 95,
    status: 'completed',
  },
  {
    id: 'pb-3',
    school_id: '00000000-0000-0000-0000-000000000001',
    event_name: 'Snack & Recess Break',
    category: 'snack_break',
    played_at: 'Today, 10:30:00 AM',
    duration_seconds: 32,
    volume_level: 90,
    status: 'completed',
  }
];

const DEMO_AUDIT_SEEDED_AT = Date.now();

const BellStateContext = createContext<BellStateContextType | undefined>(undefined);

// Web Audio chime synthesizer for real sound feedback in browser
const playChimeSound = () => {
  try {
    const AudioContextClass = window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play Westminster 4-tone chime: F4, A4, G4, C4
    const notes = [349.23, 440.0, 392.0, 261.63];
    const startTime = ctx.currentTime + 0.05;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.45);

      gain.gain.setValueAtTime(0, startTime + index * 0.45);
      gain.gain.linearRampToValueAtTime(0.3, startTime + index * 0.45 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + index * 0.45 + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + index * 0.45);
      osc.stop(startTime + index * 0.45 + 0.75);
    });
  } catch (err) {
    console.warn('Audio playback not allowed or not supported:', err);
  }
};

// Cached preferred voice so we don't re-scan voices on every announcement.
let cachedPreferredVoice: SpeechSynthesisVoice | null = null;
let selectedVoiceURI: string | null = null;
let speechPlaybackId = 0;
let speechRepeatTimer: number | null = null;

// Prefer Ghanaian English when installed, then a recognizable British male voice.
const pickPreferredVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  if (!voices || voices.length === 0) return null;

  const enGhVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en-gh'));
  const enGbVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en-gb'));
  const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  if (enGhVoices.length > 0) return enGhVoices[0];

  const maleBritishKeywords = ['adam', 'george', 'daniel', 'arthur', 'oliver', 'ryan', 'male', 'uk english male'];
  const maleBritish = enGbVoices.find(v =>
    maleBritishKeywords.some(k => v.name.toLowerCase().includes(k)));
  if (maleBritish) return maleBritish;

  // Fallback: any en-GB voice
  if (enGbVoices.length > 0) return enGbVoices[0];

  // Fallback: any English voice
  if (enVoices.length > 0) return enVoices[0];

  return null;
};

// Load voices are loaded asynchronously; cache the first call may return an empty list.
const getPreferredVoice = (): SpeechSynthesisVoice | null => {
  if (cachedPreferredVoice) return cachedPreferredVoice;
  try {
    const voices = window.speechSynthesis.getVoices();
    cachedPreferredVoice = pickPreferredVoice(voices);
    return cachedPreferredVoice;
  } catch {
    return null;
  }
};

// Text-to-Speech announcement using the browser SpeechSynthesis API.
// This is what actually voices the announcement_text over the PA line.
const speakText = (text: string, volume: number = 100, repeatCount: number = 1) => {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text || !text.trim()) return;

    const synth = window.speechSynthesis;
    speechPlaybackId++;
    const playbackId = speechPlaybackId;
    if (speechRepeatTimer !== null) {
      window.clearTimeout(speechRepeatTimer);
      speechRepeatTimer = null;
    }
    synth.cancel();
    const totalRepetitions = Math.max(1, Math.min(10, Math.floor(repeatCount) || 1));
    let repetitionsSpoken = 0;

    const speakNext = () => {
      if (playbackId !== speechPlaybackId || repetitionsSpoken >= totalRepetitions) return;
      repetitionsSpoken++;

      const utterance = new SpeechSynthesisUtterance(text.trim());
      const voices = synth.getVoices();
      const preferredVoice = (selectedVoiceURI && voices.find(v => v.voiceURI === selectedVoiceURI)) || getPreferredVoice();
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      } else {
        utterance.lang = 'en-GB';
      }

      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = Math.max(0, Math.min(1, volume / 100));
      utterance.onend = () => {
        if (playbackId === speechPlaybackId && repetitionsSpoken < totalRepetitions) {
          speechRepeatTimer = window.setTimeout(speakNext, 1200);
        }
      };
      utterance.onerror = () => {
        if (playbackId === speechPlaybackId && speechRepeatTimer !== null) {
          window.clearTimeout(speechRepeatTimer);
          speechRepeatTimer = null;
        }
      };

      synth.speak(utterance);
    };

    speakNext();
  } catch (err) {
    console.warn('Speech synthesis not supported or blocked:', err);
  }
};

export const BellStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, currentSchool, currentCampus } = useAuth();

  const currentUserName = user?.full_name || 'System User';
  const currentUserEmail = user?.email || 'unknown@bellnexa.com';
  const currentSchoolId = currentSchool?.id || '';
  const isVilacPilotWorkspace = !isSupabaseConfigured()
    && currentSchool?.id === '00000000-0000-0000-0000-000000000001'
    && currentCampus?.is_default === true;
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURIState, setSelectedVoiceURIState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('bellnexa-speech-voice') || '';
    } catch {
      return '';
    }
  });

  // Pre-load & cache the preferred TTS voice; voices load asynchronously in most browsers.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        cachedPreferredVoice = pickPreferredVoice(voices);
      }
    };

    selectedVoiceURI = selectedVoiceURIState || null;
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoiceURIState]);

  const setSpeechVoice = (voiceURI: string) => {
    selectedVoiceURI = voiceURI || null;
    setSelectedVoiceURIState(voiceURI);
    try {
      if (voiceURI) window.localStorage.setItem('bellnexa-speech-voice', voiceURI);
      else window.localStorage.removeItem('bellnexa-speech-voice');
    } catch {
      // Keep the selection for this session when browser storage is unavailable.
    }
  };

  const [events, setEvents] = useState<ScheduleEvent[]>(() => isVilacPilotWorkspace ? INITIAL_EVENTS : []);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(() => isVilacPilotWorkspace ? INITIAL_PENDING_APPROVALS : []);
  const [playbackHistory, setPlaybackHistory] = useState<PlaybackEvent[]>(() => isVilacPilotWorkspace ? INITIAL_PLAYBACK_HISTORY : []);
  const [isBellsPaused, setIsBellsPaused] = useState<boolean>(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState<boolean>(false);
  const [speakerConnected, setSpeakerConnected] = useState<boolean>(true);
  const [isRingingNow, setIsRingingNow] = useState<boolean>(false);
  const [activeRingingEvent, setActiveRingingEvent] = useState<string | null>(null);
  const [deviceOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('2 minutes ago');
  const [scheduleRevision, setScheduleRevision] = useState<number>(14);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(isVilacPilotWorkspace ? [
    {
      id: 'log-1',
      action: 'DEVICE_HEARTBEAT_ACK',
      resource_type: 'device',
      metadata: { device_id: 'VILAC-HW01', battery: 94, speaker: 'CONNECTED' },
      created_at: new Date(DEMO_AUDIT_SEEDED_AT - 120000).toISOString(),
    },
    {
      id: 'log-2',
      action: 'SCHEDULE_DRAFT_SUBMITTED',
      resource_type: 'schedule_event',
      metadata: { submitted_by: 'regulator@vilac.edu.gh', event: 'Lunch Break Bell (+15 min)' },
      created_at: new Date(DEMO_AUDIT_SEEDED_AT - 7200000).toISOString(),
    },
    {
      id: 'log-3',
      action: 'INVITATION_ISSUED',
      resource_type: 'invitation',
      metadata: { target_role: 'principal', email: 'principal@vilac.edu.gh' },
      created_at: new Date(DEMO_AUDIT_SEEDED_AT - 86400000 * 2).toISOString(),
    }
  ] : []);

  useEffect(() => {
    let active = true;
    setScheduleLoadError(null);

    if (!isSupabaseConfigured()) {
      setEvents(isVilacPilotWorkspace ? INITIAL_EVENTS : []);
      setPendingApprovals(isVilacPilotWorkspace ? INITIAL_PENDING_APPROVALS : []);
      setPlaybackHistory(isVilacPilotWorkspace ? INITIAL_PLAYBACK_HISTORY : []);
      setAuditLogs(isVilacPilotWorkspace ? [
        {
          id: 'log-1',
          action: 'DEVICE_HEARTBEAT_ACK',
          resource_type: 'device',
          metadata: { device_id: 'VILAC-HW01', battery: 94, speaker: 'CONNECTED' },
          created_at: new Date(DEMO_AUDIT_SEEDED_AT - 120000).toISOString(),
        },
        {
          id: 'log-2',
          action: 'SCHEDULE_DRAFT_SUBMITTED',
          resource_type: 'schedule_event',
          metadata: { submitted_by: 'regulator@vilac.edu.gh', event: 'Lunch Break Bell (+15 min)' },
          created_at: new Date(DEMO_AUDIT_SEEDED_AT - 7200000).toISOString(),
        },
        {
          id: 'log-3',
          action: 'INVITATION_ISSUED',
          resource_type: 'invitation',
          metadata: { target_role: 'principal', email: 'principal@vilac.edu.gh' },
          created_at: new Date(DEMO_AUDIT_SEEDED_AT - 86400000 * 2).toISOString(),
        },
      ] : []);
      setScheduleRevision(isVilacPilotWorkspace ? 14 : 0);
      setActiveScheduleId(null);
      return () => { active = false; };
    }

    if (!currentSchool || !currentCampus) {
      setEvents([]);
      setPendingApprovals([]);
      setPlaybackHistory([]);
      setAuditLogs([]);
      setScheduleRevision(0);
      setActiveScheduleId(null);
      return () => { active = false; };
    }

    const loadCampusSchedule = async () => {
      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .select('id, revision')
        .eq('school_id', currentSchool.id)
        .eq('campus_id', currentCampus.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (scheduleError) throw scheduleError;
      if (!schedule) throw new Error('No active timetable is configured for this campus.');

      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('campus_id', currentCampus.id)
        .eq('schedule_id', schedule.id)
        .order('start_time', { ascending: true });
      if (error) throw error;
      if (!active) return;
      const campusEvents = (data || []) as ScheduleEvent[];
      setActiveScheduleId(schedule.id);
      setScheduleRevision(schedule.revision);
      setEvents(campusEvents);
      setPendingApprovals(campusEvents
        .filter(event => event.approval_status === 'awaiting_principal')
        .map(event => ({
          id: event.id,
          school_id: event.school_id,
          type: 'timetable_edit' as const,
          title: `${event.event_name} (${event.start_time})`,
          description: event.change_summary || `${event.last_edited_by || 'A regulator'} submitted a schedule change.`,
          target_event_id: event.id,
          submitted_by: event.last_edited_by || '',
          submitted_by_name: event.last_edited_by || 'Campus regulator',
          submitted_at: event.updated_at || event.created_at,
          status: 'pending' as const,
        })));
      setPlaybackHistory([]);
      setAuditLogs([]);
    };
    void loadCampusSchedule().catch(error => {
      if (active) setScheduleLoadError(error instanceof Error ? error.message : 'Unable to load this campus timetable.');
    });
    return () => { active = false; };
  }, [currentCampus?.id, currentSchool?.id, isVilacPilotWorkspace, setAuditLogs, setPlaybackHistory]);

  // Audio Test Play — plays the Westminster chime as an attention signal,
  // then speaks the announcement text (TTS) so the voice announcement is actually heard.
  const playTestChime = (eventName: string = 'Test Bell Chime', announcementText?: string, repeatCount: number = 1) => {
    setIsRingingNow(true);
    setActiveRingingEvent(eventName);
    playChimeSound();

    if (announcementText && announcementText.trim()) {
      // Delay the voice so the chime is heard first as the alert tone.
      setTimeout(() => speakText(announcementText, 100, repeatCount), 1900);
    }

    const ringDuration = announcementText ? 8000 : 3500;
    setTimeout(() => {
      setIsRingingNow(false);
      setActiveRingingEvent(null);
    }, ringDuration);
  };

  // Speak arbitrary text directly (used for announcement previews).
  const speakAnnouncement = (text: string) => {
    speakText(text, 100);
  };

  const stopRinging = () => {
    setIsRingingNow(false);
    setActiveRingingEvent(null);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechPlaybackId++;
      if (speechRepeatTimer !== null) {
        window.clearTimeout(speechRepeatTimer);
        speechRepeatTimer = null;
      }
      window.speechSynthesis.cancel();
    }
  };

  // Regulator creates a new draft event
  const createDraftEvent = (eventData: Omit<ScheduleEvent, 'id' | 'created_at' | 'approval_status'>) => {
    const newId = `evt-${Date.now()}`;
    const newEvent: ScheduleEvent = {
      ...eventData,
      id: newId,
      approval_status: 'draft',
      last_edited_by: currentUserName,
      created_at: new Date().toISOString(),
    };

    setEvents(prev => [...prev, newEvent]);

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'EVENT_DRAFT_CREATED',
        resource_type: 'schedule_event',
        metadata: { event_name: newEvent.event_name, time: newEvent.start_time },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Regulator updates an event as a draft
  const updateEventAsDraft = (id: string, updates: Partial<ScheduleEvent>) => {
    setEvents(prev => prev.map(ev => {
      if (ev.id === id) {
        return {
          ...ev,
          ...updates,
          approval_status: 'draft',
          last_edited_by: currentUserName,
          updated_at: new Date().toISOString(),
        };
      }
      return ev;
    }));
  };

  // Regulator submits event for Principal approval
  const submitEventForApproval = (id: string) => {
    const target = events.find(e => e.id === id);
    if (!target) return;

    // Update status to awaiting_principal
    setEvents(prev => prev.map(e => e.id === id ? { ...e, approval_status: 'awaiting_principal' } : e));

    // Create a pending approval item
    const newApproval: PendingApproval = {
      id: `appr-${Date.now()}`,
      school_id: target.school_id,
      type: 'timetable_edit',
      title: `${target.event_name} (${target.start_time})`,
      description: `${currentUserName} submitted changes for "${target.event_name}". Time set to ${target.start_time}, repetition ${target.repeat_count}x.`,
      target_event_id: target.id,
      event_payload: target,
      submitted_by: currentUserEmail,
      submitted_by_name: currentUserName,
      submitted_at: 'Just now',
      status: 'pending',
    };

    setPendingApprovals(prev => [newApproval, ...prev]);

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'SUBMITTED_FOR_PRINCIPAL_APPROVAL',
        resource_type: 'pending_approval',
        metadata: { event_id: id, event_name: target.event_name },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Regulator deletes event
  const deleteEvent = (id: string) => {
    const target = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setPendingApprovals(prev => prev.filter(p => p.target_event_id !== id));

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'EVENT_DELETED',
        resource_type: 'schedule_event',
        metadata: { event_id: id, event_name: target?.event_name },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Regulator uploads audio announcement
  const uploadAudioAnnouncement = (title: string, duration: number, filePlaceholder: string) => {
    const newApproval: PendingApproval = {
      id: `appr-${Date.now()}`,
      school_id: currentSchoolId,
      type: 'audio_upload',
      title: `Audio Announcement: "${title}"`,
      description: `New audio asset recorded/uploaded (${duration}s duration). Requires Principal validation before syncing to bell engine hardware.`,
      audio_title: title,
      audio_file: filePlaceholder,
      submitted_by: currentUserEmail,
      submitted_by_name: currentUserName,
      submitted_at: 'Just now',
      status: 'pending',
    };

    setPendingApprovals(prev => [newApproval, ...prev]);

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'AUDIO_ANNOUNCEMENT_UPLOADED',
        resource_type: 'audio_asset',
        metadata: { title, duration },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Principal approves pending item -> pushes live to device!
  const approvePendingItem = (approvalId: string) => {
    const item = pendingApprovals.find(p => p.id === approvalId);
    if (!item) return;

    // Remove from pending
    setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));

    // If it relates to a schedule event, mark it as 'live_on_device'
    if (item.target_event_id) {
      setEvents(prev => prev.map(e => {
        if (e.id === item.target_event_id) {
          return {
            ...e,
            approval_status: 'live_on_device',
            updated_at: new Date().toISOString(),
          };
        }
        return e;
      }));
    }

    // Increment schedule revision and update sync time
    setScheduleRevision(prev => prev + 1);
    setLastSyncTime('Just synced (New Revision)');

    // Add to audit logs
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'PRINCIPAL_APPROVED_AND_PUSHED_TO_DEVICE',
        resource_type: 'pending_approval',
        metadata: { approval_id: approvalId, title: item.title, new_revision: scheduleRevision + 1 },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Principal rejects pending item -> sends back to draft
  const rejectPendingItem = (approvalId: string, reason: string = 'Changes requested by Principal') => {
    const item = pendingApprovals.find(p => p.id === approvalId);
    if (!item) return;

    setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));

    if (item.target_event_id) {
      setEvents(prev => prev.map(e => {
        if (e.id === item.target_event_id) {
          return {
            ...e,
            approval_status: 'draft',
            change_summary: `Rejected by Principal: ${reason}`,
          };
        }
        return e;
      }));
    }

    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'PRINCIPAL_REJECTED_CHANGE',
        resource_type: 'pending_approval',
        metadata: { approval_id: approvalId, reason },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Principal toggles pause all bells
  const togglePauseAllBells = () => {
    const newState = !isBellsPaused;
    setIsBellsPaused(newState);
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: newState ? 'BELLS_PAUSED_BY_PRINCIPAL' : 'BELLS_RESUMED_BY_PRINCIPAL',
        resource_type: 'device_command',
        metadata: { paused: newState },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Emergency Stop (Instant mute & halt)
  const triggerEmergencyStop = () => {
    setIsEmergencyStopped(true);
    setIsRingingNow(false);
    setActiveRingingEvent(null);
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'EMERGENCY_STOP_TRIGGERED',
        resource_type: 'device_command',
        metadata: { status: 'OVERRIDE_ACTIVE' },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  const resumeFromEmergencyStop = () => {
    setIsEmergencyStopped(false);
    setAuditLogs(prev => [
      {
        id: `log-${Date.now()}`,
        action: 'EMERGENCY_STOP_CLEARED',
        resource_type: 'device_command',
        metadata: { status: 'NORMAL' },
        created_at: new Date().toISOString(),
      },
      ...prev
    ]);
  };

  // Speaker Connection toggle on Phone hardware
  const toggleSpeakerConnection = () => {
    setSpeakerConnected(prev => !prev);
  };

  return (
    <BellStateContext.Provider
      value={{
        events,
        pendingApprovals,
        playbackHistory,
        auditLogs,
        isBellsPaused,
        isEmergencyStopped,
        speakerConnected,
        isRingingNow,
        activeRingingEvent,
        deviceOnline,
        lastSyncTime,
        scheduleRevision,
        availableVoices,
        selectedVoiceURI: selectedVoiceURIState,
        setSpeechVoice,

        createDraftEvent,
        updateEventAsDraft,
        submitEventForApproval,
        deleteEvent,
        uploadAudioAnnouncement,

        approvePendingItem,
        rejectPendingItem,
        togglePauseAllBells,
        triggerEmergencyStop,
        resumeFromEmergencyStop,

        toggleSpeakerConnection,
        playTestChime,
        speakAnnouncement,
        stopRinging,
      }}
    >
      {children}
    </BellStateContext.Provider>
  );
};

export const useBellState = () => {
  const context = useContext(BellStateContext);
  if (!context) {
    throw new Error('useBellState must be used within a BellStateProvider');
  }
  return context;
};
