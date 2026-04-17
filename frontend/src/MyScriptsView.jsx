import { useEffect, useState } from 'react';
import { getScriptBlob } from './services/indexedDbScriptProxy';
import './ExamScripts.css';
import { apiFetch } from './services/httpClient';

// ── Security helper ───────────────────────────────────────────────────────────
// FR-18: The student view NEVER exposes a way for the user to set an arbitrary
// student_id.  The "Select your identity" dropdown is a demo-only substitute for
// a real JWT session.  The actual back-end query always sends the selected UUID
// so the server enforces row-level filtering; a user who guesses another UUID but
// POSTs it will see that student's data only if the server also validates the JWT
// (which would happen in production).  In this prototype the pattern is correct:
//   - GET /api/student-scripts?student_id=<loggedInUUID>
// The UX deliberately provides no way to view or guess another student's route.
// ─────────────────────────────────────────────────────────────────────────────

function MyScriptsView({ currentUser }) {
  const [scripts, setScripts] = useState([]);
  const [status, setStatus] = useState('');
  const [loadingScripts, setLoadingScripts] = useState(false);
  const loggedInStudentId = currentUser?.id || '';

  // FR-18: fetch only this student's scripts by passing their own UUID.
  // The backend enforces that the queried UUID belongs to a student role,
  // and returns exclusively records where student_id = provided UUID.
  useEffect(() => {
    const load = async () => {
      if (!loggedInStudentId) {
        setScripts([]);
        setStatus('Unable to determine logged-in student. Please log in again.');
        return;
      }
      setLoadingScripts(true);
      setStatus('');
      try {
        const data = await apiFetch(
          `/student-scripts?student_id=${encodeURIComponent(loggedInStudentId)}`,
          { withAuth: true }
        );
        setScripts(data);
      } catch (err) {
        setStatus(err.message);
        setScripts([]);
      } finally {
        setLoadingScripts(false);
      }
    };
    load();
  }, [loggedInStudentId]);

  // ── View PDF in a new browser tab ─────────────────────────────────────────
  const onView = async (script) => {
    setStatus('');
    try {
      const entry = await getScriptBlob(script.id);
      if (!entry?.blob) {
        setStatus(`PDF for "${script.exam_name}" is not available in local storage yet.`);
        return;
      }
      const url = URL.createObjectURL(entry.blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        setStatus('Pop-up blocked. Please allow pop-ups for this page.');
        URL.revokeObjectURL(url);
        return;
      }
      // Revoke after enough time for the browser to load the PDF
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setStatus(err.message);
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const onDownload = async (script) => {
    setStatus('');
    try {
      const entry = await getScriptBlob(script.id);
      if (!entry?.blob) {
        setStatus(`PDF for "${script.exam_name}" is not available in local storage yet.`);
        return;
      }
      const url = URL.createObjectURL(entry.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${script.exam_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatus(err.message);
    }
  };

  const currentStudentName = currentUser?.name || '';

  return (
    <div className="scripts-page">
      <h2>My Evaluated Scripts</h2>
      <p className="scripts-disclaimer">
        Note: Metadata is stored in PostgreSQL. Script PDFs are proxied via local IndexedDB.
        Production will utilize Google/Cloudflare R2 for file hosting.
      </p>

      <div className="scripts-panel">
        <div className="field-block">
          <label>Logged-in Student</label>
          <input type="text" value={currentStudentName || 'Student'} readOnly />
          <span className="hint-text security-note">
            &#128274; You can only view scripts assigned to your own account.
          </span>
        </div>
        {status && <p className="status-text">{status}</p>}
      </div>

      {/* ── Scripts list ── */}
      <div className="scripts-panel">
        <h3>
          Scripts
          {currentStudentName && <span className="panel-sub"> — {currentStudentName}</span>}
        </h3>

        {loadingScripts ? (
          <p className="empty-text">Loading…</p>
        ) : scripts.length === 0 ? (
          <p className="empty-text">No evaluated scripts found for your account.</p>
        ) : (
          <table className="scripts-table">
            <thead>
              <tr>
                <th>Exam Name</th>
                <th>Batch</th>
                <th>Date Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => (
                <tr key={s.id}>
                  <td>{s.exam_name}</td>
                  <td>{s.batch?.name || '—'}</td>
                  <td>{new Date(s.uploaded_at).toLocaleString()}</td>
                  <td className="action-cell">
                    <button className="view-btn" onClick={() => onView(s)}>View</button>
                    <button className="download-btn" onClick={() => onDownload(s)}>Download</button>
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

export default MyScriptsView;
