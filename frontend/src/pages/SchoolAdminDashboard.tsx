import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  Smartphone, 
  CheckCircle2, 
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
import { useAuth } from '../context/AuthContext';
import { ScheduleEvent, EventCategory } from '../types/database';

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
  const { currentSchool } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [testAudioStatus, setTestAudioStatus] = useState<string | null>(null);

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<Partial<ScheduleEvent> | null>(null);

  // Vilac Initial Seed Events with 3x Repetition Default
  const [events, setEvents] = useState<ScheduleEvent[]>([
    {
      id: 'evt-1',
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: 'Morning Assembly Bell',
      category: 'morning_assembly',
      start_time: '07:30',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: 'Good morning students and staff. Please proceed to the assembly ground for morning devotion.',
      language: 'en',
      volume: 100,
      repeat_count: 3, // Repeat Thrice
      created_at: new Date().toISOString()
    },
    {
      id: 'evt-2',
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: 'First Period Commencement',
      category: 'lesson_commencement',
      start_time: '08:00',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: 'First period has commenced. All students must be in their respective classrooms.',
      language: 'en',
      volume: 100,
      repeat_count: 3, // Repeat Thrice
      created_at: new Date().toISOString()
    },
    {
      id: 'evt-3',
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: 'Snack & Recess Break',
      category: 'snack_break',
      start_time: '10:30',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: 'It is now time for morning break and snacks.',
      language: 'en',
      volume: 95,
      repeat_count: 3, // Repeat Thrice
      created_at: new Date().toISOString()
    },
    {
      id: 'evt-4',
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: 'Lunch Break Bell',
      category: 'lunch_break',
      start_time: '12:30',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: 'Lunch break has commenced. Enjoy your meal.',
      language: 'en',
      volume: 100,
      repeat_count: 3, // Repeat Thrice
      created_at: new Date().toISOString()
    },
    {
      id: 'evt-5',
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: 'School Closing Bell',
      category: 'closing_time',
      start_time: '15:30',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: 'School has closed for the day. Safe journey home to all students.',
      language: 'en',
      volume: 100,
      repeat_count: 3, // Repeat Thrice
      created_at: new Date().toISOString()
    }
  ]);

  // Live Clock Updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { timeZone: 'Africa/Accra', hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleEvent = (id: string) => {
    setEvents(events.map(evt => evt.id === id ? { ...evt, is_enabled: !evt.is_enabled } : evt));
  };

  const handleToggleDayInline = (eventId: string, dayId: number) => {
    setEvents(events.map(evt => {
      if (evt.id !== eventId) return evt;
      const currentDays = evt.days_of_week || [];
      const updatedDays = currentDays.includes(dayId)
        ? currentDays.filter(d => d !== dayId)
        : [...currentDays, dayId].sort((a, b) => a - b);
      return { ...evt, days_of_week: updatedDays };
    }));
  };

  const handleOpenAddModal = () => {
    setEditingEvent({
      id: `evt-${Date.now()}`,
      schedule_id: 'sched-1',
      school_id: '00000000-0000-0000-0000-000000000001',
      event_name: '',
      category: 'custom',
      start_time: '09:00',
      days_of_week: [1, 2, 3, 4, 5],
      is_enabled: true,
      announcement_text: '',
      language: 'en',
      volume: 100,
      repeat_count: 3, // Default thrice
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: ScheduleEvent) => {
    setEditingEvent({ ...evt });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editingEvent.event_name || !editingEvent.start_time) return;

    const existingIndex = events.findIndex(e => e.id === editingEvent.id);
    if (existingIndex >= 0) {
      const updated = [...events];
      updated[existingIndex] = editingEvent as ScheduleEvent;
      setEvents(updated);
    } else {
      setEvents([...events, editingEvent as ScheduleEvent]);
    }
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scheduled bell event?')) {
      setEvents(events.filter(e => e.id !== id));
    }
  };

  // Repeats speech playback THRICE (or repeat_count times)
  const handleTestAudio = (eventName: string, text?: string, repeatTimes: number = 3) => {
    setIsPlayingTest(true);
    setTestAudioStatus(`Playing "${eventName}" (Repeating ${repeatTimes}x Thrice)...`);

    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      let currentIteration = 0;

      const speakNext = () => {
        if (currentIteration >= repeatTimes) {
          setIsPlayingTest(false);
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
            setIsPlayingTest(false);
            setTestAudioStatus(null);
          }
        };
        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    } else {
      setTimeout(() => {
        setIsPlayingTest(false);
        setTestAudioStatus(null);
      }, 4000);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Vilac Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-vilac-darkgreen via-slate-900 to-slate-900 border border-vilac-green/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-vilac-orange/10 to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-vilac-gold/20 text-vilac-gold border border-vilac-gold/30">
              VILAC PILOT ACTIVE
            </span>
            <span className="text-xs text-slate-400 font-mono">Timezone: Africa/Accra (GMT+0)</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Vilac International School Bell Dashboard</span>
          </h2>
          <p className="text-xs text-slate-300">
            Configure exact alarm times, spoken announcement text, 3x repetition rules, and specific day toggles.
          </p>
        </div>

        {/* Live Clock & Next Bell Status */}
        <div className="flex items-center space-x-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800 relative z-10">
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-400">Accra School Local Time</div>
            <div className="text-xl font-mono font-bold text-vilac-gold">{currentTime || '12:45:00'}</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400">Next Scheduled Bell</div>
            <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>15:30 (Closing Bell &bull; 3x Repeat)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Connection Health & Offline Revision Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Device Status */}
        <div className="glass-card p-4 rounded-xl space-y-2 border border-emerald-500/20">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 flex items-center">
              <Smartphone className="w-4 h-4 text-emerald-400 mr-1.5" /> Dedicated Android Device
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ONLINE
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Hardware ID:</span>
              <span className="font-mono text-white">VILAC-HW-01</span>
            </div>
            <div className="flex justify-between">
              <span>Battery Level:</span>
              <span className="font-semibold text-emerald-400">98% (Charging)</span>
            </div>
            <div className="flex justify-between">
              <span>Audio Route:</span>
              <span className="text-vilac-gold font-medium">Bluetooth Speaker Connected</span>
            </div>
          </div>
        </div>

        {/* Local Offline Sync Engine */}
        <div className="glass-card p-4 rounded-xl space-y-2 border border-slate-700">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 flex items-center">
              <RefreshCw className="w-4 h-4 text-vilac-orange mr-1.5" /> Offline Sync Revision
            </span>
            <span className="text-[10px] font-mono text-slate-400">Revision #1</span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Applied Timetable:</span>
              <span className="text-white font-medium">Standard Daily Timetable</span>
            </div>
            <div className="flex justify-between">
              <span>Announcement Repeat:</span>
              <span className="text-emerald-400 font-semibold">Thrice (3x Loop Enabled)</span>
            </div>
            <div className="flex justify-between">
              <span>Screen Lock Readiness:</span>
              <span className="text-white font-medium">Exact Alarm Granted</span>
            </div>
          </div>
        </div>

        {/* Emergency Manual Trigger */}
        <div className="glass-card p-4 rounded-xl space-y-2 border border-vilac-orange/30 bg-gradient-to-b from-slate-900 to-vilac-orange/10 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-white flex items-center space-x-1">
              <ShieldAlert className="w-4 h-4 text-vilac-orange" />
              <span>Manual Emergency Override</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Trigger instant emergency announcement (Repeats 3x across Bluetooth speaker).
            </p>
          </div>
          <button
            onClick={() => handleTestAudio('Emergency Bell Alert', 'Emergency announcement. All teachers and students please remain calm and follow safety protocols.', 3)}
            className="w-full bg-vilac-orange hover:bg-cyan-600 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-vilac-orange/30 transition"
          >
            <Volume2 className="w-4 h-4" />
            <span>Trigger Emergency Announcement (3x)</span>
          </button>
        </div>
      </div>

      {/* Audio Playback Test Banner */}
      {testAudioStatus && (
        <div className="p-3 rounded-xl bg-vilac-green/20 border border-vilac-green/40 flex items-center justify-between text-xs text-white animate-pulse">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-vilac-gold animate-bounce" />
            <span>{testAudioStatus}</span>
          </div>
          <button onClick={() => { window.speechSynthesis.cancel(); setTestAudioStatus(null); setIsPlayingTest(false); }} className="text-slate-400 hover:text-white">
            <VolumeX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Schedule Events Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-vilac-gold" />
              <span>Standard School Bell Timetable ({events.length} Events)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Spoken announcements automatically repeat **thrice** (3x) for clarity across school halls.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="bg-vilac-green hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-vilac-green/20 transition"
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
                <th className="py-2.5 px-3">Time (GMT)</th>
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
                  <td className="py-3 px-3 font-mono font-bold text-vilac-gold text-sm">
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
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-vilac-gold/15 text-vilac-gold border border-vilac-gold/30">
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
                                ? 'bg-vilac-green/30 text-emerald-400 border-vilac-green/60 shadow-sm'
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
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-vilac-green/30 text-slate-300 hover:text-white transition"
                    >
                      <Play className="w-3.5 h-3.5 text-vilac-gold" />
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
                <Edit3 className="w-4 h-4 text-vilac-gold" />
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-vilac-green"
                />
              </div>

              {/* Time, Category & Repetition Rule */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Alarm Time (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={editingEvent.start_time || '08:00'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-vilac-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={editingEvent.category || 'custom'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value as EventCategory })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-vilac-green"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-vilac-gold focus:outline-none focus:border-vilac-green"
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
                    className="text-[10px] text-vilac-gold hover:underline flex items-center space-x-1"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-vilac-green"
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
                            ? 'bg-vilac-green text-white border-emerald-400 shadow-md shadow-vilac-green/30'
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
                  className="flex-1 bg-vilac-green hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-vilac-green/30 transition"
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
