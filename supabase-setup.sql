-- 1. Tabelle für die Zusammenfassungen erstellen
CREATE TABLE summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  summary_en TEXT, -- English summary
  visual_description TEXT NOT NULL,
  visual_description_en TEXT, -- English visual description
  processed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  thumbnail_url TEXT NOT NULL
);

-- Migration für bestehende Tabellen:
-- ALTER TABLE summaries ADD COLUMN summary_en TEXT;
-- ALTER TABLE summaries ADD COLUMN visual_description_en TEXT;

-- 2. Sicherheit (Row Level Security) aktivieren
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- 3. Lesezugriff für alle (anonym) erlauben (wichtig für die Next.js Website)
CREATE POLICY "Public summaries are viewable by everyone."
  ON summaries FOR SELECT
  USING (true);

-- (Das Einfügen neuer Zeilen wird über den Service-Role-Key im Backend gemacht,
-- der die RLS umgeht. Daher brauchen wir hierfür keine extra Policy).
