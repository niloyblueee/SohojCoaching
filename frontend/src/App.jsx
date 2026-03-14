import Login from './Login';
import AdminLayout from './layouts/AdminLayout';
import { useAuthSession } from './hooks/useAuthSession';
import './App.css';

function App() {
  const { authState, completeLogin, logout } = useAuthSession();

  if (authState.loading) {
    return (
      <div className="app-loading">
        <p>Checking session...</p>
      </div>
    );
  }

  if (!authState.token || !authState.user) {
    return <Login onAuthSuccess={completeLogin} />;
  }

  return <AdminLayout user={authState.user} onLogout={logout} />;
}

export default App;
