import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
    'CREATE EXTENSION IF NOT EXISTS pgcrypto',
    `
    CREATE TABLE IF NOT EXISTS fee_dues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
      month_number INT NOT NULL CHECK (month_number > 0),
      due_month DATE NOT NULL,
      amount_due INT NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ NULL,
      CONSTRAINT uq_fee_dues_enrollment_month UNIQUE (enrollment_id, month_number),
      CONSTRAINT uq_fee_dues_enrollment_due_month UNIQUE (enrollment_id, due_month)
    )
    `,
    'CREATE INDEX IF NOT EXISTS idx_fee_dues_due_month ON fee_dues(due_month)',
    'CREATE INDEX IF NOT EXISTS idx_fee_dues_status ON fee_dues(status)',
    'CREATE INDEX IF NOT EXISTS idx_fee_dues_enrollment_id ON fee_dues(enrollment_id)',
    `
    UPDATE fee_dues AS fd
    SET status = 'paid',
        paid_at = COALESCE(fd.paid_at, fp.payment_date)
    FROM fee_payments fp
    WHERE fd.enrollment_id = fp.enrollment_id
      AND fd.month_number = fp.month_number
      AND fd.status <> 'paid'
    `
];

async function main() {
    for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
    }

    console.log('FR-7 fee dues migration completed.');
}

main()
    .catch((error) => {
        console.error('FR-7 fee dues migration failed:', error.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
