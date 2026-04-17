import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import MaterialTeacherView from '../MaterialTeacherView';
import ScriptUploadView from '../ScriptUploadView';
import AttendanceTeacherAnalytics from '../AttendanceTeacherAnalytics';

function TeacherLayout({ user, onLogout }) {
    return (
        <BrowserRouter>
            <div className="role-shell role-shell-teacher">
                <header className="role-topbar">
                    <div>
                        <p className="role-brand">Sohoj Coaching Teacher</p>
                        <h1>Teacher Workspace</h1>
                    </div>

                    <div className="role-session">
                        <span>{user?.name || 'Teacher'}</span>
                        <button type="button" onClick={onLogout}>Logout</button>
                    </div>
                </header>

                <nav className="role-nav">
                    <NavLink to="/teacher/materials">Materials</NavLink>
                    <NavLink to="/teacher/scripts">Exam Scripts</NavLink>
                    <NavLink to="/teacher/attendance">Attendance</NavLink>
                </nav>

                <main className="role-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/teacher/materials" replace />} />
                        <Route path="/teacher/materials" element={<MaterialTeacherView currentUser={user} />} />
                        <Route path="/teacher/scripts" element={<ScriptUploadView currentUser={user} />} />
                        <Route path="/teacher/attendance" element={<AttendanceTeacherAnalytics />} />
                        <Route path="*" element={<Navigate to="/teacher/materials" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default TeacherLayout;
