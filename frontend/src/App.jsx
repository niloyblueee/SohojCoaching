import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ManagementDashboard from './ManagementDashboard';
import MaterialTeacherView from './MaterialTeacherView';
import MaterialStudentView from './MaterialStudentView';
import './App.css';

function App() {
  return (
    <Router>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/management" style={{ marginRight: '10px' }}>Management Dashboard</Link>
        <Link to="/material-teacher-view" style={{ marginRight: '10px' }}>Teacher Materials</Link>
        <Link to="/material-student-view">Student Materials</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<h2>Home Page</h2>} />
        <Route path="/management" element={<ManagementDashboard />} /> // Niloy 
        <Route path="/material-teacher-view" element={<MaterialTeacherView />} /> // Niloy
        <Route path="/material-student-view" element={<MaterialStudentView />} /> // Niloy
      </Routes>
    </Router>
  );
}

export default App;
