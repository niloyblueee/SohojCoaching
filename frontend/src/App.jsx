import Login from './Login';
import AdminLayout from './layouts/AdminLayout';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';
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

  if (authState.user.role === 'admin') {
    return <AdminLayout user={authState.user} onLogout={logout} />;
  }

  if (authState.user.role === 'teacher') {
    return <TeacherLayout user={authState.user} onLogout={logout} />;
  }

  if (authState.user.role === 'student') {
    return <StudentLayout user={authState.user} onLogout={logout} />;
  }

  return <Login onAuthSuccess={completeLogin} />;
}

export default App;
