import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import BatchManagementPage from '../BatchManagementPage';
import BatchOverviewPage from '../BatchOverviewPage';
import BatchStudentCountPage from '../BatchStudentCountPage';
import ManagementDashboard from '../ManagementDashboard';
import MaterialTeacherView from '../MaterialTeacherView';
import ScriptUploadView from '../ScriptUploadView';
import StudentList from '../components/admin/StudentList';
import FeeManagement from '../components/admin/FeeManagement';

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
                    <NavLink to="/admin/batch-overview">Batch Overview</NavLink>
                    <NavLink to="/admin/batch-counts">Batch wise student Count</NavLink>
                    <NavLink to="/admin/fees">Fee Management</NavLink>
                </nav>

                <main className="admin-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/admin/batches" replace />} />
                        <Route path="/admin/management" element={<ManagementDashboard />} />
                        <Route path="/admin/students" element={<StudentList />} />
                        <Route path="/admin/batches" element={<BatchManagementPage />} />
                        <Route path="/admin/batch-overview" element={<BatchOverviewPage />} />
                        <Route path="/admin/batch-counts" element={<BatchStudentCountPage />} />
                        <Route path="/admin/fees" element={<FeeManagement />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default AdminLayout;
