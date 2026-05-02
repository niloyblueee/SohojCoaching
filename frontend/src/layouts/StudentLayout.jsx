import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import MaterialStudentView from '../MaterialStudentView';
import MyScriptsView from '../MyScriptsView';
import AttendanceStudentAnalytics from '../AttendanceStudentAnalytics';
import StudentFeeOverview from '../components/student/StudentFeeOverview';
import StudentQuizCatalogView from '../StudentQuizCatalogView';

function StudentLayout({ user, onLogout }) {
    return (
        <BrowserRouter>
            <div className="role-shell role-shell-student">
                <header className="role-topbar">
                    <div>
                        <p className="role-brand">Sohoj Coaching Student</p>
                        <h1>Student Workspace</h1>
                    </div>

                    <div className="role-session">
                        <span>{user?.name || 'Student'}</span>
                        <button type="button" onClick={onLogout}>Logout</button>
                    </div>
                </header>

                <nav className="role-nav">
                    <NavLink to="/student/materials">Materials</NavLink>
                    <NavLink to="/student/scripts">My Scripts</NavLink>
                    <NavLink to="/student/attendance">Attendance</NavLink>
                    <NavLink to="/student/quizzes">Quizzes</NavLink>
                    <NavLink to="/student/fees">Fees</NavLink>
                </nav>

                <main className="role-content">
                    <Routes>
                        <Route path="/" element={<Navigate to="/student/materials" replace />} />
                        <Route path="/student/materials" element={<MaterialStudentView currentUser={user} />} />
                        <Route path="/student/scripts" element={<MyScriptsView currentUser={user} />} />
                        <Route path="/student/attendance" element={<AttendanceStudentAnalytics user={user} />} />
                        <Route path="/student/quizzes" element={<StudentQuizCatalogView currentUser={user} />} />
                        <Route path="/student/fees" element={<StudentFeeOverview />} />
                        <Route path="*" element={<Navigate to="/student/materials" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default StudentLayout;
