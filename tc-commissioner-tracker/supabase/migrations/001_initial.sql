-- Civic Ledger: Initial Schema
-- Transylvania County Commissioner Tracker

-- ============================================
-- MEETINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT DEFAULT 'regular',
  time TEXT,
  attendees JSONB DEFAULT '[]',
  audience_size INTEGER,
  duration TEXT,
  tldr TEXT,
  key_votes JSONB DEFAULT '[]',
  commissioner_activity JSONB DEFAULT '{}',
  public_comments JSONB DEFAULT '[]',
  follow_ups JSONB DEFAULT '[]',
  source_url TEXT,
  agenda_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOLLOW-UPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  date_raised DATE NOT NULL,
  owner TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dropped')),
  categories JSONB DEFAULT '[]',
  related_meeting_id TEXT REFERENCES meetings(id),
  resolved_date DATE,
  resolved_meeting_id TEXT,
  resolution TEXT,
  last_referenced_date DATE,
  last_referenced_meeting_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PUBLIC STATEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public_statements (
  id SERIAL PRIMARY KEY,
  commissioner_id TEXT NOT NULL,
  date DATE NOT NULL,
  source TEXT,
  type TEXT CHECK (type IN ('news', 'statement')),
  text TEXT NOT NULL,
  url TEXT,
  categories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_owner ON follow_ups(owner);
CREATE INDEX IF NOT EXISTS idx_follow_ups_meeting ON follow_ups(related_meeting_id);
CREATE INDEX IF NOT EXISTS idx_public_statements_commissioner ON public_statements(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_public_statements_date ON public_statements(date DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on meetings"
  ON meetings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated write access on meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update access on meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete access on meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (true);

-- Follow-ups
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on follow_ups"
  ON follow_ups FOR SELECT
  USING (true);

CREATE POLICY "Authenticated write access on follow_ups"
  ON follow_ups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update access on follow_ups"
  ON follow_ups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete access on follow_ups"
  ON follow_ups FOR DELETE
  TO authenticated
  USING (true);

-- Public statements
ALTER TABLE public_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access on public_statements"
  ON public_statements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated write access on public_statements"
  ON public_statements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update access on public_statements"
  ON public_statements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete access on public_statements"
  ON public_statements FOR DELETE
  TO authenticated
  USING (true);
