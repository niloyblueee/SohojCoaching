CREATE TABLE IF NOT EXISTS study_materials (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(150) NOT NULL,
  storage_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID NOT NULL,
  CONSTRAINT fk_study_materials_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_study_materials_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_study_materials_batch_id ON study_materials(batch_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_uploaded_by ON study_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_study_materials_file_name ON study_materials(file_name);
