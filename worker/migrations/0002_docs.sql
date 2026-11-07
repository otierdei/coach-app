-- Phase 2 (07.11.2026): the coach docs live in D1. Same record as the Drive JSON files: {version, updatedAt, by, data}.
CREATE TABLE IF NOT EXISTS docs (
  name TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  updated_at TEXT,
  by TEXT,
  data TEXT NOT NULL
);
-- change files already applied (Apps Script forwards each inbox file once; a retry must not apply it twice)
CREATE TABLE IF NOT EXISTS applied (
  file TEXT PRIMARY KEY,
  doc TEXT,
  version INTEGER,
  ts TEXT
);
