CREATE TABLE IF NOT EXISTS integration_webhook_delivery (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  url TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_status INTEGER,
  last_error TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP(3)
);
