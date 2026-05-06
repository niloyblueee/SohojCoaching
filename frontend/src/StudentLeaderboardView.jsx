import { useCallback, useEffect, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function StudentLeaderboardView({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const loadStudentBatches = useCallback(async () => {
    try {
      const data = await apiFetch(`/students/${currentUser.id}/batches`, { withAuth: true });
      if (Array.isArray(data)) {
        setBatches(data);
        if (data.length > 0) setSelectedBatch(data[0].id);
      }
    } catch (error) {
      setStatus('Failed to load your batches.');
    }
  }, [currentUser.id]);

  const loadLeaderboard = useCallback(async () => {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/batches/${selectedBatch}/leaderboard`, { withAuth: true });
      setLeaderboard(data || []);
    } catch (error) {
      setStatus('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedBatch]);

  useEffect(() => { loadStudentBatches(); }, [loadStudentBatches]);
  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  return (
    <section className="quiz-workspace">
      <header className="quiz-header">
        <h2>Batch Leaderboard</h2>
        <p>See how you rank against your classmates.</p>
      </header>

      <div className="quiz-controls">
        <label className="quiz-filter-item">Select Batch</label>
        <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
            <option value="" disabled>-- Choose a batch --</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="quiz-content">
        <section className="quiz-list-panel">
          <table className="materials-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Rank</th>
                <th>Student</th>
                <th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center' }}>Avg %</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((student, index) => (
                <tr key={student.student_id} className={student.student_id === currentUser.id ? 'highlight-row' : ''}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : `#${index + 1}`}
                  </td>
                  <td>
                    {student.student_name} {student.student_id === currentUser.id && "(You)"}
                  </td>
                  <td style={{ textAlign: 'center' }}>{student.total_obtained_marks}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="quiz-badge neutral">{toPercent(student.average_percentage)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

export default StudentLeaderboardView;