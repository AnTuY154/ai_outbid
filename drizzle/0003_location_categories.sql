CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "parent_id" uuid REFERENCES "categories"("id"),
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_unique" ON "categories" ("slug");

INSERT INTO "categories" ("slug", "name", "kind", "is_active", "sort_order")
VALUES ('location', 'Địa điểm', 'LOCATION_ROOT', true, 0)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name", "kind" = EXCLUDED."kind", "is_active" = EXCLUDED."is_active";

INSERT INTO "categories" ("slug", "name", "kind", "parent_id", "is_active", "sort_order")
SELECT province.slug, province.name, 'PROVINCE', root.id, true, province.sort_order
FROM (
  VALUES
    ('an-giang', 'An Giang', 1), ('bac-ninh', 'Bắc Ninh', 2), ('cao-bang', 'Cao Bằng', 3),
    ('ca-mau', 'Cà Mau', 4), ('can-tho', 'Cần Thơ', 5), ('da-nang', 'Đà Nẵng', 6),
    ('dak-lak', 'Đắk Lắk', 7), ('dien-bien', 'Điện Biên', 8), ('dong-nai', 'Đồng Nai', 9),
    ('dong-thap', 'Đồng Tháp', 10), ('gia-lai', 'Gia Lai', 11), ('ha-noi', 'Hà Nội', 12),
    ('ha-tinh', 'Hà Tĩnh', 13), ('hai-phong', 'Hải Phòng', 14), ('hung-yen', 'Hưng Yên', 15),
    ('hue', 'Huế', 16), ('khanh-hoa', 'Khánh Hòa', 17), ('lai-chau', 'Lai Châu', 18),
    ('lam-dong', 'Lâm Đồng', 19), ('lang-son', 'Lạng Sơn', 20), ('lao-cai', 'Lào Cai', 21),
    ('nghe-an', 'Nghệ An', 22), ('ninh-binh', 'Ninh Bình', 23), ('phu-tho', 'Phú Thọ', 24),
    ('quang-ngai', 'Quảng Ngãi', 25), ('quang-ninh', 'Quảng Ninh', 26), ('quang-tri', 'Quảng Trị', 27),
    ('son-la', 'Sơn La', 28), ('tay-ninh', 'Tây Ninh', 29), ('thai-nguyen', 'Thái Nguyên', 30),
    ('thanh-hoa', 'Thanh Hóa', 31), ('ho-chi-minh', 'Thành phố Hồ Chí Minh', 32),
    ('tuyen-quang', 'Tuyên Quang', 33), ('vinh-long', 'Vĩnh Long', 34)
) AS province(slug, name, sort_order)
CROSS JOIN (SELECT "id" FROM "categories" WHERE "slug" = 'location') AS root
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name", "kind" = EXCLUDED."kind", "parent_id" = EXCLUDED."parent_id", "is_active" = true, "sort_order" = EXCLUDED."sort_order";

INSERT INTO "categories" ("slug", "name", "kind", "parent_id", "is_active", "sort_order")
SELECT 'unknown-location', 'Chưa xác định', 'PROVINCE', root.id, false, 999
FROM (SELECT "id" FROM "categories" WHERE "slug" = 'location') AS root
ON CONFLICT ("slug") DO NOTHING;

UPDATE "orders"
SET "metadata" = "metadata" || jsonb_build_object(
  'province',
  jsonb_build_object(
    'id', (SELECT "id" FROM "categories" WHERE "slug" = 'unknown-location'),
    'slug', 'unknown-location',
    'name', 'Chưa xác định'
  )
)
WHERE NOT ("metadata" ? 'province');

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "province_category_id" uuid;
UPDATE "listings"
SET "province_category_id" = (SELECT "id" FROM "categories" WHERE "slug" = 'unknown-location')
WHERE "province_category_id" IS NULL;
ALTER TABLE "listings" ALTER COLUMN "province_category_id" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "listings"
    ADD CONSTRAINT "listings_province_category_id_categories_id_fk"
    FOREIGN KEY ("province_category_id") REFERENCES "categories"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "listings_province_ranking_idx"
  ON "listings" ("province_category_id", "status", "total_paid", "first_paid_at");

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "categories" FROM anon, authenticated;
