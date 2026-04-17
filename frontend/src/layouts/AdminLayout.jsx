import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import BatchManagementPage from '../BatchManagementPage';
import ManagementDashboard from '../ManagementDashboard';
import MaterialTeacherView from '../MaterialTeacherView';
import ScriptUploadView from '../ScriptUploadView';
import StudentList from '../components/admin/StudentList';

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
                    <NavLink to="/admin/students">Students</NavLink>
                    <NavLink to="/admin/batches">Batches</NavLink>
                    <NavLink to="/admin/materials">Materials</NavLink>
                    <NavLink to="/admin/scripts">Exam Scripts</NavLink>
                </nav>

                <main className="admin-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/admin/batches" replace />} />
                        <Route path="/admin/management" element={<ManagementDashboard />} />
                        <Route path="/admin/students" element={<StudentList />} />
                        <Route path="/admin/batches" element={<BatchManagementPage />} />
                        <Route path="/admin/materials" element={<MaterialTeacherView />} />
                        <Route path="/admin/scripts" element={<ScriptUploadView />} />
                        <Route path="*" element={<Navigate to="/admin/batches" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default AdminLayout;
