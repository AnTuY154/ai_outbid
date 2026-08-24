CREATE TABLE IF NOT EXISTS "listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_url" text NOT NULL,
  "original_url" text NOT NULL,
  "slug" text NOT NULL,
  "domain" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "image_url" text,
  "favicon_url" text,
  "total_paid" bigint DEFAULT 0 NOT NULL,
  "click_count" bigint DEFAULT 0 NOT NULL,
  "first_paid_at" timestamptz NOT NULL,
  "last_paid_at" timestamptz NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_code" text NOT NULL,
  "canonical_url" text NOT NULL,
  "expected_amount" bigint NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "metadata" jsonb NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "paid_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id"),
  "sepay_transaction_id" text NOT NULL,
  "amount" bigint NOT NULL,
  "bank_account" text NOT NULL,
  "transaction_content" text DEFAULT '' NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "paid_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visitor_id" uuid NOT NULL,
  "first_seen_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "first_referrer" text,
  "user_agent_hash" text
);

CREATE TABLE IF NOT EXISTS "site_stats" (
  "id" smallint PRIMARY KEY,
  "total_visitors" bigint DEFAULT 0 NOT NULL,
  "total_pageviews" bigint DEFAULT 0 NOT NULL,
  "total_outbound_clicks" bigint DEFAULT 0 NOT NULL,
  "total_revenue" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "daily_stats" (
  "day" date PRIMARY KEY,
  "unique_visitors" bigint DEFAULT 0 NOT NULL,
  "pageviews" bigint DEFAULT 0 NOT NULL,
  "outbound_clicks" bigint DEFAULT 0 NOT NULL,
  "paid_orders" integer DEFAULT 0 NOT NULL,
  "revenue" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "listings_canonical_url_unique" ON "listings" ("canonical_url");
CREATE UNIQUE INDEX IF NOT EXISTS "listings_slug_unique" ON "listings" ("slug");
CREATE INDEX IF NOT EXISTS "listings_ranking_idx" ON "listings" ("status", "total_paid", "first_paid_at");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_code_unique" ON "orders" ("order_code");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "orders_canonical_url_idx" ON "orders" ("canonical_url");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_sepay_transaction_id_unique" ON "payments" ("sepay_transaction_id");
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments" ("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_visitor_id_unique" ON "visitors" ("visitor_id");

INSERT INTO "site_stats" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_stats" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active listings" ON "listings";
CREATE POLICY "Public can read active listings" ON "listings" FOR SELECT USING ("status" = 'ACTIVE');

DROP POLICY IF EXISTS "Public can read site stats" ON "site_stats";
CREATE POLICY "Public can read site stats" ON "site_stats" FOR SELECT USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "listings";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "site_stats";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
