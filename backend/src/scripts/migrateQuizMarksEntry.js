import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
    "ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS grading_status VARCHAR(20) NOT NULL DEFAULT 'pending'",
    'ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS total_awarded_marks INT NOT NULL DEFAULT 0',
    'ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_by UUID NULL',
    'ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ NULL',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_grading_status ON quiz_attempts(grading_status)',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS awarded_marks INT NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS teacher_explanation TEXT NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS review_file_data TEXT NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS review_file_name VARCHAR(255) NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS review_file_type VARCHAR(120) NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS reviewed_by UUID NULL',
    'ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL'
];

async function main() {
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }

    console.log('FR-13 quiz marks-entry migration completed.');
}

main()
    .catch((error) => {
        console.error('FR-13 quiz marks-entry migration failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
