CREATE TABLE IF NOT EXISTS "listing_provinces" (
  "listing_id" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
  "province_category_id" uuid NOT NULL REFERENCES "categories"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "listing_provinces_listing_id_province_category_id_pk"
    PRIMARY KEY ("listing_id", "province_category_id")
);

CREATE INDEX IF NOT EXISTS "listing_provinces_province_listing_idx"
  ON "listing_provinces" ("province_category_id", "listing_id");

INSERT INTO "listing_provinces" ("listing_id", "province_category_id")
SELECT "id", "province_category_id"
FROM "listings"
ON CONFLICT ("listing_id", "province_category_id") DO NOTHING;

UPDATE "orders"
SET "metadata" = "metadata" || jsonb_build_object('provinces', jsonb_build_array("metadata" -> 'province'))
WHERE "metadata" ? 'province'
  AND NOT ("metadata" ? 'provinces');

ALTER TABLE "listing_provinces" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "listing_provinces" FROM anon, authenticated;
