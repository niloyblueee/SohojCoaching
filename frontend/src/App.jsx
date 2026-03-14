import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import Login from './Login';
import ManagementDashboard from './ManagementDashboard';
import MaterialTeacherView from './MaterialTeacherView';
import ScriptUploadView from './ScriptUploadView';
import './App.css';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'sohojcoaching_auth';

function AdminLayout({ user, onLogout }) {
  return (
    <BrowserRouter>
      <div className="admin-shell">
        <header className="admin-topbar">
          <div>
            <p className="admin-brand">Sohoj Coaching Admin</p>
            <h1>Management Console</h1>
          </div>

          <div className="admin-session">
            <span>{user?.name || 'Admin'}</span>
            <button type="button" onClick={onLogout}>Logout</button>
          </div>
        </header>

        <nav className="admin-nav">
          <NavLink to="/admin/management">Dashboard</NavLink>
          <NavLink to="/admin/materials">Materials</NavLink>
          <NavLink to="/admin/scripts">Exam Scripts</NavLink>
        </nav>

        <main className="admin-content">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/management" replace />} />
            <Route path="/admin/management" element={<ManagementDashboard />} />
            <Route path="/admin/materials" element={<MaterialTeacherView />} />
            <Route path="/admin/scripts" element={<ScriptUploadView />} />
            <Route path="*" element={<Navigate to="/admin/management" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    token: null,
    user: null
  });

  useEffect(() => {
    const restoreSession = async () => {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) {
        setAuthState({ loading: false, token: null, user: null });
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed?.token) {
          setAuthState({ loading: false, token: null, user: null });
          return;
        }

        const response = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${parsed.token}`
          }
        });

        if (!response.ok) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ loading: false, token: null, user: null });
          return;
        }

        const payload = await response.json();
        const session = {
          token: parsed.token,
          user: payload.user
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        setAuthState({ loading: false, ...session });
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState({ loading: false, token: null, user: null });
      }
    };

    restoreSession();
  }, []);

  const handleAuthSuccess = (payload) => {
    const session = {
      token: payload.token,
      user: payload.user
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    setAuthState({ loading: false, ...session });
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState({ loading: false, token: null, user: null });
  };

  if (authState.loading) {
    return (
      <div className="app-loading">
        <p>Checking session...</p>
      </div>
    );
  }

  if (!authState.token || !authState.user) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

  return <AdminLayout user={authState.user} onLogout={handleLogout} />;
}

export default App;
