import { useEffect, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import { getStudentQuizzes } from './services/quizApi';

function StudentQuizCatalogView({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedQuizId, setExpandedQuizId] = useState('');

  const loadBatches = async () => {
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
  };

  const loadQuizzes = async (batchId) => {
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
  };

  useEffect(() => {
    loadBatches();
  }, [currentUser?.id]);

  useEffect(() => {
    loadQuizzes(selectedBatch);
  }, [selectedBatch]);

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <p className="quiz-kicker">FR-21: Quiz View</p>
          <h2>Available Quizzes</h2>
          <p>Browse your batch quizzes. Submission flow will be added in the next phase.</p>
        </div>
      </header>

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
                <span>{quiz.attempt_mode === 'repeatable' ? 'Repeatable' : 'One Time'}</span>
                <span>{quiz.can_start_now ? 'Ready' : 'Not Started Yet'}</span>
              </div>

              <button
                type="button"
                className="quiz-btn ghost"
                onClick={() => setExpandedQuizId((prev) => (prev === quiz.id ? '' : quiz.id))}
              >
                {expandedQuizId === quiz.id ? 'Hide Questions' : 'View Questions'}
              </button>

              {expandedQuizId === quiz.id && (
                <div className="quiz-student-questions">
                  {quiz.questions.map((question) => (
                    <article key={question.id} className="quiz-student-question-card">
                      <header>
                        <strong>
                          Q{question.order_no} [{question.type.toUpperCase()}]
                        </strong>
                        <span className="quiz-badge">{question.marks} marks</span>
                      </header>

                      {question.question_text && <p>{question.question_text}</p>}

                      {question.question_image_data && (
                        <div className="quiz-image-preview">
                          <img src={question.question_image_data} alt={`Question ${question.order_no}`} />
                        </div>
                      )}

                      {question.type === 'mcq' && Array.isArray(question.options) && (
                        <ol>
                          {question.options.map((option, idx) => (
                            <li key={`${question.id}-opt-${idx}`}>{option}</li>
                          ))}
                        </ol>
                      )}

                      {question.type === 'broad' && question.allow_file_upload && (
                        <p className="quiz-note">
                          File answer expected (image/PDF). Submission input will appear in next phase.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default StudentQuizCatalogView;
