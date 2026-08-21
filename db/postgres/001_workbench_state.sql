CREATE TABLE IF NOT EXISTS workbench_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
