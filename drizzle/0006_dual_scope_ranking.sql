DROP INDEX IF EXISTS "listings_ranking_idx";
DROP INDEX IF EXISTS "listings_province_ranking_idx";

CREATE INDEX IF NOT EXISTS "listings_active_ranking_idx"
  ON "listings" ("total_paid" DESC, "created_at" ASC, "id" ASC)
  WHERE "status" = 'ACTIVE';
