import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const statements = [
    'CREATE EXTENSION IF NOT EXISTS pgcrypto',
    `
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attempt_number INT NOT NULL CHECK (attempt_number > 0),
      status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'submitted', 'expired')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ NULL,
      duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_quiz_attempts_quiz_student_attempt UNIQUE (quiz_id, student_id, attempt_number)
    )
    `,
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id)',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status)',
    `
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      mcq_selected_option_index INT NULL,
      broad_text_answer TEXT NULL,
      answer_file_data TEXT NULL,
      answer_file_name VARCHAR(255) NULL,
      answer_file_type VARCHAR(120) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_quiz_answers_attempt_question UNIQUE (attempt_id, question_id)
    )
    `,
    'CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id)',
    'CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id)'
];

const run = async () => {
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }

    console.log('FR-22 quiz submission migration completed.');
};

run()
    .catch((error) => {
        console.error('FR-22 migration failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
