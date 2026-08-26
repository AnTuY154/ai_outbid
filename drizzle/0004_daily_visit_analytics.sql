CREATE TABLE IF NOT EXISTS "visitor_daily_visits" (
  "day" date NOT NULL,
  "visitor_id" uuid NOT NULL REFERENCES "visitors"("visitor_id") ON DELETE CASCADE,
  "first_seen_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "visitor_daily_visits_day_visitor_id_pk" PRIMARY KEY ("day", "visitor_id")
);

CREATE INDEX IF NOT EXISTS "visitor_daily_visits_visitor_id_idx"
  ON "visitor_daily_visits" ("visitor_id");

ALTER TABLE "visitor_daily_visits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "visitor_daily_visits" FROM anon, authenticated;
