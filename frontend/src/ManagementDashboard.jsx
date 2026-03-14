import React, { useEffect, useMemo, useState } from 'react';
import './ManagementDashboard.css';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;
const AUTH_STORAGE_KEY = 'sohojcoaching_auth';

const getAuthHeaders = () => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return {};
    return { Authorization: `Bearer ${parsed.token}` };
  } catch {
    return {};
  }
};

const ManagementDashboard = () => {
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollForm, setEnrollForm] = useState({ studentId: '' });
  const [assignForm, setAssignForm] = useState({ teacherId: '', role: 'Lead' });
  const [batchMembers, setBatchMembers] = useState({ students: [], teachers: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) => {
      return student.name.toLowerCase().includes(q) || student.email?.toLowerCase().includes(q);
    });
  }, [students, studentSearch]);

  const apiFetch = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {})
      },
      ...options
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const errorMessage = payload?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload;
  };

  const loadInitialData = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [batchData, studentData, teacherData] = await Promise.all([
        apiFetch('/batches'),
        apiFetch('/students'),
        apiFetch('/teachers')
      ]);
      setBatches(batchData);
      setStudents(studentData);
      setTeachers(teacherData);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchMembers = async (batchId) => {
    if (!batchId) {
      setBatchMembers({ students: [], teachers: [] });
      return;
    }

    try {
      const data = await apiFetch(`/batches/${batchId}/members`);
      setBatchMembers(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    fetchBatchMembers(selectedBatchId);
  }, [selectedBatchId]);

  const handleEnrollment = async (event) => {
    event.preventDefault();
    if (!enrollForm.studentId || !selectedBatchId) {
      setMessage('Select student and batch.');
      return;
    }

    setMessage('');
    try {
      await apiFetch('/enrollments', {
        method: 'POST',
        body: JSON.stringify({ student_id: enrollForm.studentId, batch_id: selectedBatchId })
      });
      setEnrollForm({ studentId: '' });
      await fetchBatchMembers(selectedBatchId);
      setMessage('Student enrolled successfully.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleTeacherAssignment = async (event) => {
    event.preventDefault();
    if (!assignForm.teacherId || !selectedBatchId || !assignForm.role.trim()) {
      setMessage('Select teacher, batch, and role.');
      return;
    }

    setMessage('');
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: assignForm.teacherId,
          batch_id: selectedBatchId,
          role: assignForm.role.trim()
        })
      });
      setAssignForm((prev) => ({ ...prev, teacherId: '' }));
      await fetchBatchMembers(selectedBatchId);
      setMessage('Teacher assigned successfully.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleDropStudent = async (enrollmentId) => {
    setMessage('');
    try {
      await apiFetch(`/enrollments/${enrollmentId}`, { method: 'DELETE' });
      await fetchBatchMembers(selectedBatchId);
      setMessage('Student removed from batch.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleUnassignTeacher = async (assignmentId) => {
    setMessage('');
    try {
      await apiFetch(`/assignments/${assignmentId}`, { method: 'DELETE' });
      await fetchBatchMembers(selectedBatchId);
      setMessage('Teacher unassigned from batch.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Management Dashboard (FR-2 & FR-4)</h2>
        <p className="subtext">Base Layer: Enrollment, Assignment and Active Batch Members</p>
        <div className="form-group batch-selector">
          <label>Global Batch Selector</label>
          <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
            <option value="">-- Select a Batch --</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {loading && <p className="state-text">Loading data...</p>}
        {!!message && <p className="state-text">{message}</p>}
      </header>

      <section className="controls-section">
        {/* Student Enrollment Form */}
        <div className="card">
          <h3>Enroll a Student (FR-2)</h3>
          <form onSubmit={handleEnrollment}>
            <div className="form-group">
              <label>Search Student</label>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or email"
              />
            </div>
            <div className="form-group">
              <label>Select Student</label>
              <select value={enrollForm.studentId} onChange={e => setEnrollForm({ ...enrollForm, studentId: e.target.value })}>
                <option value="">-- Choose Student --</option>
                {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={!selectedBatchId}>Enroll Action</button>
          </form>
        </div>

        {/* Teacher Assignment Form */}
        <div className="card">
          <h3>Assign a Teacher (FR-4)</h3>
          <form onSubmit={handleTeacherAssignment}>
            <div className="form-group">
              <label>Select Teacher</label>
              <select value={assignForm.teacherId} onChange={e => setAssignForm({ ...assignForm, teacherId: e.target.value })}>
                <option value="">-- Choose Teacher --</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Role / Position</label>
              <input
                type="text"
                value={assignForm.role}
                onChange={e => setAssignForm({ ...assignForm, role: e.target.value })}
                placeholder="e.g. Lead, Assistant"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!selectedBatchId}>Assign Role</button>
          </form>
        </div>
      </section>

      {/* Active Lists Section */}
      {selectedBatchId && (
        <section className="lists-section">
          <div className="batch-members">
            <h3>Active Lists for Selected Batch</h3>

            <h4>Enrolled Students</h4>
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchMembers.students.length === 0 && <tr><td colSpan="3">No students enrolled</td></tr>}
                {batchMembers.students.map(s => (
                  <tr key={s.enrollmentId}>
                    <td>{s.name}</td>
                    <td>{s.status}</td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDropStudent(s.enrollmentId)}>Drop</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4>Assigned Teachers</h4>
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchMembers.teachers.length === 0 && <tr><td colSpan="3">No teachers assigned</td></tr>}
                {batchMembers.teachers.map(t => (
                  <tr key={t.assignmentId}>
                    <td>{t.name}</td>
                    <td>{t.role}</td>
                    <td>
                      <button className="btn-danger" onClick={() => handleUnassignTeacher(t.assignmentId)}>Unassign</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default ManagementDashboard;