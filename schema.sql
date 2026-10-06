-- Run once:  psql "$DATABASE_URL" -f schema.sql
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY, alert_type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT,
  observed_value DOUBLE PRECISION, threshold DOUBLE PRECISION, unit TEXT,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ);

-- One row. hold_* = a person sent a manual command, so automation leaves that device alone.
CREATE TABLE IF NOT EXISTS control_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  automation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  hold_ac_power BOOLEAN NOT NULL DEFAULT FALSE,
  hold_ac_setpoint BOOLEAN NOT NULL DEFAULT FALSE,
  hold_fan BOOLEAN NOT NULL DEFAULT FALSE);
INSERT INTO control_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Every automation trigger and every manual command.
CREATE TABLE IF NOT EXISTS automation_events (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,   -- 'automation' | 'manual'
  trigger TEXT NOT NULL, reason TEXT NOT NULL, action TEXT NOT NULL,
  measured_value DOUBLE PRECISION, threshold DOUBLE PRECISION, unit TEXT,
  outcome TEXT NOT NULL); -- 'success' | 'failed'
