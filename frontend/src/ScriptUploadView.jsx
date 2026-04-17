import { useEffect, useRef, useState } from 'react';
import { saveScriptBlob, deleteScriptBlob } from './services/indexedDbScriptProxy';
import './ExamScripts.css';
import { apiFetch } from './services/httpClient';


function ScriptUploadView({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [batchStudents, setBatchStudents] = useState([]); // students enrolled in selected batch
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [examName, setExamName] = useState('');
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [scripts, setScripts] = useState([]);

  const fileInputRef = useRef(null);

  const normalizeBatchStudents = (students = []) => {
    return students
      .map((student) => {
        const id = student.studentId || student.student_id || student.id || '';
        const name = String(student.name || '').trim();
        return { id: String(id), name };
      })
      .filter((student) => student.id && student.name);
  };

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const batchData = await apiFetch('/batches', { withAuth: true });
        setBatches(batchData);
      } catch (err) {
        setStatus(err.message);
      }
    };
    load();
  }, []);

  // ── Load enrolled students when batch changes ─────────────────────────────
  useEffect(() => {
    if (!selectedBatch) {
      setBatchStudents([]);
      setSelectedStudent('');
      setStudentSearch('');
      return;
    }
    const load = async () => {
      try {
        const members = await apiFetch(`/batches/${selectedBatch}/members`, { withAuth: true });
        const normalizedStudents = normalizeBatchStudents(members?.students || []);
        setBatchStudents(normalizedStudents);
        setSelectedStudent((current) =>
          normalizedStudents.some((student) => student.id === current) ? current : ''
        );
        setStudentSearch('');
      } catch (err) {
        setStatus(err.message);
      }
    };
    load();
  }, [selectedBatch]);

  // ── Load uploaded scripts when batch changes ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!selectedBatch) { setScripts([]); return; }
      try {
        const data = await apiFetch(`/student-scripts?batch_id=${encodeURIComponent(selectedBatch)}`, { withAuth: true });
        setScripts(data);
      } catch (err) {
        setStatus(err.message);
      }
    };
    load();
  }, [selectedBatch]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const onDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setStatus('');
    } else {
      setStatus('Only PDF files are accepted.');
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type === 'application/pdf') {
      setFile(f);
      setStatus('');
    } else {
      setStatus('Only PDF files are accepted.');
    }
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const onUpload = async (e) => {
    e.preventDefault();
    setStatus('');

    if (!selectedBatch || !selectedStudent || !examName.trim() || !file) {
      setStatus('All fields are required. Make sure a PDF is selected.');
      return;
    }

    if (!currentUser?.id) {
      setStatus('Unable to determine the signed-in teacher. Please log in again.');
      return;
    }

    setIsSyncing(true);
    setProgress(10);
    setStatus('Saving metadata to PostgreSQL...');

    try {
      const metadata = await apiFetch('/student-scripts', {
        method: 'POST',
        body: {
          student_id: selectedStudent,
          batch_id: selectedBatch,
          exam_name: examName.trim(),
          uploaded_by: currentUser.id
        },
        withAuth: true
      });

      setProgress(55);
      setStatus('Syncing PDF to IndexedDB...');

      await saveScriptBlob(metadata.id, file, metadata.exam_name);

      setProgress(100);
      setStatus('Script uploaded successfully.');
      setExamName('');
      setFile(null);
      setSelectedStudent('');
      setStudentSearch('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh the scripts list
      const data = await apiFetch(`/student-scripts?batch_id=${encodeURIComponent(selectedBatch)}`, { withAuth: true });
      setScripts(data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const onDelete = async (scriptId) => {
    setStatus('');
    try {
      await apiFetch(`/student-scripts/${scriptId}`, { method: 'DELETE', withAuth: true });
      await deleteScriptBlob(scriptId);
      const data = await apiFetch(`/student-scripts?batch_id=${encodeURIComponent(selectedBatch)}`, { withAuth: true });
      setScripts(data);
      setStatus('Script deleted from PostgreSQL and IndexedDB.');
    } catch (err) {
      setStatus(err.message);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredStudents = batchStudents.filter((student) =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const selectedBatchName = batches.find((b) => b.id === selectedBatch)?.name || '';

  return (
    <div className="scripts-page">
      <h2>Exam Script Upload</h2>
      <p className="scripts-disclaimer">
        Note: Metadata is stored in PostgreSQL. Script PDFs are proxied via local IndexedDB.
        Production will utilize Google/Cloudflare R2 for file hosting.
      </p>

      {/* ── Upload form ── */}
      <div className="scripts-panel">
        <form onSubmit={onUpload}>
          <div className="scripts-grid">
            <div className="field-block">
              <label>Batch</label>
              <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                <option value="">-- Select Batch --</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.course}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Student selector with live search */}
          <div className="field-block">
            <label>Student (Searchable)</label>
            {selectedBatch ? (
              <>
                <input
                  type="text"
                  className="student-search"
                  placeholder="Type to filter students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <select
                  size={Math.min(5, filteredStudents.length + 1)}
                  className="student-list"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="">-- Select Student --</option>
                  {filteredStudents.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
                {filteredStudents.length === 0 && batchStudents.length > 0 && (
                  <span className="hint-text">No students match your search.</span>
                )}
                {batchStudents.length === 0 && (
                  <span className="hint-text">No enrolled students for this batch.</span>
                )}
              </>
            ) : (
              <span className="hint-text">Select a batch first to load enrolled students.</span>
            )}
          </div>

          <div className="field-block">
            <label>Exam Name</label>
            <input
              type="text"
              placeholder="e.g. Midterm 2024"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
            />
          </div>

          {/* PDF drag-and-drop zone */}
          <div
            className={`dropzone${isDragOver ? ' dropzone--over' : ''}${file ? ' dropzone--filled' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            aria-label="PDF file drop zone"
          >
            {file ? (
              <p className="dropzone-filename">📄 {file.name}</p>
            ) : (
              <>
                <p className="dropzone-prompt">Drag &amp; drop a <strong>PDF</strong> here</p>
                <p className="dropzone-sub">or click to browse</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>

          {/* Progress bar — visible while syncing */}
          {(isSyncing || progress > 0) && (
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span className="progress-label">{progress}%</span>
            </div>
          )}

          <button type="submit" className="primary-btn" disabled={isSyncing}>
            {isSyncing ? 'Uploading…' : 'Upload Script'}
          </button>
        </form>

        {!isSyncing && status && <p className="status-text">{status}</p>}
      </div>

      {/* ── Script list for current batch ── */}
      <div className="scripts-panel">
        <h3>
          Uploaded Scripts
          {selectedBatchName && <span className="panel-sub"> — {selectedBatchName}</span>}
        </h3>
        {scripts.length === 0 ? (
          <p className="empty-text">No scripts uploaded for this batch yet.</p>
        ) : (
          <table className="scripts-table">
            <thead>
              <tr>
                <th>Exam Name</th>
                <th>Student</th>
                <th>Date Uploaded</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => (
                <tr key={s.id}>
                  <td>{s.exam_name}</td>
                  <td>{s.student?.name || '—'}</td>
                  <td>{new Date(s.uploaded_at).toLocaleString()}</td>
                  <td>
                    <button className="danger-btn" onClick={() => onDelete(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ScriptUploadView;
