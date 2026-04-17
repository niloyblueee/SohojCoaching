import { useEffect, useMemo, useState } from 'react';
import { getMaterialBlob } from './services/indexedDbMaterialProxy';
import './StudyMaterials.css';
import { apiFetch } from './services/httpClient';

function MaterialStudentView({ currentUser }) {
  const [enrolledBatches, setEnrolledBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const loggedInStudentId = currentUser?.id || '';

  useEffect(() => {
    const loadStudentBatches = async () => {
      if (!loggedInStudentId) {
        setEnrolledBatches([]);
        setSelectedBatch('');
        setStatus('Unable to determine logged-in student. Please log in again.');
        return;
      }

      try {
        setStatus('');
        const batches = await apiFetch(`/students/${loggedInStudentId}/batches`, { withAuth: true });
        setEnrolledBatches(batches);
        setSelectedBatch((prev) => (batches.some((b) => b.id === prev) ? prev : batches[0]?.id || ''));
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadStudentBatches();
  }, [loggedInStudentId]);

  useEffect(() => {
    const loadMaterials = async () => {
      if (!loggedInStudentId || !selectedBatch) {
        setMaterials([]);
        return;
      }

      try {
        const data = await apiFetch(
          `/students/${encodeURIComponent(loggedInStudentId)}/materials?batch_id=${encodeURIComponent(selectedBatch)}&search=${encodeURIComponent(search)}`,
          { withAuth: true }
        );
        setMaterials(data);
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadMaterials();
  }, [selectedBatch, loggedInStudentId, search]);

  const filteredMaterials = useMemo(() => materials, [materials]);

  const onDownload = async (material) => {
    setStatus('');
    try {
      const localFile = await getMaterialBlob(material.id);
      if (!localFile?.blob) {
        setStatus('File blob not found in IndexedDB for this material.');
        return;
      }

      const url = URL.createObjectURL(localFile.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = localFile.fileName || material.file_name || 'study-material';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="materials-page">
      <h2>Student Study Materials</h2>
      <p className="materials-disclaimer">
        Note: Metadata is synced with PostgreSQL. Files are currently proxied via IndexedDB. Production will use Google/Cloudflare R2.
      </p>

      <div className="materials-panel">
        <div className="materials-grid">
          <div className="field-block">
            <label>Logged-in Student</label>
            <input type="text" value={currentUser?.name || 'Student'} readOnly />
          </div>

          <div className="field-block">
            <label>My Batches</label>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option value="">-- Select Batch --</option>
              {enrolledBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-block">
          <label>Search Materials by Name</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name"
          />
        </div>

        {status && <p className="status-text">{status}</p>}
      </div>

      <div className="materials-panel">
        <h3>Materials</h3>
        {filteredMaterials.length === 0 ? (
          <p className="empty-text">No materials found for selected batch.</p>
        ) : (
          <table className="materials-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Uploaded By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <tr key={material.id}>
                  <td>{material.file_name}</td>
                  <td>{material.file_type}</td>
                  <td>{material.uploader?.name || 'Teacher'}</td>
                  <td>
                    <button onClick={() => onDownload(material)}>Download</button>
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

export default MaterialStudentView;
