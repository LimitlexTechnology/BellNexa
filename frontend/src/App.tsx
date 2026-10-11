import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BellStateProvider } from './context/BellStateContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { PrincipalDashboard } from './pages/PrincipalDashboard';
import { RegulatorDashboard } from './pages/RegulatorDashboard';
import { BellPhoneScreen } from './pages/BellPhoneScreen';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, role, isBellPhoneMode } = useAuth();

  // The school phone at school opens to a different home screen, not the login page.
  // It stays signed in unattended.
  if (isBellPhoneMode) {
    return <BellPhoneScreen />;
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
        {role !== 'super_admin' && role !== 'principal' && role !== 'regulator' && <PrincipalDashboard />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BellStateProvider>
        <MainAppContent />
      </BellStateProvider>
    </AuthProvider>
  );
};

export default App;
