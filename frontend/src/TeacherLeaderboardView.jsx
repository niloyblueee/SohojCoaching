import { useCallback, useEffect, useState, useMemo } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function TeacherLeaderboardView({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const loadBatches = useCallback(async () => {
    try {
      const data = await apiFetch('/batches', { withAuth: true });
      if (Array.isArray(data)) {
        setBatches(data);
        if (data.length > 0) setSelectedBatch(data[0].id);
      }
    } catch (error) {
      console.error(error);
      setStatus('Failed to load batches.');
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const loadLeaderboard = useCallback(async () => {
    if (!selectedBatch) return;
    setLoading(true);
    setStatus('');
    setLeaderboard([]);

    try {
      const data = await apiFetch(`/batches/${selectedBatch}/leaderboard`, { withAuth: true });
      setLeaderboard(data || []);
    } catch (error) {
      setStatus('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedBatch]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const worstStudents = useMemo(() => {
    if (!leaderboard.length) return [];
    
    const minAvg = Math.min(...leaderboard.map(s => s.average_percentage));
    
    return leaderboard.filter(s => s.average_percentage === minAvg);
  }, [leaderboard]);

  return (
    <section className="quiz-workspace">
      <header className="quiz-header">
        <h2>Batch Leaderboard</h2>
      </header>

      <div className="quiz-filters">
        <select 
          value={selectedBatch} 
          onChange={(e) => setSelectedBatch(e.target.value)}
          disabled={loading}
        >
          {batches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {status && <p className="status-msg">{status}</p>}

      {loading ? (
        <div className="text-center py-5">Loading...</div>
      ) : (
        <div className="quiz-content">
          <section className="quiz-list-panel">
            <div className="table-responsive">
              <table className="materials-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center' }}>Rank</th>
                    <th>Student</th>
                    <th style={{ textAlign: 'center' }}>Quizzes</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th style={{ textAlign: 'center' }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((student, index) => (
                    <tr key={student.student_id}>
                      <td style={{ textAlign: 'center' }}>
                          {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : `#${index + 1}`}
                      </td>
                      <td style={{ fontWeight: '500' }}>{student.student_name}</td>
                      <td style={{ textAlign: 'center' }}>{student.graded_quizzes}</td>
                      <td style={{ textAlign: 'center', color: '#007bff', fontWeight: 'bold' }}>
                        {student.total_obtained_marks}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`quiz-badge ${student.average_percentage >= 80 ? 'success' : student.average_percentage < 40 ? 'danger' : 'neutral'}`}>
                          {toPercent(student.average_percentage)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {worstStudents.length > 0 && (
              <div className="worst-record-section" style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px' }}>
                <p style={{ margin: 0 }}>
                  The following student(s) currently have the lowest average record: {' '}
                  <strong>
                    {worstStudents.map(s => `${s.student_name} (${toPercent(s.average_percentage)})`).join(', ')}
                  </strong>
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default TeacherLeaderboardView;