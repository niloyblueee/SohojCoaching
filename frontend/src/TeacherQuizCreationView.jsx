import { useEffect, useMemo, useState } from 'react';
import './QuizWorkspace.css';
import { apiFetch } from './services/httpClient';
import { createTeacherQuiz, getTeacherQuizzes } from './services/quizApi';

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const newMcqQuestion = () => ({
  localId: makeId(),
  type: 'mcq',
  questionText: '',
  questionImageData: '',
  marks: 1,
  options: ['', ''],
  correctOptionIndex: 0,
  allowFileUpload: false
});

const newBroadQuestion = () => ({
  localId: makeId(),
  type: 'broad',
  questionText: '',
  questionImageData: '',
  marks: 1,
  options: [],
  correctOptionIndex: null,
  allowFileUpload: true
});

const readImageAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

function TeacherQuizCreationView() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    availabilityType: 'anytime',
    startsAt: '',
    durationMinutes: 30,
    attemptMode: 'one_time',
    questions: [newMcqQuestion()]
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalMarks = useMemo(
    () => form.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0),
    [form.questions]
  );

  const loadBatches = async () => {
    try {
      const data = await apiFetch('/batches', { withAuth: true });
      setBatches(Array.isArray(data) ? data : []);
      setSelectedBatch((prev) => prev || data?.[0]?.id || '');
    } catch (err) {
      setError(err.message || 'Failed to load teacher batches.');
    }
  };

  const loadQuizzes = async (batchId) => {
    if (!batchId) {
      setQuizzes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getTeacherQuizzes(batchId);
      setQuizzes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    loadQuizzes(selectedBatch);
  }, [selectedBatch]);

  const updateQuestion = (localId, updater) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.localId === localId ? updater(question) : question
      )
    }));
  };

  const removeQuestion = (localId) => {
    setForm((prev) => {
      const next = prev.questions.filter((question) => question.localId !== localId);
      return {
        ...prev,
        questions: next.length ? next : [newMcqQuestion()]
      };
    });
  };

  const handleQuestionImage = async (localId, file) => {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      updateQuestion(localId, (question) => ({ ...question, questionImageData: dataUrl }));
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    if (!selectedBatch) {
      setError('Select a batch first.');
      return;
    }

    let startsAtIso = null;
    if (form.availabilityType === 'scheduled') {
      if (!form.startsAt) {
        setError('Please select a valid scheduled start time.');
        return;
      }
      const parsedStart = new Date(form.startsAt);
      if (Number.isNaN(parsedStart.getTime())) {
        setError('Please select a valid scheduled start time.');
        return;
      }
      startsAtIso = parsedStart.toISOString();
    }
    if (form.availabilityType === 'scheduled' && !startsAtIso) {
      setError('Please select a valid scheduled start time.');
      return;
    }

    setSaving(true);
    try {
      await createTeacherQuiz({
        batch_id: selectedBatch,
        title: form.title,
        description: form.description,
        availability_type: form.availabilityType,
        starts_at: startsAtIso,
        duration_minutes: Number(form.durationMinutes),
        attempt_mode: form.availabilityType === 'anytime' ? form.attemptMode : 'one_time',
        questions: form.questions.map((question) => ({
          type: question.type,
          question_text: question.questionText,
          question_image_data: question.questionImageData || null,
          marks: Number(question.marks),
          options: question.type === 'mcq' ? question.options : [],
          correct_option_index: question.type === 'mcq' ? Number(question.correctOptionIndex) : null,
          allow_file_upload: question.type === 'broad' ? Boolean(question.allowFileUpload) : false
        }))
      });

      setStatus('Quiz created successfully.');
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        startsAt: '',
        questions: [newMcqQuestion()]
      }));
      await loadQuizzes(selectedBatch);
    } catch (err) {
      setError(err.message || 'Failed to create quiz.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="quiz-page">
      <header className="quiz-header">
        <div>
          <p className="quiz-kicker">FR-21: Quiz Creation</p>
          <h2>Create Batch Quiz</h2>
          <p>
            Build MCQ and broad quizzes with flexible timing, duration, and attempt rules.
          </p>
        </div>
      </header>

      {status && <p className="quiz-status">{status}</p>}
      {error && <p className="quiz-status quiz-status-error">{error}</p>}

      <form className="quiz-builder" onSubmit={handleSubmit}>
        <div className="quiz-top-grid">
          <label>
            Batch
            <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)} required>
              <option value="">-- Select Batch --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_name || batch.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Availability
            <select
              value={form.availabilityType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  availabilityType: event.target.value
                }))
              }
            >
              <option value="anytime">Anytime</option>
              <option value="scheduled">Specific Start Time</option>
            </select>
          </label>

          <label>
            Duration (minutes)
            <input
              type="number"
              min="1"
              max="1440"
              value={form.durationMinutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))
              }
              required
            />
          </label>

          {form.availabilityType === 'anytime' ? (
            <label>
              Attempt Rule
              <select
                value={form.attemptMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, attemptMode: event.target.value }))
                }
              >
                <option value="one_time">One Time</option>
                <option value="repeatable">Repeatable</option>
              </select>
            </label>
          ) : (
            <label>
              Starts At
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                required
              />
            </label>
          )}
        </div>

        <label>
          Quiz Title
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="e.g. Weekly Math Quiz - Algebra"
            required
          />
        </label>

        <label>
          Description (optional)
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Guidelines, topic coverage, instructions..."
          />
        </label>

        <div className="quiz-question-toolbar">
          <strong>Questions ({form.questions.length}) - Total Marks: {totalMarks}</strong>
          <div className="quiz-toolbar-actions">
            <button type="button" className="quiz-btn ghost" onClick={() => setForm((prev) => ({ ...prev, questions: [...prev.questions, newMcqQuestion()] }))}>
              + Add MCQ
            </button>
            <button type="button" className="quiz-btn ghost" onClick={() => setForm((prev) => ({ ...prev, questions: [...prev.questions, newBroadQuestion()] }))}>
              + Add Broad
            </button>
          </div>
        </div>

        <div className="quiz-question-list">
          {form.questions.map((question, index) => (
            <article key={question.localId} className="quiz-question-card">
              <header>
                <h3>
                  Q{index + 1} - {question.type === 'mcq' ? 'MCQ' : 'Broad'}
                </h3>
                <button type="button" className="quiz-btn danger" onClick={() => removeQuestion(question.localId)}>
                  Remove
                </button>
              </header>

              <div className="quiz-question-meta">
                <label>
                  Type
                  <select
                    value={question.type}
                    onChange={(event) =>
                      updateQuestion(question.localId, (prev) => {
                        if (event.target.value === 'mcq') {
                          return { ...newMcqQuestion(), localId: prev.localId };
                        }
                        return { ...newBroadQuestion(), localId: prev.localId };
                      })
                    }
                  >
                    <option value="mcq">MCQ</option>
                    <option value="broad">Broad</option>
                  </select>
                </label>

                <label>
                  Marks
                  <input
                    type="number"
                    min="1"
                    value={question.marks}
                    onChange={(event) =>
                      updateQuestion(question.localId, (prev) => ({
                        ...prev,
                        marks: event.target.value
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <label>
                Question Text (optional if image provided)
                <textarea
                  value={question.questionText}
                  onChange={(event) =>
                    updateQuestion(question.localId, (prev) => ({
                      ...prev,
                      questionText: event.target.value
                    }))
                  }
                  placeholder="Type question statement..."
                />
              </label>

              <label>
                Question Image (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleQuestionImage(question.localId, event.target.files?.[0] || null)}
                />
              </label>

              {question.questionImageData && (
                <div className="quiz-image-preview">
                  <img src={question.questionImageData} alt={`Question ${index + 1}`} />
                  <button
                    type="button"
                    className="quiz-btn ghost"
                    onClick={() =>
                      updateQuestion(question.localId, (prev) => ({ ...prev, questionImageData: '' }))
                    }
                  >
                    Remove Image
                  </button>
                </div>
              )}

              {question.type === 'mcq' ? (
                <div className="quiz-options">
                  <p>Options (select one correct answer)</p>
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.localId}-opt-${optionIndex}`} className="quiz-option-row">
                      <input
                        type="radio"
                        name={`correct-${question.localId}`}
                        checked={Number(question.correctOptionIndex) === optionIndex}
                        onChange={() =>
                          updateQuestion(question.localId, (prev) => ({
                            ...prev,
                            correctOptionIndex: optionIndex
                          }))
                        }
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(event) =>
                          updateQuestion(question.localId, (prev) => ({
                            ...prev,
                            options: prev.options.map((entry, idx) =>
                              idx === optionIndex ? event.target.value : entry
                            )
                          }))
                        }
                        placeholder={`Option ${optionIndex + 1}`}
                        required
                      />
                      {question.options.length > 2 && (
                        <button
                          type="button"
                          className="quiz-btn danger"
                          onClick={() =>
                            updateQuestion(question.localId, (prev) => {
                              const nextOptions = prev.options.filter((_, idx) => idx !== optionIndex);
                              const nextCorrect =
                                Number(prev.correctOptionIndex) >= nextOptions.length
                                  ? nextOptions.length - 1
                                  : Number(prev.correctOptionIndex);
                              return {
                                ...prev,
                                options: nextOptions,
                                correctOptionIndex: Math.max(nextCorrect, 0)
                              };
                            })
                          }
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="quiz-btn ghost"
                    onClick={() =>
                      updateQuestion(question.localId, (prev) => ({
                        ...prev,
                        options: [...prev.options, '']
                      }))
                    }
                    disabled={question.options.length >= 8}
                  >
                    + Add Option
                  </button>
                </div>
              ) : (
                <label className="quiz-toggle">
                  <input
                    type="checkbox"
                    checked={question.allowFileUpload}
                    onChange={(event) =>
                      updateQuestion(question.localId, (prev) => ({
                        ...prev,
                        allowFileUpload: event.target.checked
                      }))
                    }
                  />
                  Allow student file upload answer (image/PDF) for this broad question
                </label>
              )}
            </article>
          ))}
        </div>

        <div className="quiz-submit-row">
          <button type="submit" className="quiz-btn primary" disabled={saving}>
            {saving ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
        </div>
      </form>

      <section className="quiz-list-panel">
        <header>
          <h3>Created Quizzes</h3>
          {loading && <span>Loading...</span>}
        </header>
        {quizzes.length === 0 ? (
          <p className="quiz-empty">No quizzes yet for this batch.</p>
        ) : (
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
                </div>
                <ul>
                  {quiz.questions.map((question) => (
                    <li key={question.id}>
                      Q{question.order_no} [{question.type.toUpperCase()}] - {question.marks} marks
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default TeacherQuizCreationView;
