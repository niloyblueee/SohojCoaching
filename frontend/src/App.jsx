import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ManagementDashboard from './ManagementDashboard';
import MaterialTeacherView from './MaterialTeacherView';
import MaterialStudentView from './MaterialStudentView';
import ScriptUploadView from './ScriptUploadView';
import MyScriptsView from './MyScriptsView';
import './App.css';

function App() {
  return (
    <Router>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/management" style={{ marginRight: '10px' }}>Management Dashboard</Link>
        <Link to="/material-teacher-view" style={{ marginRight: '10px' }}>Teacher Materials</Link>
        <Link to="/material-student-view" style={{ marginRight: '10px' }}>Student Materials</Link>
        <Link to="/script-upload-view" style={{ marginRight: '10px' }}>Script Upload</Link>
        <Link to="/my-scripts">My Scripts</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<h2>Home Page</h2>} />
        <Route path="/management" element={<ManagementDashboard />} /> // Niloy 
        <Route path="/material-teacher-view" element={<MaterialTeacherView />} /> // Niloy FR-19
        <Route path="/material-student-view" element={<MaterialStudentView />} /> // Niloy FR-20
        <Route path="/script-upload-view" element={<ScriptUploadView />} /> // Niloy FR-17
        <Route path="/my-scripts" element={<MyScriptsView />} /> // Niloy FR-18
      </Routes>
    </Router>
  );
}

export default App;
