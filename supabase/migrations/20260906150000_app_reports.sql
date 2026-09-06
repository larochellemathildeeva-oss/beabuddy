-- Béa had no way for a traveller to report a problem and no record of client-side
-- crashes: 15 console.error calls that vanish in the user's browser, and a
-- Terms section titled "Feedback" with no channel behind it. One table serves
-- both, because a bug report and a crash report are the same shape.

CREATE TABLE public.app_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('feedback', 'error')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  -- Where it happened and what was running. Bounded so a runaway stack cannot
  -- be used to fill the table.
  path text CHECK (path IS NULL OR char_length(path) <= 300),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 8000),
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 40),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 400),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.app_reports TO authenticated;
GRANT ALL ON public.app_reports TO service_role;

ALTER TABLE public.app_reports ENABLE ROW LEVEL SECURITY;

-- Own rows only, and no UPDATE or DELETE at all: a report is a record of what
-- happened, so it should not be editable after the fact.
CREATE POLICY "Users file their own reports" ON public.app_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read their own reports" ON public.app_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX app_reports_kind_created_idx ON public.app_reports (kind, created_at DESC);
