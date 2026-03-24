import React, { Fragment, useState } from "react";

const EditProfile = ({ users }) => {
  const [name, setName] = useState(users.name);
  const [email, setEmail] = useState(users.email);

  // Helper function to reset fields if user cancels
  const resetFields = () => {
    setName(users.name);
    setEmail(users.email);
  };

  // Updated function to handle both fields
  const updateProfile = async e => {
    e.preventDefault();
    try {
      const body = { name, email }; // Send both name and email
      const response = await fetch(
        `http://localhost:5000/studentProfile/${users.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );

      window.location = "/";
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <Fragment>
      <button
        type="button"
        className="btn btn-warning"
        data-toggle="modal"
        data-target={`#id${users.id}`}
      >
        Edit
      </button>

      <div
        className="modal"
        id={`id${users.id}`}
        onClick={resetFields} // Resets if clicking outside the modal
      >
        <div className="modal-dialog" onClick={e => e.stopPropagation()}> 
          {/* stopPropagation prevents the modal from closing/resetting when clicking inside */}
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Profile</h4>
              <button
                type="button"
                className="close"
                data-dismiss="modal"
                onClick={resetFields}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <label>Name</label>
              <input
                type="text"
                className="form-control mb-3"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-warning"
                data-dismiss="modal"
                onClick={e => updateProfile(e)}
              >
                Save Changes
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-dismiss="modal"
                onClick={resetFields}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default EditProfile;
