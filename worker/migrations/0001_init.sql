-- Coach push worker: settings, push subscriptions, push log
CREATE TABLE IF NOT EXISTS config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,          -- sha256 of the endpoint
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT,
  created TEXT,
  seen TEXT,                    -- last time the app re-sent this subscription
  last_ok TEXT,
  last_status INTEGER,
  fails INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  sent INTEGER,
  delivered INTEGER,
  removed INTEGER,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS log_ts ON log (ts);
