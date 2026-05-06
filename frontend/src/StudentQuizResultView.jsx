import { useCallback, useEffect, useMemo, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import { getStudentResultDetail, getStudentResults } from './services/quizApi';

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function StudentQuizResultView({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [metrics, setMetrics] = useState({
    graded_quizzes: 0,
    total_obtained_marks: 0,
    total_full_marks: 0,
    average_percentage: 0,
    best_percentage: 0,
    best_quiz_title: null
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [resultDetail, setResultDetail] = useState(null);

  const loadBatches = useCallback(async () => {
    if (!currentUser?.id) {
      setStatus('Unable to determine logged-in student.');
      return;
    }

    try {
      const data = await apiFetch(`/students/${currentUser.id}/batches`, { withAuth: true });
      const normalized = Array.isArray(data) ? data : [];
      setBatches(normalized);
      setSelectedBatch((prev) => prev || normalized?.[0]?.id || '');
    } catch (err) {
      setStatus(err.message || 'Failed to load enrolled batches.');
    }
  }, [currentUser?.id]);

  const loadResults = useCallback(async (batchId) => {
    setLoading(true);
    setStatus('');
    try {
      const payload = await getStudentResults(batchId || undefined);
      setMetrics(payload?.metrics || {});
      setResults(Array.isArray(payload?.results) ? payload.results : []);
    } catch (err) {
      setStatus(err.message || 'Failed to load results.');
      setMetrics({
        graded_quizzes: 0,
        total_obtained_marks: 0,
        total_full_marks: 0,
        average_percentage: 0,
        best_percentage: 0,
        best_quiz_title: null
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadResults(selectedBatch);
  }, [selectedBatch, loadResults]);

  const openResultDetail = async (attemptId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setResultDetail(null);

    try {
      const payload = await getStudentResultDetail(attemptId);
      setResultDetail(payload);
    } catch (err) {
      setDetailError(err.message || 'Failed to load checked script.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeResultDetail = () => {
    setDetailOpen(false);
    setDetailError('');
    setResultDetail(null);
  };

  const topResult = useMemo(
    () => results.reduce((best, row) => (best === null || row.percentage > best.percentage ? row : best), null),
    [results]
  );

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <h2>Result</h2>
          <p>Track graded quiz performance with clean metrics and open each checked script in detail.</p>
        </div>
      </header>

      <section className="quiz-list-panel">
        <div className="quiz-filter-bar">
          <label className="quiz-filter-item">
            <span>Batch</span>
            <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)}>
              <option value="">All Batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name || batch.batch_name}
                </option>
              ))}
            </select>
          </label>
          
          <div className="quiz-filter-actions">
            <button type="button" className="quiz-btn ghost" onClick={() => loadResults(selectedBatch)} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh Results'}
            </button>
          </div>
        </div>

        {status && <p className="quiz-status quiz-status-error">{status}</p>}
        {!status && topResult && (
          <p className="quiz-status">
            Top performance currently in <strong>{topResult.quiz_title}</strong> ({toPercent(topResult.percentage)}).
          </p>
        )}

      <section className="quiz-metrics-grid quiz-results-metrics-grid">
        <article className="quiz-metric-card">
          <p>Graded Quizzes</p>
          <strong>{metrics.graded_quizzes || 0}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Total Score</p>
          <strong>
            {metrics.total_obtained_marks || 0}/{metrics.total_full_marks || 0}
          </strong>
        </article>
        <article className="quiz-metric-card">
          <p>Average</p>
          <strong>{toPercent(metrics.average_percentage)}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Best Score</p>
          <strong>{toPercent(metrics.best_percentage)}</strong>
        </article>
      </section>

        {loading && <p className="quiz-empty">Loading results...</p>}
        {!loading && !status && results.length === 0 && (
          <p className="quiz-empty">No graded results found yet. Your checked scripts will appear here once evaluated.</p>
        )}

        <div className="quiz-results-grid">
          {results.map((row) => (
            <article key={row.attempt_id} className="quiz-result-card">
              <header>
                <h4>{row.quiz_title}</h4>
                <span className="quiz-badge">{toPercent(row.percentage)}</span>
              </header>
              <p className="quiz-note">Batch: {row.batch_name || 'N/A'}</p>
              <div className="quiz-created-meta">
                <span>Attempt #{row.attempt_number}</span>
                <span>
                  Score: {row.obtained_marks}/{row.full_marks}
                </span>
                <span>Checked: {row.graded_at ? new Date(row.graded_at).toLocaleString() : 'N/A'}</span>
              </div>
              <button type="button" className="quiz-btn ghost" onClick={() => openResultDetail(row.attempt_id)}>
                View Checked Script
              </button>
            </article>
          ))}
        </div>
      </section>

      {detailOpen && (
        <div className="quiz-modal-backdrop" role="dialog" aria-modal="true">
          <section className="quiz-modal">
            <div className="quiz-modal-toolbar">
              <button type="button" className="quiz-btn ghost" onClick={closeResultDetail}>
                Close
              </button>
            </div>

            {detailLoading && <p className="quiz-empty">Loading checked script...</p>}
            {!detailLoading && detailError && <p className="quiz-status quiz-status-error">{detailError}</p>}

            {!detailLoading && resultDetail && (
              <>
                <header className="quiz-modal-header">
                  <div>
                    <h3>{resultDetail.quiz?.title}</h3>
                    <p>{resultDetail.quiz?.batch_name}</p>
                  </div>
                  <div className="quiz-created-meta">
                    <span>Attempt #{resultDetail.attempt_number}</span>
                    <span>
                      Score: {resultDetail.obtained_marks}/{resultDetail.full_marks}
                    </span>
                    <span>{toPercent(resultDetail.percentage)}</span>
                  </div>
                </header>

                <div className="quiz-modal-body">
                  {(resultDetail.questions || []).map((question) => (
                    <article key={question.id} className="quiz-review-question-card">
                      <header>
                        <strong>
                          Q{question.order_no} [{String(question.type || '').toUpperCase()}]
                        </strong>
                        <span className="quiz-badge">
                          {question.review?.awarded_marks || 0}/{question.marks}
                        </span>
                      </header>

                      {question.question_text && <p>{question.question_text}</p>}
                      {question.question_image_data && (
                        <div className="quiz-image-preview">
                          <img src={question.question_image_data} alt={`Question ${question.order_no}`} />
                        </div>
                      )}

                      <section className="quiz-review-answer">
                        <h5>Your Answer</h5>
                        {question.type === 'mcq' ? (
                          <div className="quiz-review-mcq">
                            {(question.options || []).map((option, idx) => {
                              const chosen = idx === question.answer?.selected_option_index;
                              const correct = idx === question.correct_option_index;
                              return (
                                <p key={`${question.id}-opt-${idx}`}>
                                  {chosen ? '✓' : '-'} {option} {correct ? '(Correct)' : ''}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <p>{question.answer?.broad_text_answer || 'No written text answer.'}</p>
                            {question.answer?.answer_file_data && (
                              <div className="quiz-file-preview-box">
                                {String(question.answer.answer_file_data).startsWith('data:image/') ? (
                                  <img src={question.answer.answer_file_data} alt={`Your answer Q${question.order_no}`} />
                                ) : (
                                  <iframe title={`Your PDF answer Q${question.order_no}`} src={question.answer.answer_file_data} />
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </section>

                      {(question.review?.teacher_explanation || question.review?.review_file_data) && (
                        <section className="quiz-review-answer">
                          <h5>Teacher Feedback</h5>
                          {question.review?.teacher_explanation && <p>{question.review.teacher_explanation}</p>}
                          {question.review?.review_file_data && (
                            <div className="quiz-file-preview-box">
                              {String(question.review.review_file_data).startsWith('data:image/') ? (
                                <img src={question.review.review_file_data} alt={`Feedback file Q${question.order_no}`} />
                              ) : (
                                <iframe title={`Feedback PDF Q${question.order_no}`} src={question.review.review_file_data} />
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default StudentQuizResultView;
