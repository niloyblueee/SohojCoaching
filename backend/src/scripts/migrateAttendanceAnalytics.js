import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
    `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
  END IF;
END $$`,
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  session_date DATE NOT NULL,
  topic VARCHAR(255),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_attendance_sessions_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_sessions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT uq_attendance_sessions_batch_date UNIQUE (batch_id, session_date)
)`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by UUID,
  CONSTRAINT fk_attendance_records_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_records_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_records_marker FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT uq_attendance_records_session_student UNIQUE (session_id, student_id)
)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch_id ON attendance_sessions(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_sessions_session_date ON attendance_sessions(session_date)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by ON attendance_records(marked_by)`
];

async function main() {
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }

    console.log('FR-12 attendance migration applied successfully.');
}

main()
    .catch((error) => {
        console.error('FR-12 attendance migration failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
