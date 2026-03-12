-- Migration: FR-17/FR-18 – Exam Script Management
-- Creates the student_scripts metadata table.
-- Each row links one evaluated PDF to one student, one batch, and the teacher who graded it.
-- The actual PDF binary is stored in IndexedDB (proxy) / Cloudflare R2 (production).
-- The storage_url column holds the idb-proxy URI that maps to the IndexedDB key.

CREATE TABLE IF NOT EXISTS student_scripts (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID         NOT NULL REFERENCES users(id),
    batch_id    UUID         NOT NULL REFERENCES batches(id),
    exam_name   VARCHAR(255) NOT NULL,
    file_type   VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    storage_url TEXT         NOT NULL,
    uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    uploaded_by UUID         NOT NULL REFERENCES users(id)
);

-- Index for FR-18: fast, student-scoped lookups so students can only query their own records
CREATE INDEX IF NOT EXISTS idx_student_scripts_student_id  ON student_scripts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_scripts_batch_id    ON student_scripts(batch_id);
CREATE INDEX IF NOT EXISTS idx_student_scripts_uploaded_by ON student_scripts(uploaded_by);
