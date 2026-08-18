CREATE TABLE IF NOT EXISTS community_suggestions (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  suggestion TEXT NOT NULL CHECK (length(suggestion) BETWEEN 20 AND 1000),
  normalized_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'submitted',
      'under_review',
      'approved',
      'planned',
      'already_planned',
      'rejected',
      'duplicate',
      'implemented'
    )
  ),
  developer_response TEXT CHECK (developer_response IS NULL OR length(developer_response) <= 2000),
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_suggestions_normalized_hash
  ON community_suggestions(normalized_hash);

CREATE INDEX IF NOT EXISTS idx_community_suggestions_status_created
  ON community_suggestions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_rate_limits (
  client_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  submit_count INTEGER NOT NULL DEFAULT 0 CHECK (submit_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_community_rate_limits_window
  ON community_rate_limits(window_start);
