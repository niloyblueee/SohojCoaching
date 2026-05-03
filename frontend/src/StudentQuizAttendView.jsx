import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import { getStudentQuizzes, startStudentQuizAttempt } from './services/quizApi';

const formatStartsAt = (value) => {
  if (!value) return 'Starts immediately';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Schedule unavailable';
  return date.toLocaleString();
};

const formatEntryCloseAt = (value) => {
  if (!value) return 'No last entry limit';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last entry time unavailable';
  return `Last entry: ${date.toLocaleString()}`;
};

function StudentQuizAttendView({ currentUser }) {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState('');

  const metrics = useMemo(() => {
    const total = quizzes.length;
    const ready = quizzes.filter((quiz) => quiz.can_attempt || quiz.can_resume).length;
    const resumable = quizzes.filter((quiz) => quiz.can_resume).length;
    return { total, ready, resumable };
  }, [quizzes]);

  const loadBatches = useCallback(async () => {
    if (!currentUser?.id) {
      setStatus('Unable to determine logged-in student.');
      return;
    }

    try {
      const data = await apiFetch(`/students/${currentUser.id}/batches`, { withAuth: true });
      setBatches(Array.isArray(data) ? data : []);
      setSelectedBatch((prev) => prev || data?.[0]?.id || '');
    } catch (err) {
      setStatus(err.message || 'Failed to load enrolled batches.');
    }
  }, [currentUser?.id]);

  const loadQuizzes = useCallback(async (batchId) => {
    if (!batchId) {
      setQuizzes([]);
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      const data = await getStudentQuizzes(batchId);
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus(err.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadQuizzes(selectedBatch);
  }, [selectedBatch, loadQuizzes]);

  const handleAttendQuiz = async (quiz) => {
    setStatus('');

    if (quiz.can_resume && quiz.resume_attempt_id) {
      navigate(`/student/attend-quiz/${quiz.resume_attempt_id}`);
      return;
    }

    if (!quiz.can_attempt) {
      setStatus(quiz.attempt_message || 'This quiz is not available right now.');
      return;
    }

    setStartingQuizId(quiz.id);
    try {
      const payload = await startStudentQuizAttempt(quiz.id);
      if (!payload?.attempt_id) {
        throw new Error('Could not start quiz attempt.');
      }
      navigate(`/student/attend-quiz/${payload.attempt_id}`);
    } catch (err) {
      setStatus(err.message || 'Failed to start quiz.');
    } finally {
      setStartingQuizId('');
    }
  };

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <p className="quiz-kicker">FR-22: Quiz Submission</p>
          <h2>Attend Quiz</h2>
          <p>Select a batch, then start or resume quizzes from one clean workspace.</p>
        </div>
      </header>

      <section className="quiz-metrics-grid">
        <article className="quiz-metric-card">
          <p>Total Quizzes</p>
          <strong>{metrics.total}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Ready to Attend</p>
          <strong>{metrics.ready}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>In Progress</p>
          <strong>{metrics.resumable}</strong>
        </article>
      </section>

      <section className="quiz-list-panel">
        <div className="quiz-student-filter">
          <label>
            My Batch
            <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)}>
              <option value="">-- Select Batch --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name || batch.batch_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="quiz-btn ghost"
            onClick={() => loadQuizzes(selectedBatch)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Quizzes'}
          </button>
        </div>

        {loading && <p className="quiz-empty">Loading quizzes...</p>}
        {!loading && status && <p className="quiz-status quiz-status-error">{status}</p>}
        {!loading && !status && quizzes.length === 0 && (
          <p className="quiz-empty">No quizzes available for this batch yet.</p>
        )}

        <div className="quiz-created-grid">
          {quizzes.map((quiz) => (
            <article key={quiz.id} className="quiz-created-card">
              <div className="quiz-created-head">
                <h4>{quiz.title}</h4>
                <span className="quiz-badge">{quiz.total_marks} marks</span>
              </div>
              <p>{quiz.description || 'No description'}</p>
              <div className="quiz-created-meta">
                <span>{quiz.availability_type === 'anytime' ? 'Anytime' : 'Scheduled'}</span>
                <span>{quiz.duration_minutes} min</span>
                <span>{quiz.question_count} questions</span>
                <span>{quiz.attempt_mode === 'repeatable' ? 'Repeatable' : 'One Time'}</span>
              </div>
              <p className="quiz-note">{formatStartsAt(quiz.starts_at)}</p>
              <p className="quiz-note">{formatEntryCloseAt(quiz.entry_close_at)}</p>
              <p className="quiz-note">{quiz.attempt_message}</p>
              <div className="quiz-submit-row quiz-submit-row-left">
                <button
                  type="button"
                  className="quiz-btn primary"
                  onClick={() => handleAttendQuiz(quiz)}
                  disabled={Boolean(startingQuizId) || (!quiz.can_attempt && !quiz.can_resume)}
                >
                  {startingQuizId === quiz.id
                    ? 'Opening...'
                    : quiz.can_resume
                      ? 'Resume Quiz'
                      : 'Start Quiz'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default StudentQuizAttendView;
