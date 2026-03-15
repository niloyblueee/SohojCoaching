

CREATE TABLE IF NOT EXISTS course (
    courseID SERIAL PRIMARY KEY,
    courseName VARCHAR(255),
    fee NUMERIC(10, 2)
);


CREATE TABLE IF NOT EXISTS attendance (
    attendanceID SERIAL PRIMARY KEY,
    userID UUID REFERENCES users(id),
    classDate DATE DEFAULT CURRENT_DATE,
    isPresent BOOLEAN
);

CREATE TABLE IF NOT EXISTS student_batches (
    userID UUID REFERENCES users(id),
    batchID UUID REFERENCES batches(id),
    PRIMARY KEY (userID, batchID)
);
