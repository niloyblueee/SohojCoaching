import React, { useCallback, useEffect, useState } from "react";
import EditProfile from "./EditProfile";
import { apiFetch } from "../../services/httpClient";

const StudentList = () => {
  const [users, setStudents] = useState([]);
  const [error, setError] = useState('');

  const getStudents = useCallback(async () => {
    try {
      // Uses centralized apiFetch with auth token injection
      const data = await apiFetch("/studentProfile", { withAuth: true });
      setStudents(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      await apiFetch(`/studentProfile/${id}/status`, {
        method: "PUT",
        body: { status: newStatus },
        withAuth: true
      });
      // Update UI instantly
      setStudents((prevUsers) =>
        prevUsers.map((user) => (user.id === id ? { ...user, status: newStatus } : user))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void getStudents();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [getStudents]);

  return (
    <div className="batch-page"> {/* Reusing your existing container styles */}
      <header className="batch-page-header">
        <h2>Student Profile Management</h2>
        <p>Verify or block student access to the platform.</p>
      </header>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <main className="batch-main" style={{ marginTop: '20px' }}>
        <table className="materials-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span style={{
                    color: user.status === 'Blocked' ? '#ffb0be' : '#5fe2ad',
                    fontWeight: 'bold'
                  }}>
                    {user.status || 'Verified'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '10px' }}>
                  <EditProfile user={user} onUpdateSuccess={getStudents} />

                  <button
                    className="batch-btn ghost"
                    onClick={() => updateStatus(user.id, user.status === 'Blocked' ? 'Verified' : 'Blocked')}
                  >
                    {user.status === 'Blocked' ? 'Unblock' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default StudentList;
