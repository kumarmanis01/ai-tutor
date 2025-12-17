-- Migration: Add JobExecutionLog table
-- Generated: 2025-12-17

CREATE TABLE IF NOT EXISTS job_execution_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  event text NOT NULL,
  prev_status text,
  new_status text,
  message text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_job FOREIGN KEY(job_id) REFERENCES execution_job(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_execution_log_job_id ON job_execution_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_event ON job_execution_log(event);
CREATE INDEX IF NOT EXISTS idx_job_execution_log_created_at ON job_execution_log(created_at);
