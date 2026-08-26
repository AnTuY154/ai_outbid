-- A listing represents one website. Existing path-specific registrations are
-- merged before enforcing the domain identity used by the application.
WITH ranked_listings AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY domain
      ORDER BY first_paid_at ASC, id ASC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY domain
      ORDER BY first_paid_at ASC, id ASC
    ) AS row_number,
    sum(total_paid) OVER (PARTITION BY domain) AS merged_total_paid,
    sum(click_count) OVER (PARTITION BY domain) AS merged_click_count,
    min(first_paid_at) OVER (PARTITION BY domain) AS merged_first_paid_at,
    max(last_paid_at) OVER (PARTITION BY domain) AS merged_last_paid_at
  FROM listings
)
UPDATE listings AS listing
SET
  total_paid = ranked_listings.merged_total_paid,
  click_count = ranked_listings.merged_click_count,
  first_paid_at = ranked_listings.merged_first_paid_at,
  last_paid_at = ranked_listings.merged_last_paid_at,
  updated_at = now()
FROM ranked_listings
WHERE listing.id = ranked_listings.keeper_id
  AND ranked_listings.row_number = 1;

WITH ranked_listings AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY domain
      ORDER BY first_paid_at ASC, id ASC
    ) AS keeper_id
  FROM listings
)
DELETE FROM listings AS listing
USING ranked_listings
WHERE listing.id = ranked_listings.id
  AND ranked_listings.id <> ranked_listings.keeper_id;

CREATE UNIQUE INDEX IF NOT EXISTS "listings_domain_unique" ON "listings" ("domain");
