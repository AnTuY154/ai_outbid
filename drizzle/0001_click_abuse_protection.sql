CREATE TABLE IF NOT EXISTS "listing_click_guards" (
  "listing_id" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
  "visitor_hash" text NOT NULL,
  "last_counted_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("listing_id", "visitor_hash")
);

CREATE TABLE IF NOT EXISTS "click_rate_limits" (
  "client_hash" text PRIMARY KEY,
  "window_started_at" timestamptz DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL CHECK ("request_count" >= 0)
);

ALTER TABLE "listing_click_guards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "click_rate_limits" ENABLE ROW LEVEL SECURITY;
