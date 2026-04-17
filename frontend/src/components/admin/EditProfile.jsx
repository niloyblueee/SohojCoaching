import React, { useState } from "react";
import { apiFetch } from "../../services/httpClient";

const EditProfile = ({ user, onUpdateSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/studentProfile/${user.id}`, {
        method: "PUT",
        body: { name, email },
        withAuth: true
      });
      setIsOpen(false);
      onUpdateSuccess(); // Refresh the parent list cleanly
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <>
      <button className="batch-btn primary" onClick={() => setIsOpen(true)}>
        Edit
      </button>

      {isOpen && (
        <div className="batch-modal-backdrop">
          <div className="batch-modal">
            <h3>Edit Profile</h3>
            <form className="batch-form" onSubmit={updateProfile}>
              <label>Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
              
              <label style={{ marginTop: '10px' }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />

              <div className="batch-modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="batch-btn danger" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="batch-btn primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default EditProfile;