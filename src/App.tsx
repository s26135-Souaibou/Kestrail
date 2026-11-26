/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthScreen } from './components/AuthScreen';
import { CompanyOnboarding } from './components/CompanyOnboarding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceShell } from './components/WorkspaceShell';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyDataProvider, useCompanyData } from './contexts/CompanyDataContext';

function AppRouter() {
  const { firebaseUser, authReady, profileLoading } = useAuth();
  const { memberships, membershipsLoaded } = useCompanyData();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-600">Initializing Kestrel Workspace...</div>
      </div>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified) {
    return <AuthScreen />;
  }

  if (profileLoading || !membershipsLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-600">Loading your companies and permissions...</div>
      </div>
    );
  }

  if (memberships.length === 0) {
    return <CompanyOnboarding />;
  }

  return <WorkspaceShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CompanyDataProvider>
          <AppRouter />
        </CompanyDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
