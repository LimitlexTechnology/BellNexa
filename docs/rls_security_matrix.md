# BellNexa Row Level Security (RLS) & Access Control Matrix

| Table | Super Admin | School Admin | Support Operator | Auditor | Public / Unauth |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `profiles` | FULL | Read/Update Self | Read Self | Read Self | BLOCKED |
| `schools` | FULL | Read Own | Read Assigned | Read Assigned | BLOCKED |
| `school_memberships` | FULL | Read Own | Read Assigned | Read Assigned | BLOCKED |
| `invitations` | FULL | Manage Own | BLOCKED | BLOCKED | Token Verify Only |
| `devices` | FULL | Manage Own | Read Assigned | Read Assigned | BLOCKED |
| `schedules` | FULL | Manage Own | Read Assigned | Read Assigned | BLOCKED |
| `schedule_events` | FULL | Manage Own | Read Assigned | Read Assigned | BLOCKED |
| `audio_assets` | FULL | Manage Own | Read Assigned | Read Assigned | BLOCKED |
| `device_commands` | FULL | Manage Own | Permissioned | BLOCKED | BLOCKED |
| `playback_events` | FULL | Read Own | Read Assigned | Read Assigned | Device Insert |
| `support_tickets` | FULL | Manage Own | Manage Assigned | Read Own | BLOCKED |
| `audit_logs` | FULL | Read Filtered | BLOCKED | Read Filtered | BLOCKED |
