CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  availability_type VARCHAR(20) NOT NULL CHECK (availability_type IN ('anytime', 'scheduled')),
  starts_at TIMESTAMPTZ NULL,
  entry_close_at TIMESTAMPTZ NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  attempt_mode VARCHAR(20) NOT NULL CHECK (attempt_mode IN ('one_time', 'repeatable')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_batch_id ON quizzes(batch_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_id ON quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_entry_close_at ON quizzes(entry_close_at);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  order_no INT NOT NULL CHECK (order_no > 0),
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('mcq', 'broad')),
  question_text TEXT NULL,
  question_image_data TEXT NULL,
  marks INT NOT NULL DEFAULT 1 CHECK (marks > 0),
  mcq_options JSONB NULL,
  correct_option_index INT NULL,
  allow_file_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_quiz_questions_quiz_order UNIQUE (quiz_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
