import React, { useState } from 'react';
import { 
  Plus, 
  Play, 
  Volume2, 
  Upload, 
  Send, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  Headphones
} from 'lucide-react';
import { useBellState } from '../context/BellStateContext';
import { useAuth } from '../context/AuthContext';
import { ScheduleEvent, EventCategory } from '../types/database';
import { getPreferredTimeZone } from '../lib/timezone';

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

export const RegulatorDashboard: React.FC = () => {
  const { user, currentSchool, currentCampus } = useAuth();
  const { 
    events, 
    createDraftEvent, 
    updateEventAsDraft, 
    submitEventForApproval, 
    deleteEvent, 
    uploadAudioAnnouncement,
    playTestChime,
    isRingingNow,
    activeRingingEvent,
    scheduleRevision
  } = useBellState();
  const scheduleTimeZone = getPreferredTimeZone(
    user?.preferred_timezone,
    currentCampus?.timezone,
    currentSchool?.timezone,
  );

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Audio Upload Form State
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDuration, setAudioDuration] = useState('30');
  const [audioSuccessMsg, setAudioSuccessMsg] = useState<string | null>(null);

  // New Event Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<EventCategory>('lesson_change');
  const [formTime, setFormTime] = useState('09:00');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [formAnnouncement, setFormAnnouncement] = useState('');
  const [formRepeatCount, setFormRepeatCount] = useState<number>(3);
  const [formVolume, setFormVolume] = useState<number>(100);

  // Handle Event Modal Open for New
  const handleOpenAddModal = () => {
    setEditingEventId(null);
    setFormName('');
    setFormCategory('lesson_change');
    setFormTime('09:00');
    setFormDays([1, 2, 3, 4, 5, 6, 7]);
    setFormAnnouncement('');
    setFormRepeatCount(3);
    setFormVolume(100);
    setIsAddModalOpen(true);
  };

  // Handle Event Modal Open for Edit
  const handleOpenEditModal = (ev: ScheduleEvent) => {
    setEditingEventId(ev.id);
    setFormName(ev.event_name);
    setFormCategory(ev.category);
    setFormTime(ev.start_time);
    setFormDays(ev.days_of_week);
    setFormAnnouncement(ev.announcement_text || '');
    setFormRepeatCount(ev.repeat_count || 3);
    setFormVolume(ev.volume || 100);
    setIsAddModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = (submitDirectly: boolean = false) => {
    if (!formName.trim() || !formTime.trim()) return;

    if (editingEventId) {
      updateEventAsDraft(editingEventId, {
        event_name: formName,
        category: formCategory,
        start_time: formTime,
        days_of_week: formDays,
        announcement_text: formAnnouncement,
        repeat_count: formRepeatCount,
        volume: formVolume,
        change_summary: `Modified by regulator: Time ${formTime}`,
      });

      if (submitDirectly) {
        submitEventForApproval(editingEventId);
      }
    } else {
      createDraftEvent({
        schedule_id: 'sched-vilac-1',
        school_id: currentSchool?.id || '00000000-0000-0000-0000-000000000001',
        event_name: formName,
        category: formCategory,
        start_time: formTime,
        days_of_week: formDays,
        is_enabled: true,
        announcement_text: formAnnouncement,
        language: 'en',
        volume: formVolume,
        repeat_count: formRepeatCount,
        change_summary: 'New event drafted',
        last_edited_by: user?.full_name || 'Staff',
      });
    }

    setIsAddModalOpen(false);
  };

  // Submit Audio Upload
  const handleUploadAudio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioTitle.trim()) return;

    uploadAudioAnnouncement(audioTitle, parseInt(audioDuration) || 30, `audio/${audioTitle.toLowerCase().replace(/\s+/g, '_')}.mp3`);
    setAudioSuccessMsg(`"${audioTitle}" submitted to Principal for approval!`);
    setAudioTitle('');
    setTimeout(() => setAudioSuccessMsg(null), 3000);
  };

  // Filter events for the selected day of the week
  const dayEvents = events
    .filter(e => e.days_of_week.includes(selectedDay))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Count by status
  const draftCount = events.filter(e => e.approval_status === 'draft').length;
  const awaitingCount = events.filter(e => e.approval_status === 'awaiting_principal').length;
  const liveCount = events.filter(e => e.approval_status === 'live_on_device').length;

  return (
    <div className="space-y-6">
      
      {/* TEST PLAY AUDIO STATUS BANNER */}
      {isRingingNow && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3">
            <Volume2 className="w-6 h-6 text-white" />
            <div>
              <span className="font-black text-sm uppercase tracking-wider">
                Audible Test Ringing: {activeRingingEvent}
              </span>
              <p className="text-xs text-emerald-100 font-mono">
                Synthesizing Westminster 4-Tone Chime & Voice Output (100% Volume)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-emerald-800 px-3 py-1 rounded-full font-bold">
            PLAYING NOW
          </span>
        </div>
      )}

      {/* HEADER: REGULATOR WORKSPACE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#12C8E8] bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded">
              Schedule Regulator Workspace
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {currentCampus?.name || 'Campus'} &bull; {scheduleTimeZone} &bull; Live Device Rev #{scheduleRevision}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            {currentSchool?.name || 'School'} Timetable & Announcement Editor
          </h1>
          <p className="text-xs text-slate-400">
            {user?.full_name || 'Staff'} &bull; All edits are saved as drafts and submitted to the Principal before going live on the bell phone.
          </p>
        </div>

        {/* TOP ACTIONS: ADD EVENT & TEST PLAY CHIME */}
        <div className="flex items-center space-x-3 w-full lg:w-auto">
          <button
            onClick={() => playTestChime('Westminster Bell Test')}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span>Test Play Chime</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#12C8E8] hover:bg-[#087F9B] text-white shadow-lg shadow-cyan-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* STATUS PIPELINE BAR: DRAFT -> AWAITING PRINCIPAL -> LIVE ON DEVICE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Draft Events
            </span>
            <div className="text-2xl font-black text-white mt-0.5">{draftCount}</div>
            <p className="text-[11px] text-slate-400">Saved locally, not yet submitted</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-amber-400" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
              Awaiting Principal
            </span>
            <div className="text-2xl font-black text-white mt-0.5">{awaitingCount}</div>
            <p className="text-[11px] text-slate-400">Pending Principal review</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-blue-400" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Live on Bell Phone
            </span>
            <div className="text-2xl font-black text-white mt-0.5">{liveCount}</div>
            <p className="text-[11px] text-slate-400">Synced & actively ringing on hardware</p>
          </div>
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
      </div>

      {/* ========================================================= */}
      {/* WEEKLY GRID OF EVENTS */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        
        {/* DAY SELECTOR TABS (MON TO FRI) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex space-x-2 overflow-x-auto">
            {DAYS.map((day) => {
              const countForDay = events.filter(e => e.days_of_week.includes(day.id)).length;
              const isSelected = selectedDay === day.id;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-[#0A1B45] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{day.name}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {countForDay}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            Showing timetable for {DAYS.find(d => d.id === selectedDay)?.name}
          </span>
        </div>

        {/* TIMETABLE EVENT CARDS LIST */}
        <div className="space-y-3">
          {dayEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No events scheduled for this day. Click "Add Event" to create one.
            </div>
          ) : (
            dayEvents.map((ev) => (
              <div
                key={ev.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
              >
                {/* Time & Event Details */}
                <div className="flex items-start md:items-center space-x-4">
                  {/* Time Badge */}
                  <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-center min-w-[70px]">
                    <span className="text-sm font-black font-mono text-white block">
                      {ev.start_time}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      GMT
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {ev.event_name}
                      </h3>

                      {/* Approval Status Badge */}
                      {ev.approval_status === 'draft' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                          Draft
                        </span>
                      )}
                      {ev.approval_status === 'awaiting_principal' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
                          Awaiting Principal
                        </span>
                      )}
                      {ev.approval_status === 'live_on_device' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          Live on Device
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {ev.announcement_text ? `Announcement: "${ev.announcement_text}"` : 'Standard bell chime'}
                    </p>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                      <span>Repeats: {ev.repeat_count || 3}x</span>
                      <span>&bull;</span>
                      <span>Volume: {ev.volume || 100}%</span>
                      {ev.change_summary && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-400/90 font-mono text-[10px]">
                            {ev.change_summary}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Event Actions */}
                <div className="flex items-center space-x-2 self-end md:self-center">
                  {/* Test Play */}
                  <button
                    onClick={() => playTestChime(ev.event_name, ev.announcement_text, ev.repeat_count || 3)}
                    title="Test Play in Browser (chime + voice announcement)"
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-800 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {/* Submit for Principal Approval (If Draft) */}
                  {ev.approval_status === 'draft' && (
                    <button
                      onClick={() => submitEventForApproval(ev.id)}
                      className="px-3 py-1.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit for Approval</span>
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenEditModal(ev)}
                    title="Edit Event"
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-800 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteEvent(ev.id)}
                    title="Delete Event"
                    className="p-2 bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg text-xs font-bold border border-slate-800 hover:border-red-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* AUDIO UPLOAD & PREVIEW SECTION */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl text-[#12C8E8]">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Audio Announcement Upload & Staging</h3>
              <p className="text-xs text-slate-400">
                Upload new MP3 audio recordings or school chants. Once uploaded, submit to the Principal for hardware deployment.
              </p>
            </div>
          </div>
        </div>

        {audioSuccessMsg && (
          <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{audioSuccessMsg}</span>
          </div>
        )}

        <form onSubmit={handleUploadAudio} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              Announcement Title
            </label>
            <input
              type="text"
              required
              value={audioTitle}
              onChange={(e) => setAudioTitle(e.target.value)}
              placeholder="e.g. End of Term Devotional Chime"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#12C8E8]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              Duration (seconds)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={audioDuration}
              onChange={(e) => setAudioDuration(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#12C8E8]"
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => playTestChime(audioTitle || 'Uploaded Sample')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Preview</span>
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[#12C8E8] hover:bg-[#087F9B] text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center space-x-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>Stage & Submit Audio</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================= */}
      {/* ADD / EDIT EVENT MODAL */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingEventId ? 'Edit Timetable Event' : 'Add New Timetable Event'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Science Laboratory Transition"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Event Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as EventCategory)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]"
                  >
                    <option value="morning_assembly">Morning Assembly</option>
                    <option value="lesson_commencement">Lesson Commencement</option>
                    <option value="lesson_change">Lesson Change</option>
                    <option value="snack_break">Snack & Recess Break</option>
                    <option value="lunch_break">Lunch Break</option>
                    <option value="worship_time">Worship & Devotion</option>
                    <option value="closing_time">Closing Time</option>
                    <option value="custom">Custom Event</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Start Time ({scheduleTimeZone})
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-[#12C8E8]"
                  />
                </div>
              </div>

              {/* Day Selection */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Active Days of the Week
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const active = formDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setFormDays(formDays.filter(id => id !== d.id));
                          } else {
                            setFormDays([...formDays, d.id]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition ${
                          active
                            ? 'bg-[#0A1B45] text-white'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Announcement Text */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Voice Announcement Text (TTS or Broadcast)
                </label>
                <textarea
                  rows={2}
                  value={formAnnouncement}
                  onChange={(e) => setFormAnnouncement(e.target.value)}
                  placeholder="e.g. Please proceed to the assembly courtyard in orderly fashion..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]"
                />
              </div>

              {/* Repetition & Volume */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Repetition Count
                  </label>
                  <select
                    value={formRepeatCount}
                    onChange={(e) => setFormRepeatCount(Number(e.target.value))}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-[#12C8E8]"
                  >
                    <option value={1}>1x (Once)</option>
                    <option value={2}>2x (Twice)</option>
                    <option value={3}>3x (Thrice - Recommended)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Volume Level ({formVolume}%)
                  </label>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={formVolume}
                    onChange={(e) => setFormVolume(Number(e.target.value))}
                    className="w-full mt-2 accent-[#12C8E8]"
                  />
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveEvent(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/60 text-xs font-bold rounded-xl transition"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveEvent(true)}
                className="px-5 py-2.5 bg-[#0A1B45] hover:bg-[#102A5C] text-white text-xs font-black rounded-xl transition"
              >
                Save & Submit for Principal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
