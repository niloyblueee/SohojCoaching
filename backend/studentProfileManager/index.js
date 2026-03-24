//type commonjs
const express = require('express');
const app = express();
const port = 5000;
const cors = require('cors');
const pool = require('./dbconnect');

app.use(cors());
app.use(express.json());

//ROUTES

//fr1 StudentProfileManagement
//getProfile
app.get("/studentProfile", async (req, res) => {
    try {
        const showProfile = await pool.query("SELECT * FROM users where role='student'");
        res.json(showProfile.rows); 
    } catch (err) {
      console.error(err.message);
    }
});
// Update Profile
app.put("/studentProfile/:id", async (req, res) => {
    try {
        const { id } = req.params; 
        const { name, email } = req.body; 

        const updateProfile = await pool.query(
            "UPDATE users SET name = $1, email = $2 WHERE id = $3 AND role = 'student'",
            [name, email, id]
        );

        res.json("Profile updated successfully!"); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
//Update Status Only
app.put("/studentProfile/:id/status", async (req, res) => {
    try {
        const { id } = req.params; 
        const { status } = req.body; 

        const updateStatus = await pool.query(
            "UPDATE users SET status = $1 WHERE id = $2 AND role = 'student'",
            [status, id]
        );

        res.json("Status updated successfully!"); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});
//fr1 Completed

app.listen(port, () => {
  console.log(`ServerA started on port ${port}`)
});