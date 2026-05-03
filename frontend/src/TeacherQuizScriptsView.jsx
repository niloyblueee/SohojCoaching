import { useCallback, useEffect, useMemo, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import { getTeacherQuizzes, getTeacherQuizScripts } from './services/quizApi';

function TeacherQuizScriptsView() {
  const [batches, setBatches] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [scriptGroups, setScriptGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

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
    const totalFiles = scriptGroups.reduce((sum, group) => sum + Number(group.script_count || 0), 0);
    const students = new Set();
    scriptGroups.forEach((group) => {
      (group.student_groups || []).forEach((student) => students.add(student.student_id));
    });

    return {
      totalQuizzes,
      totalStudents: students.size,
      totalFiles
    };
  }, [scriptGroups]);

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <p className="quiz-kicker">FR-22: Quizz Scripts</p>
          <h2>Quizz Scripts</h2>
          <p>Review all uploaded quiz files grouped by quiz, student, and attempt.</p>
        </div>
      </header>

      <section className="quiz-metrics-grid">
        <article className="quiz-metric-card">
          <p>Quizzes with Scripts</p>
          <strong>{metrics.totalQuizzes}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Students Submitted</p>
          <strong>{metrics.totalStudents}</strong>
        </article>
        <article className="quiz-metric-card">
          <p>Total Uploaded Files</p>
          <strong>{metrics.totalFiles}</strong>
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
        </div>

        {loading && <p className="quiz-empty">Loading scripts...</p>}
        {!loading && status && <p className="quiz-status quiz-status-error">{status}</p>}
        {!loading && !status && scriptGroups.length === 0 && (
          <p className="quiz-empty">No uploaded quiz scripts found for this selection.</p>
        )}

        <div className="quiz-scripts-grid">
          {scriptGroups.map((group) => (
            <article key={group.quiz_id} className="quiz-script-group">
              <header>
                <h4>{group.quiz_title}</h4>
                <p>
                  Batch: {group.batch_name || 'N/A'} | Files: {group.script_count}
                </p>
              </header>

              <div className="quiz-script-students">
                {(group.student_groups || []).map((studentGroup) => (
                  <section key={studentGroup.student_id} className="quiz-script-student">
                    <h5>{studentGroup.student_name}</h5>
                    <p>{studentGroup.student_email}</p>

                    {(studentGroup.attempts || []).map((attempt) => (
                      <article key={attempt.attempt_id} className="quiz-script-attempt">
                        <div className="quiz-script-attempt-meta">
                          <span className="quiz-badge">Attempt #{attempt.attempt_number}</span>
                          <span className="quiz-badge">{attempt.attempt_status}</span>
                          {attempt.submitted_at && (
                            <span className="quiz-badge">
                              Submitted: {new Date(attempt.submitted_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        <div className="quiz-script-files">
                          {(attempt.files || []).map((file) => (
                            <div key={file.answer_id} className="quiz-script-file">
                              <div className="quiz-script-file-head">
                                <strong>
                                  Q{file.question_order_no} [{String(file.question_type || '').toUpperCase()}]
                                </strong>
                                <span className="quiz-badge">{file.marks} marks</span>
                              </div>
                              {file.question_text && <p>{file.question_text}</p>}

                              {file.question_image_data && (
                                <div className="quiz-image-preview">
                                  <img src={file.question_image_data} alt={`Question ${file.question_order_no}`} />
                                </div>
                              )}

                              <p>File: {file.answer_file_name || 'Unnamed file'}</p>
                              <div className="quiz-script-file-actions">
                                <a
                                  className="quiz-btn ghost"
                                  href={file.answer_file_data}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Preview
                                </a>
                                <a
                                  className="quiz-btn ghost"
                                  href={file.answer_file_data}
                                  download={file.answer_file_name || `quiz-script-${file.answer_id}`}
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default TeacherQuizScriptsView;
