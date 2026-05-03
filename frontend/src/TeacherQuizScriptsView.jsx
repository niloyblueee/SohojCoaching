import { useCallback, useEffect, useMemo, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import {
  getTeacherQuizAttemptReview,
  getTeacherQuizzes,
  getTeacherQuizScripts,
  saveTeacherQuizAttemptReview
} from './services/quizApi';

const toNumberOrZero = (value) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read review file.'));
    reader.readAsDataURL(file);
  });

const buildDraftFromReview = (question) => {
  const selected = question.answer?.selected_option_index;
  const correct = question.correct_option_index;
  const autoMcqScore = question.type === 'mcq' && selected !== null && selected === correct
    ? Number(question.marks || 0)
    : 0;

  return {
    awarded_marks:
      question.review?.awarded_marks === null || question.review?.awarded_marks === undefined
        ? autoMcqScore
        : Number(question.review.awarded_marks),
    teacher_explanation: question.review?.teacher_explanation || '',
    review_file_data: question.review?.review_file_data || null,
    review_file_name: question.review?.review_file_name || '',
    review_file_type: question.review?.review_file_type || ''
  };
};

function TeacherQuizScriptsView() {
  const [batches, setBatches] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [scriptGroups, setScriptGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});

  const loadBatches = useCallback(async () => {
    try {
      const data = await apiFetch('/batches', { withAuth: true });
      const normalized = Array.isArray(data) ? data : [];
      setBatches(normalized);
      setSelectedBatch((prev) => prev || normalized?.[0]?.id || '');
    } catch (err) {
      setStatus(err.message || 'Failed to load batches.');
    }
  }, []);

  const loadQuizzes = useCallback(async (batchId) => {
    if (!batchId) {
      setQuizzes([]);
      return;
    }

    try {
      const data = await getTeacherQuizzes(batchId);
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus(err.message || 'Failed to load quizzes.');
      setQuizzes([]);
    }
  }, []);

  const loadScripts = useCallback(async (batchId, quizId) => {
    if (!batchId) {
      setScriptGroups([]);
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      const data = await getTeacherQuizScripts({
        batchId,
        quizId: quizId || undefined
      });
      setScriptGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus(err.message || 'Failed to load quiz scripts.');
      setScriptGroups([]);
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

  useEffect(() => {
    loadScripts(selectedBatch, selectedQuiz);
  }, [selectedBatch, selectedQuiz, loadScripts]);

  const metrics = useMemo(() => {
    const totalQuizzes = scriptGroups.length;
    const totalAttempts = scriptGroups.reduce((sum, group) => sum + Number((group.attempts || []).length), 0);
    const gradedAttempts = scriptGroups.reduce(
      (sum, group) => sum + (group.attempts || []).filter((attempt) => attempt.grading_status === 'graded').length,
      0
    );

    return {
      totalQuizzes,
      totalAttempts,
      gradedAttempts
    };
  }, [scriptGroups]);

  const openReview = async (attemptId) => {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError('');
    setReviewData(null);
    setReviewDrafts({});

    try {
      const payload = await getTeacherQuizAttemptReview(attemptId);
      setReviewData(payload);

      const drafts = {};
      (payload.questions || []).forEach((question) => {
        drafts[question.id] = buildDraftFromReview(question);
      });
      setReviewDrafts(drafts);
    } catch (err) {
      setReviewError(err.message || 'Failed to load quiz script.');
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewError('');
    setReviewData(null);
    setReviewDrafts({});
  };

  const updateDraft = (questionId, updater) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [questionId]: updater(prev[questionId] || {})
    }));
  };

  const handleReviewFile = async (questionId, file) => {
    if (!file) {
      updateDraft(questionId, (prev) => ({
        ...prev,
        review_file_data: null,
        review_file_name: '',
        review_file_type: ''
      }));
      return;
    }

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setReviewError('Review file must be an image or PDF.');
      return;
    }

    try {
      const data = await readFileAsDataUrl(file);
      updateDraft(questionId, (prev) => ({
        ...prev,
        review_file_data: data,
        review_file_name: file.name,
        review_file_type: file.type
      }));
      setReviewError('');
    } catch (err) {
      setReviewError(err.message || 'Failed to read review file.');
    }
  };

  const totalDraftMarks = useMemo(() => {
    if (!reviewData) return 0;
    return (reviewData.questions || []).reduce((sum, question) => {
      const draft = reviewDrafts[question.id];
      return sum + toNumberOrZero(draft?.awarded_marks);
    }, 0);
  }, [reviewData, reviewDrafts]);

  const saveReview = async () => {
    if (!reviewData?.attempt_id) return;
    setReviewSaving(true);
    setReviewError('');

    try {
      const reviews = (reviewData.questions || []).map((question) => {
        const draft = reviewDrafts[question.id] || {};
        return {
          question_id: question.id,
          awarded_marks: Math.max(0, toNumberOrZero(draft.awarded_marks)),
          teacher_explanation: draft.teacher_explanation || '',
          review_file_data: draft.review_file_data || null,
          review_file_name: draft.review_file_name || null,
          review_file_type: draft.review_file_type || null
        };
      });

      await saveTeacherQuizAttemptReview(reviewData.attempt_id, reviews);
      await loadScripts(selectedBatch, selectedQuiz);
      setStatus('Quiz marks saved successfully.');
      closeReview();
    } catch (err) {
      setReviewError(err.message || 'Failed to save marks.');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <p className="quiz-kicker">FR-13: Marks Entry</p>
          <h2>Quizz Scripts</h2>
          <p>Open any submitted script, review each answer, score it, and finalize the total in one flow.</p>
        </div>
      </header>

      <section className="quiz-metrics-grid">
        <article className="quiz-metric-card">
          <p>Total Quizzes</p>
          <strong>{metrics.totalQuizzes}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Submitted Attempts</p>
          <strong>{metrics.totalAttempts}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Graded Attempts</p>
          <strong>{metrics.gradedAttempts}</strong>
        </article>
      </section>

      <section className="quiz-list-panel">
        <div className="quiz-top-grid">
          <label>
            Batch
            <select
              value={selectedBatch}
              onChange={(event) => {
                setSelectedBatch(event.target.value);
                setSelectedQuiz('');
              }}
            >
              <option value="">-- Select Batch --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_name || batch.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quiz (optional)
            <select value={selectedQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
              <option value="">All Quizzes</option>
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title}
                </option>
              ))}
            </select>
          </label>

          <div className="quiz-submit-row quiz-submit-row-left">
            <button
              type="button"
              className="quiz-btn ghost"
              onClick={() => loadScripts(selectedBatch, selectedQuiz)}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Scripts'}
            </button>
          </div>
        </div>

        {loading && <p className="quiz-empty">Loading scripts...</p>}
        {!loading && status && <p className="quiz-status">{status}</p>}
        {!loading && !status && scriptGroups.length === 0 && (
          <p className="quiz-empty">No quizzes found for this selection.</p>
        )}

        <div className="quiz-scripts-grid">
          {scriptGroups.map((group) => (
            <article key={group.quiz_id} className="quiz-script-group">
              <header>
                <h4>{group.quiz_title}</h4>
                <p>
                  Batch: {group.batch_name || 'N/A'} | Questions: {group.question_count} | Full Marks: {group.total_marks}
                </p>
              </header>

              {!group.attempts?.length ? (
                <p className="quiz-empty">No submitted scripts yet.</p>
              ) : (
                <div className="quiz-script-attempt-bars">
                  {group.attempts.map((attempt) => (
                    <button
                      key={attempt.attempt_id}
                      type="button"
                      className="quiz-script-attempt-bar"
                      onClick={() => openReview(attempt.attempt_id)}
                    >
                      <span>
                        {attempt.student_name || 'Student'} ({attempt.student_id})
                      </span>
                      <span>{attempt.student_email || 'No email'}</span>
                      <span>Attempt #{attempt.attempt_number}</span>
                      <span>{attempt.grading_status === 'graded' ? 'Graded' : 'Pending'}</span>
                      <span>
                        Score: {attempt.total_awarded_marks}/{group.total_marks}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {reviewOpen && (
        <div className="quiz-modal-backdrop" role="dialog" aria-modal="true">
          <section className="quiz-modal">
            <div className="quiz-modal-toolbar">
              <button type="button" className="quiz-btn ghost" onClick={closeReview} disabled={reviewSaving}>
                Close
              </button>
            </div>
            {reviewLoading && <p className="quiz-empty">Loading script review...</p>}

            {!reviewLoading && reviewError && <p className="quiz-status quiz-status-error">{reviewError}</p>}

            {!reviewLoading && reviewData && (
              <>
                <header className="quiz-modal-header">
                  <div>
                    <h3>{reviewData.quiz?.title}</h3>
                    <p>
                      {reviewData.quiz?.batch_name} | {reviewData.student?.name} ({reviewData.student?.id})
                    </p>
                  </div>
                  <div className="quiz-created-meta">
                    <span>Attempt #{reviewData.attempt_number}</span>
                    <span>{reviewData.grading_status}</span>
                    <span>
                      Total: {totalDraftMarks}/{reviewData.quiz?.total_marks}
                    </span>
                  </div>
                </header>

                <div className="quiz-modal-body">
                  {(reviewData.questions || []).map((question) => {
                    const draft = reviewDrafts[question.id] || buildDraftFromReview(question);
                    return (
                      <article key={question.id} className="quiz-review-question-card">
                        <header>
                          <strong>
                            Q{question.order_no} [{String(question.type || '').toUpperCase()}]
                          </strong>
                          <span className="quiz-badge">{question.marks} marks</span>
                        </header>

                        {question.question_text && <p>{question.question_text}</p>}
                        {question.question_image_data && (
                          <div className="quiz-image-preview">
                            <img src={question.question_image_data} alt={`Question ${question.order_no}`} />
                          </div>
                        )}

                        <section className="quiz-review-answer">
                          <h5>Student Answer</h5>
                          {question.type === 'mcq' ? (
                            <div className="quiz-review-mcq">
                              {(question.options || []).map((option, optionIndex) => (
                                <p key={`${question.id}-opt-${optionIndex}`}>
                                  {optionIndex === question.answer?.selected_option_index ? '✓' : '-'} {option}
                                </p>
                              ))}
                              <p>Correct option index: {question.correct_option_index ?? 'N/A'}</p>
                            </div>
                          ) : (
                            <>
                              <p>{question.answer?.broad_text_answer || 'No written text answer.'}</p>
                              {question.answer?.answer_file_data && (
                                <div className="quiz-file-preview-box">
                                  {String(question.answer.answer_file_data).startsWith('data:image/') ? (
                                    <img
                                      src={question.answer.answer_file_data}
                                      alt={`Student answer Q${question.order_no}`}
                                    />
                                  ) : (
                                    <iframe
                                      title={`Student PDF answer Q${question.order_no}`}
                                      src={question.answer.answer_file_data}
                                    />
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </section>

                        <section className="quiz-review-controls">
                          <label>
                            Score
                            <input
                              type="number"
                              min="0"
                              max={question.marks}
                              value={draft.awarded_marks}
                              onChange={(event) =>
                                updateDraft(question.id, (prev) => ({
                                  ...prev,
                                  awarded_marks: event.target.value
                                }))
                              }
                            />
                          </label>

                          <label>
                            Explanation (optional)
                            <textarea
                              value={draft.teacher_explanation}
                              onChange={(event) =>
                                updateDraft(question.id, (prev) => ({
                                  ...prev,
                                  teacher_explanation: event.target.value
                                }))
                              }
                              placeholder="Write short feedback for this answer..."
                            />
                          </label>

                          <label>
                            Upload Review File (optional)
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(event) => handleReviewFile(question.id, event.target.files?.[0] || null)}
                            />
                          </label>

                          {draft.review_file_data && (
                            <div className="quiz-file-preview-box">
                              {String(draft.review_file_data).startsWith('data:image/') ? (
                                <img src={draft.review_file_data} alt={`Review attachment Q${question.order_no}`} />
                              ) : (
                                <iframe title={`Review PDF Q${question.order_no}`} src={draft.review_file_data} />
                              )}
                            </div>
                          )}
                        </section>
                      </article>
                    );
                  })}
                </div>

                <footer className="quiz-modal-actions">
                  <button type="button" className="quiz-btn primary" onClick={saveReview} disabled={reviewSaving}>
                    {reviewSaving ? 'Saving...' : 'Done & Save Marks'}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default TeacherQuizScriptsView;
