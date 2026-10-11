import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BellStateProvider } from './context/BellStateContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { PrincipalDashboard } from './pages/PrincipalDashboard';
import { RegulatorDashboard } from './pages/RegulatorDashboard';
import { SchoolAdminDashboard } from './pages/SchoolAdminDashboard';
import { BellPhoneScreen } from './pages/BellPhoneScreen';
import { InstallPrompt } from './components/InstallPrompt';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, role, isBellPhoneMode, isLoading } = useAuth();

  // The school phone at school opens to a different home screen, not the login page.
  // It stays signed in unattended.
  if (isBellPhoneMode) {
    return <BellPhoneScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1B45] text-white flex items-center justify-center">
        <p className="text-sm font-semibold">Checking your BellNexa session…</p>
      </div>
    );
  }

  // Everyone who uses the app has to log in, so the first page is a sign-in screen rather than a dashboard.
  if (!isAuthenticated) {
    return <Login />;
  }

  // Once signed in, the server directs each person to their respective destination
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {role === 'super_admin' && <SuperAdminDashboard />}
        {role === 'principal' && <PrincipalDashboard />}
        {role === 'regulator' && <RegulatorDashboard />}
        {role === 'admin' && <SchoolAdminDashboard />}
        {(role === 'support' || role === 'auditor') && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-200">
            Your account is authenticated, but a dashboard for this school role has not been implemented yet.
          </div>
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BellStateProvider>
        <MainAppContent />
        <InstallPrompt />
      </BellStateProvider>
    </AuthProvider>
  );
};

export default App;
