import React, { useCallback, useEffect, useState } from 'react';
import { Campus, School } from '../types/database';
import { supabase } from '../lib/supabase';
import { isValidIanaTimeZone } from '../lib/timezone';

interface SchoolSettingsPanelProps {
  school: School;
  onUpdated?: (school: School) => void;
  onCampusesUpdated?: (campuses: Campus[]) => void;
  onSettingsLoaded?: (settings: { allowLatePlayback: boolean }) => void;
}

interface CampusForm {
  name: string;
  country: string;
  region: string;
  city: string;
  address: string;
  timezone: string;
  logo_url: string;
  default_open_time: string;
  default_close_time: string;
}

const timeInputValue = (value: string | null | undefined, fallback: string): string =>
  value ? value.slice(0, 5) : fallback;

const emptyCampus: CampusForm = {
  name: '',
  country: '',
  region: '',
  city: '',
  address: '',
  timezone: '',
  logo_url: '',
  default_open_time: '07:00',
  default_close_time: '16:00',
};

export const SchoolSettingsPanel: React.FC<SchoolSettingsPanelProps> = ({
  school,
  onUpdated,
  onCampusesUpdated,
  onSettingsLoaded,
}) => {
  const [schoolForm, setSchoolForm] = useState({
    name: school.name,
    code: school.code,
    country: school.country,
    region: school.region ?? '',
    city: school.city ?? '',
    address: school.address ?? '',
    timezone: school.timezone,
    logo_url: school.logo_url ?? '',
    default_open_time: timeInputValue(school.default_open_time, '07:00'),
    default_close_time: timeInputValue(school.default_close_time, '16:00'),
  });
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusForm, setCampusForm] = useState<CampusForm>(emptyCampus);
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [allowLatePlayback, setAllowLatePlayback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [campusResult, settingsResult] = await Promise.all([
        supabase
          .from('campuses')
          .select('id, school_id, name, country, region, city, address, timezone, logo_url, default_open_time, default_close_time, settings, is_default, is_active, created_at, updated_at')
          .eq('school_id', school.id)
          .order('is_default', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('school_settings')
          .select('allow_late_playback')
          .eq('school_id', school.id)
          .maybeSingle(),
      ]);
      if (campusResult.error) throw campusResult.error;
      if (settingsResult.error) throw settingsResult.error;
      const loadedCampuses = campusResult.data ?? [];
      setCampuses(loadedCampuses);
      onCampusesUpdated?.(loadedCampuses);
      const loadedSettings = { allowLatePlayback: settingsResult.data?.allow_late_playback ?? false };
      setAllowLatePlayback(loadedSettings.allowLatePlayback);
      onSettingsLoaded?.(loadedSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load school settings.');
    } finally {
      setIsLoading(false);
    }
  }, [onCampusesUpdated, onSettingsLoaded, school.id]);

  useEffect(() => {
    setSchoolForm({
      name: school.name,
      code: school.code,
      country: school.country,
      region: school.region ?? '',
      city: school.city ?? '',
      address: school.address ?? '',
      timezone: school.timezone,
      logo_url: school.logo_url ?? '',
      default_open_time: timeInputValue(school.default_open_time, '07:00'),
      default_close_time: timeInputValue(school.default_close_time, '16:00'),
    });
    void loadSettings();
  }, [loadSettings, school]);

  const saveSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolForm.name.trim() || !schoolForm.code.trim() || !schoolForm.country.trim()) {
      setError('School name, code, and country are required.');
      return;
    }
    if (!isValidIanaTimeZone(schoolForm.timezone.trim())) {
      setError('Enter a valid IANA time zone, such as Africa/Accra or Europe/London.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const values = {
        name: schoolForm.name.trim(),
        code: schoolForm.code.trim().toUpperCase(),
        country: schoolForm.country.trim(),
        region: schoolForm.region.trim() || null,
        city: schoolForm.city.trim() || null,
        address: schoolForm.address.trim() || null,
        timezone: schoolForm.timezone.trim(),
        logo_url: schoolForm.logo_url.trim() || null,
        default_open_time: schoolForm.default_open_time,
        default_close_time: schoolForm.default_close_time,
        updated_at: new Date().toISOString(),
      };
      const { data, error: schoolError } = await supabase
        .from('schools')
        .update(values)
        .eq('id', school.id)
        .select('id, name, code, timezone, country, region, city, address, default_open_time, default_close_time, logo_url, branding_primary, branding_secondary, branding_accent, is_active, created_at, updated_at')
        .single();
      if (schoolError) throw schoolError;

      const defaultCampus = campuses.find(campus => campus.is_default);
      if (defaultCampus) {
        const { error: campusError } = await supabase
          .from('campuses')
          .update({
            country: values.country,
            region: values.region,
            city: values.city,
            address: values.address,
            timezone: values.timezone,
            logo_url: values.logo_url,
            default_open_time: values.default_open_time,
            default_close_time: values.default_close_time,
            updated_at: values.updated_at,
          })
          .eq('id', defaultCampus.id)
          .eq('school_id', school.id);
        if (campusError) throw campusError;
      }

      onUpdated?.(data);
      setMessage('School details saved.');
      await loadSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save school details.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSchoolSettings = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: settingsError } = await supabase
        .from('school_settings')
        .update({ allow_late_playback: allowLatePlayback, updated_at: new Date().toISOString() })
        .eq('school_id', school.id);
      if (settingsError) throw settingsError;
      setMessage('School operating settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save school operating settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const editCampus = (campus: Campus) => {
    setEditingCampusId(campus.id);
    setCampusForm({
      name: campus.name,
      country: campus.country,
      region: campus.region ?? '',
      city: campus.city ?? '',
      address: campus.address ?? '',
      timezone: campus.timezone,
      logo_url: campus.logo_url ?? '',
      default_open_time: timeInputValue(campus.default_open_time, '07:00'),
      default_close_time: timeInputValue(campus.default_close_time, '16:00'),
    });
    setError(null);
    setMessage(null);
  };

  const resetCampusForm = () => {
    setEditingCampusId(null);
    setCampusForm({
      ...emptyCampus,
      country: schoolForm.country,
      region: schoolForm.region,
      city: schoolForm.city,
      address: schoolForm.address,
      timezone: schoolForm.timezone,
      logo_url: schoolForm.logo_url,
      default_open_time: schoolForm.default_open_time,
      default_close_time: schoolForm.default_close_time,
    });
  };

  const saveCampus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campusForm.name.trim() || !campusForm.country.trim()) {
      setError('Campus name and country are required.');
      return;
    }
    if (!isValidIanaTimeZone(campusForm.timezone.trim())) {
      setError('Enter a valid IANA time zone, such as America/New_York.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const values = {
        name: campusForm.name.trim(),
        country: campusForm.country.trim(),
        region: campusForm.region.trim() || null,
        city: campusForm.city.trim() || null,
        address: campusForm.address.trim() || null,
        timezone: campusForm.timezone.trim(),
        logo_url: campusForm.logo_url.trim() || null,
        default_open_time: campusForm.default_open_time,
        default_close_time: campusForm.default_close_time,
        updated_at: new Date().toISOString(),
      };

      if (editingCampusId) {
        const { error: campusError } = await supabase
          .from('campuses')
          .update(values)
          .eq('id', editingCampusId)
          .eq('school_id', school.id);
        if (campusError) throw campusError;
        setMessage('Campus details saved.');
      } else {
        const { error: campusError } = await supabase
          .from('campuses')
          .insert({ ...values, school_id: school.id });
        if (campusError) throw campusError;
        setMessage('Campus created with its own timetable.');
      }
      resetCampusForm();
      await loadSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save campus details.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-300';

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div>
        <h2 className="text-lg font-bold text-white">School and campus settings</h2>
        <p className="mt-1 text-xs text-slate-400">
          Times are local wall-clock times in the selected school or campus time zone. No computer time zone is used.
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-xs text-emerald-200">{message}</p>}
      {isLoading && <p className="text-xs text-slate-400">Loading school settings…</p>}

      <form onSubmit={saveSchool} className="space-y-3 border-b border-slate-800 pb-5">
        <h3 className="text-sm font-bold text-white">School profile and defaults</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>School name<input required className={inputClass} value={schoolForm.name} onChange={event => setSchoolForm({ ...schoolForm, name: event.target.value })} /></label>
          <label className={labelClass}>School code<input required className={inputClass} value={schoolForm.code} onChange={event => setSchoolForm({ ...schoolForm, code: event.target.value })} /></label>
          <label className={labelClass}>Country<input required className={inputClass} value={schoolForm.country} onChange={event => setSchoolForm({ ...schoolForm, country: event.target.value })} /></label>
          <label className={labelClass}>Region or state<input className={inputClass} value={schoolForm.region} onChange={event => setSchoolForm({ ...schoolForm, region: event.target.value })} /></label>
          <label className={labelClass}>City or locality<input className={inputClass} value={schoolForm.city} onChange={event => setSchoolForm({ ...schoolForm, city: event.target.value })} /></label>
          <label className={labelClass}>IANA time zone<input required className={inputClass} placeholder="Europe/London" value={schoolForm.timezone} onChange={event => setSchoolForm({ ...schoolForm, timezone: event.target.value })} /></label>
          <label className={labelClass}>Street address<input className={inputClass} value={schoolForm.address} onChange={event => setSchoolForm({ ...schoolForm, address: event.target.value })} /></label>
          <label className={labelClass}>School logo URL<input type="url" className={inputClass} value={schoolForm.logo_url} onChange={event => setSchoolForm({ ...schoolForm, logo_url: event.target.value })} /></label>
          <label className={labelClass}>Default opening time ({schoolForm.timezone})<input type="time" required className={inputClass} value={schoolForm.default_open_time} onChange={event => setSchoolForm({ ...schoolForm, default_open_time: event.target.value })} /></label>
          <label className={labelClass}>Default closing time ({schoolForm.timezone})<input type="time" required className={inputClass} value={schoolForm.default_close_time} onChange={event => setSchoolForm({ ...schoolForm, default_close_time: event.target.value })} /></label>
        </div>
        <button disabled={isSaving} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          {isSaving ? 'Saving…' : 'Save school profile'}
        </button>
      </form>

      <div className="space-y-3 border-b border-slate-800 pb-5">
        <h3 className="text-sm font-bold text-white">School-specific settings</h3>
        <label className="flex items-center gap-2 text-xs text-slate-200">
          <input type="checkbox" checked={allowLatePlayback} onChange={event => setAllowLatePlayback(event.target.checked)} />
          Allow late playback of scheduled bells
        </label>
        <button type="button" onClick={() => void saveSchoolSettings()} disabled={isSaving} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
          Save operating settings
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Campuses and branches</h3>
          {campuses.map(campus => (
            <div key={campus.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div>
                <p className="text-sm font-semibold text-white">{campus.name}{campus.is_default ? ' · Main' : ''}</p>
                <p className="text-xs text-slate-400">{[campus.city, campus.region, campus.country].filter(Boolean).join(', ')}</p>
                <p className="mt-1 text-xs font-mono text-cyan-200">{campus.timezone} · {timeInputValue(campus.default_open_time, '07:00')}–{timeInputValue(campus.default_close_time, '16:00')}</p>
              </div>
              <button type="button" onClick={() => editCampus(campus)} className="text-xs font-bold text-cyan-300 hover:underline">Edit</button>
            </div>
          ))}
          {!isLoading && campuses.length === 0 && <p className="text-xs text-slate-400">No campus records are available.</p>}
        </div>

        <form onSubmit={saveCampus} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="text-sm font-bold text-white">{editingCampusId ? 'Edit campus' : 'Add a campus or branch'}</h3>
          <label className={labelClass}>Campus name<input required className={inputClass} value={campusForm.name} onChange={event => setCampusForm({ ...campusForm, name: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Country<input required className={inputClass} value={campusForm.country} onChange={event => setCampusForm({ ...campusForm, country: event.target.value })} /></label>
            <label className={labelClass}>Region or state<input className={inputClass} value={campusForm.region} onChange={event => setCampusForm({ ...campusForm, region: event.target.value })} /></label>
            <label className={labelClass}>City<input className={inputClass} value={campusForm.city} onChange={event => setCampusForm({ ...campusForm, city: event.target.value })} /></label>
            <label className={labelClass}>IANA time zone<input required className={inputClass} placeholder="America/New_York" value={campusForm.timezone} onChange={event => setCampusForm({ ...campusForm, timezone: event.target.value })} /></label>
            <label className={labelClass}>Address<input className={inputClass} value={campusForm.address} onChange={event => setCampusForm({ ...campusForm, address: event.target.value })} /></label>
            <label className={labelClass}>Campus logo URL<input type="url" className={inputClass} value={campusForm.logo_url} onChange={event => setCampusForm({ ...campusForm, logo_url: event.target.value })} /></label>
            <label className={labelClass}>Opening time<input type="time" required className={inputClass} value={campusForm.default_open_time} onChange={event => setCampusForm({ ...campusForm, default_open_time: event.target.value })} /></label>
            <label className={labelClass}>Closing time<input type="time" required className={inputClass} value={campusForm.default_close_time} onChange={event => setCampusForm({ ...campusForm, default_close_time: event.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <button disabled={isSaving} className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
              {isSaving ? 'Saving…' : editingCampusId ? 'Save campus' : 'Create campus'}
            </button>
            {editingCampusId && <button type="button" onClick={resetCampusForm} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200">Cancel edit</button>}
          </div>
        </form>
      </div>
    </section>
  );
};
