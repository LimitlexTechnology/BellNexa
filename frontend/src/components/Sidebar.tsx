import React from 'react';
import { 
  LayoutDashboard, 
  CalendarClock, 
  Smartphone, 
  Volume2, 
  LifeBuoy, 
  ShieldAlert, 
  Settings,
  Building2,
  ListOrdered
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { role } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'schedules', label: 'Bell Schedules & Timetables', icon: CalendarClock },
    { id: 'devices', label: 'Android Bell Devices', icon: Smartphone },
    { id: 'audio', label: 'Audio Library & Voice', icon: Volume2 },
    { id: 'support', label: 'Support & Incidents', icon: LifeBuoy },
    { id: 'settings', label: 'School Settings & Branding', icon: Settings },
  ];

  if (role === 'super_admin') {
    navItems.unshift(
      { id: 'super_admin_control', label: 'Super Admin Control Centre', icon: Building2 },
      { id: 'audit_logs', label: 'Platform Audit Logs', icon: ShieldAlert }
    );
  }

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase">
          {role === 'super_admin' ? 'Platform Governance' : 'School Bell Control'}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-bellnexa-navy/20 text-white border border-bellnexa-navy/40 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-bellnexa-cyanBright' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Current school workspace */}
      <div className="p-3 rounded-xl bg-gradient-to-b from-slate-800/80 to-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center space-x-2 text-bellnexa-cyanBright font-semibold mb-1">
          <Building2 className="w-3.5 h-3.5" />
          <span>Vilac International School</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Current pilot school workspace in Accra, Ghana.
        </p>
      </div>
    </aside>
  );
};
