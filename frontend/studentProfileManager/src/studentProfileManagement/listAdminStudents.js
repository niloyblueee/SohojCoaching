import React, { Fragment, useEffect, useState } from "react";
import EditProfile from "./editProfile";

const StudentList = () => {
  const [users, setStudents] = useState([]);

  const getStudent = async () => {
    try {
      const response = await fetch("http://localhost:5000/studentProfile");
      const jsonData = await response.json();

      setStudents(jsonData);
    } catch (err) {
      console.error(err.message);
    }
  };

  // NEW FUNCTION: Handle Status Toggle
  const updateStatus = async (id, newStatus) => {
    try {
      const body = { status: newStatus };
      const response = await fetch(`http://localhost:5000/studentProfile/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        // Update the state locally so the UI changes instantly without a page reload
        setStudents(users.map(user => 
          user.id === id ? { ...user, status: newStatus } : user
        ));
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    getStudent();
  }, []);

  return (
    <Fragment>
      <h1 className="text-center mt-5">Student Profile Management</h1>
      <table className="table mt-5 text-center">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Edit</th>
            <th>Status</th> {/* Added Status Header */}
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <EditProfile users={user} />
              </td>
              <td>
                {/* NEW: Toggle Button Group */}
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    // Highlights green if verified, outline if not
                    className={`btn ${user.status === 'Verified' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() => user.status !== 'Verified' && updateStatus(user.id, 'Verified')}
                  >
                    Verified
                  </button>
                  <button
                    type="button"
                    // Highlights red if blocked, outline if not
                    className={`btn ${user.status === 'Blocked' ? 'btn-danger' : 'btn-outline-danger'}`}
                    onClick={() => user.status !== 'Blocked' && updateStatus(user.id, 'Blocked')}
                  >
                    Blocked
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Fragment>
  );
};

export default StudentList;