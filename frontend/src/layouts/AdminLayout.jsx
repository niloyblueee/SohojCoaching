import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import ManagementDashboard from '../ManagementDashboard';
import MaterialTeacherView from '../MaterialTeacherView';
import ScriptUploadView from '../ScriptUploadView';

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

export default AdminLayout;
