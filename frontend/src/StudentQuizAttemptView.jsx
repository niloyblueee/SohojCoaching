import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './QuizWorkspace.css';
import { getStudentQuizAttempt, submitStudentQuizAttempt } from './services/quizApi';

const formatRemaining = (seconds) => {
  const total = Math.max(Number(seconds || 0), 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const readAnswerFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read answer file.'));
    reader.readAsDataURL(file);
  });

function StudentQuizAttemptView() {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncingExpiry, setSyncingExpiry] = useState(false);

  const hydrateAnswers = useCallback((payload) => {
    const mapped = {};
    (payload?.quiz?.questions || []).forEach((question) => {
      mapped[question.id] = {
        selected_option_index: question.answer?.selected_option_index ?? null,
        broad_text_answer: question.answer?.broad_text_answer || '',
        answer_file_data: question.answer?.answer_file_data || null,
        answer_file_name: question.answer?.answer_file_name || '',
        answer_file_type: question.answer?.answer_file_type || ''
      };
    });
    setAnswers(mapped);
  }, []);

  const loadAttempt = useCallback(async () => {
    if (!attemptId) {
      setStatus('Invalid attempt.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await getStudentQuizAttempt(attemptId);
      setAttempt(payload);
      hydrateAnswers(payload);
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Failed to load quiz attempt.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, hydrateAnswers]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;

    if (attempt.remaining_seconds <= 0 && !syncingExpiry) {
      setSyncingExpiry(true);
      getStudentQuizAttempt(attempt.attempt_id)
        .then((payload) => {
          setAttempt(payload);
          hydrateAnswers(payload);
        })
        .catch((err) => setStatus(err.message || 'Failed to refresh attempt status.'))
        .finally(() => setSyncingExpiry(false));
      return undefined;
    }

    const timer = setInterval(() => {
      setAttempt((prev) => {
        if (!prev || prev.status !== 'in_progress') return prev;
        return {
          ...prev,
          remaining_seconds: Math.max(Number(prev.remaining_seconds || 0) - 1, 0)
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt, syncingExpiry, hydrateAnswers]);

  const totalMarks = useMemo(
    () => (attempt?.quiz?.questions || []).reduce((sum, question) => sum + Number(question.marks || 0), 0),
    [attempt?.quiz?.questions]
  );

  const updateAnswer = (questionId, updater) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: updater(prev[questionId] || {})
    }));
  };

  const handleBroadFileChange = async (questionId, file) => {
    if (!file) {
      updateAnswer(questionId, (prev) => ({
        ...prev,
        answer_file_data: null,
        answer_file_name: '',
        answer_file_type: ''
      }));
      return;
    }

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setStatus('Only image or PDF files are allowed.');
      return;
    }

    try {
      const dataUrl = await readAnswerFile(file);
      updateAnswer(questionId, (prev) => ({
        ...prev,
        answer_file_data: dataUrl,
        answer_file_name: file.name,
        answer_file_type: file.type
      }));
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Failed to read answer file.');
    }
  };

  const handleSubmit = async () => {
    if (!attempt || attempt.status !== 'in_progress') return;
    setSubmitting(true);
    setStatus('');

    const payload = (attempt.quiz?.questions || []).map((question) => {
      const draft = answers[question.id] || {};
      return {
        question_id: question.id,
        selected_option_index:
          question.type === 'mcq' ? draft.selected_option_index ?? null : null,
        broad_text_answer: question.type === 'broad' ? draft.broad_text_answer || '' : '',
        answer_file_data: question.type === 'broad' ? draft.answer_file_data || null : null,
        answer_file_name: question.type === 'broad' ? draft.answer_file_name || null : null,
        answer_file_type: question.type === 'broad' ? draft.answer_file_type || null : null
      };
    });

    try {
      const response = await submitStudentQuizAttempt(attempt.attempt_id, payload);
      setAttempt((prev) =>
        prev
          ? {
            ...prev,
            status: 'submitted',
            submitted_at: response?.submitted_at || new Date().toISOString(),
            remaining_seconds: 0
          }
          : prev
      );
      setStatus('Quiz submitted successfully.');
    } catch (err) {
      setStatus(err.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="quiz-page">
        <p className="quiz-empty">Loading quiz attempt...</p>
      </section>
    );
  }

  if (!attempt) {
    return (
      <section className="quiz-page">
        <p className="quiz-status quiz-status-error">{status || 'Quiz attempt not found.'}</p>
        <button type="button" className="quiz-btn ghost" onClick={() => navigate('/student/attend-quiz')}>
          Back to Attend Quiz
        </button>
      </section>
    );
  }

  const isEditable = attempt.status === 'in_progress';

  return (
    <section className="quiz-page quiz-attempt-page">
      <header className="quiz-header quiz-attempt-header">
        <div>
          <p className="quiz-kicker">FR-22: Attend & Submit</p>
          <h2>{attempt.quiz?.title}</h2>
          <p>{attempt.quiz?.description || 'Answer all you can and submit before the timer ends.'}</p>
        </div>
        <aside className="quiz-timer-card">
          <p>Time Left</p>
          <strong>{formatRemaining(attempt.remaining_seconds)}</strong>
          <span>{attempt.duration_minutes} min</span>
        </aside>
      </header>

      <section className="quiz-attempt-meta">
        <span className="quiz-badge">{attempt.quiz?.question_count} questions</span>
        <span className="quiz-badge">{totalMarks} marks</span>
        <span className="quiz-badge">Attempt #{attempt.attempt_number}</span>
        <span className="quiz-badge quiz-status-chip">Status: {attempt.status}</span>
      </section>

      {status && (
        <p className={status.includes('successfully') ? 'quiz-status' : 'quiz-status quiz-status-error'}>
          {status}
        </p>
      )}

      <section className="quiz-attempt-questions">
        {(attempt.quiz?.questions || []).map((question) => (
          <article key={question.id} className="quiz-attempt-question">
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

            {question.type === 'mcq' ? (
              <div className="quiz-attempt-options">
                {Array.isArray(question.options) &&
                  question.options.map((option, optionIndex) => (
                    <label key={`${question.id}-opt-${optionIndex}`} className="quiz-attempt-option">
                      <input
                        type="radio"
                        name={`answer-${question.id}`}
                        disabled={!isEditable || submitting}
                        checked={answers[question.id]?.selected_option_index === optionIndex}
                        onChange={() =>
                          updateAnswer(question.id, (prev) => ({
                            ...prev,
                            selected_option_index: optionIndex
                          }))
                        }
                      />
                      <span>{option}</span>
                    </label>
                  ))}
              </div>
            ) : (
              <div className="quiz-attempt-broad">
                <label>
                  Written Answer
                  <textarea
                    value={answers[question.id]?.broad_text_answer || ''}
                    disabled={!isEditable || submitting}
                    onChange={(event) =>
                      updateAnswer(question.id, (prev) => ({
                        ...prev,
                        broad_text_answer: event.target.value
                      }))
                    }
                    placeholder="Write your answer here..."
                  />
                </label>

                {question.allow_file_upload && (
                  <label>
                    Upload Image/PDF (optional)
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={!isEditable || submitting}
                      onChange={(event) => handleBroadFileChange(question.id, event.target.files?.[0] || null)}
                    />
                  </label>
                )}

                {answers[question.id]?.answer_file_name && (
                  <p className="quiz-note">Attached: {answers[question.id].answer_file_name}</p>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      <div className="quiz-attempt-actions">
        <button type="button" className="quiz-btn ghost" onClick={() => navigate('/student/attend-quiz')}>
          Back to Attend Quiz
        </button>
        {isEditable && (
          <button type="button" className="quiz-btn primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </section>
  );
}

export default StudentQuizAttemptView;
