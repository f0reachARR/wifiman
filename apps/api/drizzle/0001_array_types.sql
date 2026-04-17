-- #8 DB配列型移行 + notices timestamps + device_specs archivedAt

-- device_specs.supported_bands: text (JSON) → text[] (native array)
ALTER TABLE device_specs
  ALTER COLUMN supported_bands TYPE text[]
  USING ARRAY(SELECT jsonb_array_elements_text(supported_bands::jsonb));

-- issue_reports.mitigation_tried: text (JSON) → text[] (native array)
ALTER TABLE issue_reports
  ALTER COLUMN mitigation_tried TYPE text[]
  USING CASE
    WHEN mitigation_tried IS NULL OR mitigation_tried = '' THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(mitigation_tried::jsonb))
  END;

-- notices: add created_at and updated_at timestamps
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- device_specs: add archived_at for soft-delete support
ALTER TABLE device_specs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
