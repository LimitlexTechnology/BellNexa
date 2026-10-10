export type UserRole = 'super_admin' | 'principal' | 'regulator' | 'admin' | 'support' | 'auditor';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_super_admin: boolean;
  role?: UserRole;
  requires_2fa?: boolean;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  name: string;
  code: string;
  timezone: string;
  logo_url?: string;
  branding_primary: string;
  branding_secondary: string;
  branding_accent: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolMembership {
  id: string;
  school_id: string;
  user_id: string;
  role: 'principal' | 'regulator' | 'admin' | 'support' | 'auditor';
  is_approved: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  school_id: string;
  device_name: string;
  device_hardware_id: string;
  app_version: string;
  battery_level?: number;
  storage_free_mb?: number;
  is_online: boolean;
  speaker_connected?: boolean;
  last_checkin_at?: string;
  applied_revision: number;
  created_at: string;
}

export interface Schedule {
  id: string;
  school_id: string;
  name: string;
  revision: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EventCategory = 
  | 'morning_assembly'
  | 'lesson_commencement'
  | 'lesson_change'
  | 'snack_break'
  | 'worship_time'
  | 'lunch_break'
  | 'closing_time'
  | 'emergency'
  | 'custom';

export type EventApprovalStatus = 'draft' | 'awaiting_principal' | 'live_on_device';

export interface ScheduleEvent {
  id: string;
  schedule_id: string;
  school_id: string;
  event_name: string;
  category: EventCategory;
  start_time: string; // HH:mm:ss format
  days_of_week: number[]; // 1=Mon .. 7=Sun
  is_enabled: boolean;
  audio_asset_id?: string;
  announcement_text?: string;
  language: string;
  volume: number;
  repeat_count: number; // Number of times announcement repeats (e.g. 3 = Thrice)
  approval_status?: EventApprovalStatus;
  change_summary?: string;
  last_edited_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface PendingApproval {
  id: string;
  school_id: string;
  type: 'timetable_edit' | 'new_event' | 'delete_event' | 'audio_upload';
  title: string;
  description: string;
  target_event_id?: string;
  event_payload?: Partial<ScheduleEvent>;
  audio_title?: string;
  audio_file?: string;
  submitted_by: string;
  submitted_by_name: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
}

export interface PlaybackEvent {
  id: string;
  school_id: string;
  event_name: string;
  category: EventCategory;
  played_at: string;
  duration_seconds: number;
  volume_level: number;
  status: 'completed' | 'interrupted_emergency' | 'paused';
}

export interface AudioAsset {
  id: string;
  school_id: string;
  title: string;
  file_path: string;
  file_size: number;
  duration_seconds: number;
  checksum_sha256: string;
  created_at: string;
}

export interface DeviceCommand {
  id: string;
  school_id: string;
  device_id: string;
  command_type: 'sync_schedule' | 'sync_audio' | 'run_diagnostic' | 'pause_ringing' | 'resume_ringing' | 'play_test_announcement' | 'emergency_stop';
  payload?: Record<string, any>;
  status: 'pending' | 'executed' | 'expired' | 'failed';
  created_by?: string;
  expires_at: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  school_id: string;
  user_id: string;
  device_id?: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'investigating' | 'waiting_for_school' | 'resolved' | 'closed';
  description: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  school_id: string;
  school_name: string;
  email: string;
  role: 'principal' | 'regulator';
  token: string;
  expires_at: string;
  is_used: boolean;
  invited_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  school_id?: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}
