import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ManagementDashboard from './ManagementDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <nav style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '20px' }}>
        <Link to="/" style={{ marginRight: '10px' }}>Home</Link>
        <Link to="/management">Management Dashboard</Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<h2>Home Page</h2>} />
        <Route path="/management" element={<ManagementDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
