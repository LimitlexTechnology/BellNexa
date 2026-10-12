import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Smartphone, 
  Play, 
  Plus, 
  Volume2, 
  ShieldAlert, 
  RefreshCw, 
  Calendar,
  VolumeX,
  Edit3,
  Trash2,
  X,
  Save,
  RotateCw
} from 'lucide-react';
import { Device, ScheduleEvent, EventCategory } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDateTimeInTimeZone, formatTimeInTimeZone, getNextScheduleOccurrence, getPreferredTimeZone } from '../lib/timezone';
import { SchoolSettingsPanel } from '../components/SchoolSettingsPanel';

const WEEKDAYS = [
  { id: 1, label: 'Mon', short: 'M' },
  { id: 2, label: 'Tue', short: 'T' },
  { id: 3, label: 'Wed', short: 'W' },
  { id: 4, label: 'Thu', short: 'T' },
  { id: 5, label: 'Fri', short: 'F' },
  { id: 6, label: 'Sat', short: 'S' },
  { id: 7, label: 'Sun', short: 'S' },
];

export const SchoolAdminDashboard: React.FC = () => {
  const { currentSchool, currentCampus, user, setCurrentSchool } = useAuth();
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleRevision, setScheduleRevision] = useState<number | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [testAudioStatus, setTestAudioStatus] = useState<string | null>(null);

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<Partial<ScheduleEvent> | null>(null);

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const scheduleTimeZone = getPreferredTimeZone(
    user?.preferred_timezone,
    currentCampus?.timezone,
    currentSchool?.timezone,
  );

  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(formatTimeInTimeZone(new Date(), scheduleTimeZone));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [scheduleTimeZone]);

  useEffect(() => {
    let cancelled = false;
    const loadSchedule = async () => {
      if (!currentSchool || !currentCampus) {
        setEvents([]);
        setScheduleId(null);
        setScheduleName('');
        setScheduleRevision(null);
        setDevices([]);
        return;
      }
      setLoadError(null);
      const [{ data: schedule, error: scheduleError }, { data: campusDevices, error: devicesError }] = await Promise.all([
        supabase
        .from('schedules')
        .select('id, name, revision')
        .eq('school_id', currentSchool.id)
        .eq('campus_id', currentCampus.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
        supabase.from('devices')
          .select('*')
          .eq('school_id', currentSchool.id)
          .eq('campus_id', currentCampus.id)
          .order('device_name', { ascending: true }),
      ]);
      if (scheduleError) throw scheduleError;
      if (devicesError) throw devicesError;
      if (!cancelled) setDevices((campusDevices || []) as Device[]);
      if (!schedule) {
        if (!cancelled) {
          setEvents([]);
          setScheduleId(null);
          setScheduleName('');
          setScheduleRevision(null);
        }
        return;
      }
      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('campus_id', currentCampus.id)
        .eq('schedule_id', schedule.id)
        .order('start_time', { ascending: true });
      if (error) throw error;
      if (!cancelled) {
        setScheduleId(schedule.id);
        setScheduleName(schedule.name);
        setScheduleRevision(schedule.revision);
        setEvents((data || []) as ScheduleEvent[]);
      }
    };
    loadSchedule().catch(error => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load this campus schedule.');
    });
    return () => { cancelled = true; };
  }, [currentCampus?.id, currentSchool?.id]);

  const nextEvent = events
    .map(event => ({
      event,
      occurrence: getNextScheduleOccurrence(event.start_time, event.days_of_week, scheduleTimeZone, new Date()),
    }))
    .filter((item): item is { event: ScheduleEvent; occurrence: Date } => item.occurrence !== null)
    .sort((left, right) => left.occurrence.getTime() - right.occurrence.getTime())[0];

  const updateEvent = async (id: string, values: Partial<ScheduleEvent>) => {
    const { error } = await supabase
      .from('schedule_events')
      .update(values)
      .eq('id', id)
      .eq('school_id', currentSchool?.id || '')
      .eq('campus_id', currentCampus?.id || '');
    if (error) throw error;
    setEvents(previous => previous.map(event => event.id === id ? { ...event, ...values } : event));
  };

  const handleToggleEvent = (id: string) => {
    const event = events.find(item => item.id === id);
    if (!event) return;
    updateEvent(id, { is_enabled: !event.is_enabled }).catch(error => {
      setLoadError(error instanceof Error ? error.message : 'Unable to update this event.');
    });
  };

  const handleToggleDayInline = (eventId: string, dayId: number) => {
    const event = events.find(item => item.id === eventId);
    if (!event) return;
    const days = event.days_of_week || [];
    const updatedDays = days.includes(dayId)
      ? days.filter(day => day !== dayId)
      : [...days, dayId].sort((left, right) => left - right);
    updateEvent(eventId, { days_of_week: updatedDays }).catch(error => {
      setLoadError(error instanceof Error ? error.message : 'Unable to update the event days.');
    });
  };

  const handleOpenAddModal = () => {
    if (!currentSchool || !currentCampus || !scheduleId) {
      setLoadError('A campus timetable is not available yet. Refresh the page or contact an administrator.');
      return;
    }
    setEditingEvent({
      schedule_id: scheduleId,
      school_id: currentSchool.id,
      campus_id: currentCampus.id,
      event_name: '',
      category: 'custom',
      start_time: '09:00',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: '',
      language: 'en',
      volume: 100,
      repeat_count: 3,
    });
    setLoadError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: ScheduleEvent) => {
    setEditingEvent({ ...evt });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editingEvent.event_name?.trim() || !editingEvent.start_time
      || !currentSchool || !currentCampus || !scheduleId) return;
    const values = {
      ...(editingEvent.id ? { id: editingEvent.id } : {}),
      schedule_id: scheduleId,
      school_id: currentSchool.id,
      campus_id: currentCampus.id,
      event_name: editingEvent.event_name.trim(),
      category: editingEvent.category || 'custom',
      start_time: editingEvent.start_time,
      days_of_week: editingEvent.days_of_week || [],
      is_enabled: editingEvent.is_enabled ?? true,
      announcement_text: editingEvent.announcement_text || '',
      language: editingEvent.language || 'en',
      volume: editingEvent.volume ?? 100,
      repeat_count: editingEvent.repeat_count ?? 3,
    };
    const saveEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('schedule_events')
          .upsert(values)
          .select('*')
          .single();
        if (error) throw error;
        if (!data) throw new Error('The saved event was not returned by the database.');
        setEvents(previous => [...previous.filter(event => event.id !== data.id), data as ScheduleEvent]
          .sort((left, right) => left.start_time.localeCompare(right.start_time)));
        setIsModalOpen(false);
        setEditingEvent(null);
        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to save this event.');
      }
    };
    void saveEvent();
  };

  const handleDeleteEvent = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled bell event?')) return;
    const removeEvent = async () => {
      try {
        const { error } = await supabase.from('schedule_events')
          .delete()
          .eq('id', id)
          .eq('school_id', currentSchool?.id || '')
          .eq('campus_id', currentCampus?.id || '');
        if (error) throw error;
        setEvents(previous => previous.filter(event => event.id !== id));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to delete this event.');
      }
    };
    void removeEvent();
  };

  // Repeats speech playback THRICE (or repeat_count times)
  const handleTestAudio = (eventName: string, text?: string, repeatTimes: number = 3) => {
    setTestAudioStatus(`Playing "${eventName}" (Repeating ${repeatTimes}x Thrice)...`);

    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      let currentIteration = 0;

      const speakNext = () => {
        if (currentIteration >= repeatTimes) {
          setTestAudioStatus(null);
          return;
        }

        currentIteration++;
        setTestAudioStatus(`Playing "${eventName}" (Repetition ${currentIteration} of ${repeatTimes})...`);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
          if (currentIteration < repeatTimes) {
            // Brief 1.2s pause between repetitions
            setTimeout(speakNext, 1200);
          } else {
            setTestAudioStatus(null);
          }
        };
        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    } else {
      setTimeout(() => {
        setTestAudioStatus(null);
      }, 4000);
    }
  };

  return (
    <div className="space-y-6 relative">
      {currentSchool && (
        <SchoolSettingsPanel
          school={currentSchool}
          onUpdated={setCurrentSchool}
        />
      )}

      {loadError && (
        <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-bellnexa-navyDark via-slate-900 to-slate-900 border border-bellnexa-navy/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-bellnexa-cyan/10 to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-bellnexa-cyanBright/20 text-bellnexa-cyanBright border border-bellnexa-cyanBright/30">
              {currentSchool?.country || 'School'} &bull; {currentCampus?.name || 'No campus selected'}
            </span>
            <span className="text-xs text-slate-400 font-mono">Schedule time zone: {scheduleTimeZone}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>{currentSchool?.name || 'School'} Bell Dashboard</span>
          </h2>
          <p className="text-xs text-slate-300">
            Manage the {currentCampus?.name || 'selected campus'} timetable. Schedule times use {scheduleTimeZone}.
          </p>
        </div>

        <div className="flex items-center space-x-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800 relative z-10">
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-400">Campus local time</div>
            <div className="text-xl font-mono font-bold text-bellnexa-cyanBright">{currentTime || '--:--:--'}</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Next Scheduled Bell</div>
            <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {nextEvent
                  ? `${formatTimeInTimeZone(nextEvent.occurrence, scheduleTimeZone)} (${nextEvent.event.event_name})`
                  : 'No upcoming scheduled events'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Devices at {currentCampus?.name || 'this campus'}</h3>
          <span className="text-xs text-slate-400">
            {scheduleName ? `${scheduleName}${scheduleRevision ? ` · revision ${scheduleRevision}` : ''}` : 'No active timetable'}
          </span>
        </div>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-400">No devices are registered for this campus.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map(device => (
              <div key={device.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">{device.device_name}</span>
                  <span className={device.is_online ? 'text-emerald-400' : 'text-slate-400'}>
                    {device.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="mt-1 font-mono text-slate-400">{device.device_hardware_id}</p>
                <p className="mt-1 text-slate-400">
                  {device.battery_level == null ? 'Battery unknown' : `Battery ${device.battery_level}%`}
                  {device.last_checkin_at ? ` · Last check-in ${formatDateTimeInTimeZone(new Date(device.last_checkin_at), scheduleTimeZone)}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audio Playback Test Banner */}
      {testAudioStatus && (
        <div className="p-3 rounded-xl bg-bellnexa-navy/20 border border-bellnexa-navy/40 flex items-center justify-between text-xs text-white animate-pulse">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-bellnexa-cyanBright animate-bounce" />
            <span>{testAudioStatus}</span>
          </div>
          <button onClick={() => { window.speechSynthesis.cancel(); setTestAudioStatus(null); }} className="text-slate-400 hover:text-white">
            <VolumeX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Schedule Events Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-bellnexa-cyanBright" />
              <span>Standard School Bell Timetable ({events.length} Events)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Spoken announcements automatically repeat **thrice** (3x) for clarity across school halls.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="bg-bellnexa-navy hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-bellnexa-navy/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Bell Alarm</span>
          </button>
        </div>

        {/* Interactive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                <th className="py-2.5 px-3">Time ({scheduleTimeZone})</th>
                <th className="py-2.5 px-3">Event Name & Category</th>
                <th className="py-2.5 px-3">Spoken Announcement Text</th>
                <th className="py-2.5 px-3">Repeat Rule</th>
                <th className="py-2.5 px-3">Specific Days On/Off</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                  {/* Start Time */}
                  <td className="py-3 px-3 font-mono font-bold text-bellnexa-cyanBright text-sm">
                    {evt.start_time}
                  </td>

                  {/* Event Name & Category */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-white">{evt.event_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase">{evt.category}</div>
                  </td>

                  {/* Spoken Announcement Text */}
                  <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={evt.announcement_text}>
                    {evt.announcement_text ? (
                      <span>"{evt.announcement_text}"</span>
                    ) : (
                      <span className="text-slate-500 italic">Default Bell Tone Only</span>
                    )}
                  </td>

                  {/* Repetition Badge */}
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-bellnexa-cyanBright/15 text-bellnexa-cyanBright border border-bellnexa-cyanBright/30">
                      <RotateCw className="w-3 h-3" />
                      <span>{evt.repeat_count || 3}x (Thrice)</span>
                    </span>
                  </td>

                  {/* Specific Day On/Off Alarm Selector */}
                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-1">
                      {WEEKDAYS.map(day => {
                        const isDayActive = evt.days_of_week?.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            onClick={() => handleToggleDayInline(evt.id, day.id)}
                            title={`Toggle ${day.label} alarm ${isDayActive ? 'Off' : 'On'}`}
                            className={`w-6 h-6 rounded-md font-mono text-[10px] font-bold transition flex items-center justify-center border ${
                              isDayActive
                                ? 'bg-bellnexa-navy/30 text-emerald-400 border-bellnexa-navy/60 shadow-sm'
                                : 'bg-slate-900 text-slate-600 border-slate-800 hover:text-slate-400'
                            }`}
                          >
                            {day.short}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* Enabled / Paused Toggle */}
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleEvent(evt.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        evt.is_enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {evt.is_enabled ? 'Active' : 'Paused'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right space-x-1.5">
                    <button
                      onClick={() => handleTestAudio(evt.event_name, evt.announcement_text, evt.repeat_count || 3)}
                      title={`Test Audio Playback (${evt.repeat_count || 3}x)`}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-bellnexa-navy/30 text-slate-300 hover:text-white transition"
                    >
                      <Play className="w-3.5 h-3.5 text-bellnexa-cyanBright" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(evt)}
                      title="Edit Event Details"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      title="Delete Event"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT / CREATE EVENT MODAL */}
      {isModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-bellnexa-cyanBright" />
                <span>{events.some(e => e.id === editingEvent.id) ? 'Edit Bell Event' : 'Add New Bell Event'}</span>
              </h3>
              <button
                onClick={() => { setIsModalOpen(false); setEditingEvent(null); }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Snack Break Bell"
                  value={editingEvent.event_name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, event_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-bellnexa-navy"
                />
              </div>

              {/* Time, Category & Repetition Rule */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Alarm Time ({scheduleTimeZone})</label>
                  <input
                    type="time"
                    required
                    value={editingEvent.start_time || '08:00'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-bellnexa-navy"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={editingEvent.category || 'custom'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value as EventCategory })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-bellnexa-navy"
                  >
                    <option value="morning_assembly">Morning Assembly</option>
                    <option value="lesson_commencement">Lesson Commencement</option>
                    <option value="lesson_change">Lesson Change</option>
                    <option value="snack_break">Snack / Recess Break</option>
                    <option value="worship_time">Worship Time</option>
                    <option value="lunch_break">Lunch Break</option>
                    <option value="closing_time">School Closing</option>
                    <option value="emergency">Emergency Alert</option>
                    <option value="custom">Custom Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Repeat Announcement</label>
                  <select
                    value={editingEvent.repeat_count || 3}
                    onChange={(e) => setEditingEvent({ ...editingEvent, repeat_count: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-bellnexa-cyanBright focus:outline-none focus:border-bellnexa-navy"
                  >
                    <option value={3}>3x - Repeat Thrice (Default)</option>
                    <option value={2}>2x - Repeat Twice</option>
                    <option value={1}>1x - Play Once</option>
                    <option value={4}>4x - Repeat 4 Times</option>
                    <option value={5}>5x - Repeat 5 Times</option>
                  </select>
                </div>
              </div>

              {/* Spoken Announcement Text */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Spoken Announcement Text</label>
                  <button
                    type="button"
                    onClick={() => handleTestAudio(editingEvent.event_name || 'Preview', editingEvent.announcement_text, editingEvent.repeat_count || 3)}
                    className="text-[10px] text-bellnexa-cyanBright hover:underline flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test Speech ({editingEvent.repeat_count || 3}x Thrice)</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. Good morning students, please assemble in the central hall."
                  value={editingEvent.announcement_text || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, announcement_text: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-bellnexa-navy"
                />
              </div>

              {/* Specific Day On/Off Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Specific Active Days for Alarm</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map(day => {
                    const isSelected = editingEvent.days_of_week?.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          const current = editingEvent.days_of_week || [];
                          const updated = current.includes(day.id)
                            ? current.filter(d => d !== day.id)
                            : [...current, day.id].sort((a, b) => a - b);
                          setEditingEvent({ ...editingEvent, days_of_week: updated });
                        }}
                        className={`py-2 rounded-lg font-mono text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-bellnexa-navy text-white border-emerald-400 shadow-md shadow-bellnexa-navy/30'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save & Cancel Buttons */}
              <div className="flex space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingEvent(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-bellnexa-navy hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-bellnexa-navy/30 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Bell Event</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
