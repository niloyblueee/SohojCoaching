import { useEffect, useState } from 'react';
import { saveMaterialBlob, deleteMaterialBlob } from './services/indexedDbMaterialProxy';
import './StudyMaterials.css';
import { apiFetch } from './services/httpClient';

const ACCEPT_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

function MaterialTeacherView() {
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [file, setFile] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [status, setStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const loadInitialData = async () => {
    setStatus('');
    try {
      const [batchData, teacherData] = await Promise.all([
        apiFetch('/batches', { withAuth: true }),
        apiFetch('/teachers', { withAuth: true })
      ]);
      setBatches(batchData);
      setTeachers(teacherData);
      if (teacherData.length > 0) setSelectedTeacher((prev) => prev || teacherData[0].id);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const loadMaterials = async (batchId) => {
    if (!batchId) {
      setMaterials([]);
      return;
    }

    try {
      const data = await apiFetch(`/study-materials?batch_id=${encodeURIComponent(batchId)}`, { withAuth: true });
      setMaterials(data);
    } catch (error) {
      setStatus(error.message);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadMaterials(selectedBatch);
  }, [selectedBatch]);

  const onUpload = async (event) => {
    event.preventDefault();

    if (!selectedBatch || !selectedTeacher || !file) {
      setStatus('Choose batch, teacher, and file first.');
      return;
    }

    setIsSyncing(true);
    setStatus('Syncing metadata to Postgres...');

    try {
      const metadata = await apiFetch('/study-materials', {
        method: 'POST',
        body: {
          batch_id: selectedBatch,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          uploaded_by: selectedTeacher
        },
        withAuth: true
      });

      await saveMaterialBlob(metadata.id, file, metadata.file_name, metadata.file_type);

      setStatus('Material uploaded successfully.');
      setFile(null);
      const fileInput = document.getElementById('teacher-upload-input');
      if (fileInput) fileInput.value = '';
      await loadMaterials(selectedBatch);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const onDelete = async (materialId) => {
    setStatus('');
    try {
      await apiFetch(`/study-materials/${materialId}`, { method: 'DELETE', withAuth: true });
      await deleteMaterialBlob(materialId);
      await loadMaterials(selectedBatch);
      setStatus('Material deleted from Postgres and IndexedDB.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className="materials-page">
      <h2>Teacher Material Management</h2>
      <p className="materials-disclaimer">
        Note: Metadata is synced with PostgreSQL. Files are currently proxied via IndexedDB. Production will use Google/Cloudflare R2.
      </p>

      <div className="materials-panel">
        <div className="materials-grid">
          <div className="field-block">
            <label>Batch Selector</label>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option value="">-- Select Batch --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-block">
            <label>Uploaded By (Teacher)</label>
            <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
              <option value="">-- Select Teacher --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={onUpload} className="upload-zone">
          <label htmlFor="teacher-upload-input">File Upload Zone (PDF, DOC, DOCX, PPT)</label>
          <input
            id="teacher-upload-input"
            type="file"
            accept={ACCEPT_TYPES}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={isSyncing}>
            Upload Material
          </button>
        </form>

        {isSyncing && <p className="status-text">Syncing metadata to Postgres...</p>}
        {!isSyncing && status && <p className="status-text">{status}</p>}
      </div>

      <div className="materials-panel">
        <h3>Uploaded Materials</h3>
        {materials.length === 0 ? (
          <p className="empty-text">No materials uploaded for selected batch.</p>
        ) : (
          <table className="materials-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Uploaded At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id}>
                  <td>{material.file_name}</td>
                  <td>{material.file_type}</td>
                  <td>{new Date(material.uploaded_at).toLocaleString()}</td>
                  <td>
                    <button className="danger-btn" onClick={() => onDelete(material.id)}>
                      Delete
                    </button>
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

export default MaterialTeacherView;
