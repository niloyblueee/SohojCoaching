CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name VARCHAR(255) UNIQUE,
  subject VARCHAR(255),
  schedule VARCHAR(255),
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  teacher_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_batches_monthly_fee_non_negative CHECK (monthly_fee >= 0),
  CONSTRAINT fk_batches_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_name VARCHAR(255);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule VARCHAR(255);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS teacher_id UUID NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE batches
SET
  batch_name = COALESCE(NULLIF(batch_name, ''), name),
  subject = COALESCE(NULLIF(subject, ''), course),
  monthly_fee = COALESCE(monthly_fee, 0)
WHERE batch_name IS NULL OR subject IS NULL OR monthly_fee IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_batches_batch_name'
  ) THEN
    CREATE UNIQUE INDEX uq_batches_batch_name ON batches(batch_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_batches_monthly_fee_non_negative'
  ) THEN
    ALTER TABLE batches
      ADD CONSTRAINT chk_batches_monthly_fee_non_negative CHECK (monthly_fee >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_batches_teacher'
  ) THEN
    ALTER TABLE batches
      ADD CONSTRAINT fk_batches_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_enrollments_batch'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT fk_enrollments_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT;
  END IF;
END $$;
