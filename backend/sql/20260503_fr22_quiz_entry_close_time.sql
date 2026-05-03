ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS entry_close_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_entry_close_at ON quizzes(entry_close_at);
