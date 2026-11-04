import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import './theme/theme.css';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <div className="container py-4 text-white">
            <h1>TCG Event Hub</h1>
            <p>Welcome to TCG Event Hub</p>
          </div>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
