import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, clickRateLimits, listingProvinces, listings, listingClickGuards, orders, payments, siteStats, visitors } from "@/db/schema";
import { appConfig } from "./config";
import { buildSepayQrUrl } from "./sepay";
import type { LeaderboardEntry, ListingRanking, OrderMetadata, ProvinceRanking, PublicOrder, PublicStats, SeoMetadata } from "./types";

function listingToPublic(
  listing: typeof listings.$inferSelect,
  globalRank: number,
  provinces: ProvinceRanking[],
): LeaderboardEntry {
  return {
    id: listing.id,
    globalRank,
    provinces,
    slug: listing.slug,
    originalUrl: listing.originalUrl,
    canonicalUrl: listing.canonicalUrl,
    domain: listing.domain,
    title: listing.title,
    description: listing.description,
    imageUrl: listing.imageUrl,
    faviconUrl: listing.faviconUrl,
    totalPaid: listing.totalPaid,
    clickCount: listing.clickCount,
    firstPaidAt: listing.firstPaidAt.toISOString(),
    lastPaidAt: listing.lastPaidAt.toISOString(),
  };
}

function orderToPublic(row: typeof orders.$inferSelect): PublicOrder {
  return {
    code: row.orderCode,
    status: row.status as PublicOrder["status"],
    amount: row.expectedAmount,
    expiresAt: row.expiresAt.toISOString(),
    metadata: row.metadata,
    qrUrl: buildSepayQrUrl(row.orderCode, row.expectedAmount),
    bankAccount: appConfig.bankAccount || null,
    bankName: appConfig.bankName || null,
    accountName: appConfig.accountName || null,
  };
}

function slugFor(metadata: SeoMetadata) {
  const base = metadata.domain
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const suffix = createHash("sha1").update(metadata.canonicalUrl).digest("hex").slice(0, 7);
  return `${base || "kinh-mat"}-${suffix}`;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await getDb()
    .select({
      listing: listings,
      province: { id: categories.id, slug: categories.slug, name: categories.name },
    })
    .from(listings)
    .innerJoin(listingProvinces, eq(listingProvinces.listingId, listings.id))
    .innerJoin(categories, eq(listingProvinces.provinceCategoryId, categories.id))
    .where(eq(listings.status, "ACTIVE"))
    .orderBy(desc(listings.totalPaid), asc(listings.createdAt), asc(listings.id), asc(categories.sortOrder));

  const provinceRanks = new Map<string, number>();
  const grouped = new Map<string, { listing: typeof listings.$inferSelect; provinces: ProvinceRanking[] }>();

  for (const row of rows) {
    const rank = (provinceRanks.get(row.province.id) ?? 0) + 1;
    provinceRanks.set(row.province.id, rank);
    const current = grouped.get(row.listing.id);
    const province = { ...row.province, rank };
    if (current) {
      current.provinces.push(province);
    } else {
      grouped.set(row.listing.id, { listing: row.listing, provinces: [province] });
    }
  }

  return Array.from(grouped.values()).map(({ listing, provinces }, index) =>
    listingToPublic(listing, index + 1, provinces),
  );
}

export async function getListing(slug: string) {
  const [row] = await getDb()
    .select()
    .from(listings)
    .where(and(eq(listings.slug, slug), eq(listings.status, "ACTIVE")))
    .limit(1);
  if (!row) return null;
  const leaderboard = await getLeaderboard();
  return leaderboard.find((item) => item.id === row.id) ?? null;
}

export async function getPublicStats(): Promise<PublicStats> {
  const [row] = await getDb().select().from(siteStats).where(eq(siteStats.id, 1)).limit(1);
  return row
    ? {
        totalVisitors: row.totalVisitors,
        totalPageviews: row.totalPageviews,
        totalOutboundClicks: row.totalOutboundClicks,
        totalRevenue: row.totalRevenue,
      }
    : { totalVisitors: 0, totalPageviews: 0, totalOutboundClicks: 0, totalRevenue: 0 };
}

export async function getListingTotalPaid(canonicalUrl: string) {
  const [listing] = await getDb()
    .select({ totalPaid: listings.totalPaid })
    .from(listings)
    .where(eq(listings.canonicalUrl, canonicalUrl))
    .limit(1);
  return listing?.totalPaid ?? 0;
}

export async function getListingRanking(canonicalUrl: string): Promise<ListingRanking | null> {
  const leaderboard = await getLeaderboard();
  const listing = leaderboard.find((item) => item.canonicalUrl === canonicalUrl);
  return listing ? { globalRank: listing.globalRank, provinces: listing.provinces } : null;
}

// `targetTotal` is the desired total on the leaderboard. Returning listings
// only pay the difference from their current accumulated amount.
export async function createOrder(metadata: SeoMetadata, targetTotal: number, provinceSlugs: string[]): Promise<PublicOrder> {
  const orderCode = `${appConfig.paymentPrefix}${randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + appConfig.orderExpiryMinutes * 60_000);
  const db = getDb();
  const currentTotal = await getListingTotalPaid(metadata.canonicalUrl);
  const amountToPay = targetTotal - currentTotal;
  if (amountToPay < 0) {
    throw new Error("Mức đặt hạng phải cao hơn tổng tiền hiện tại của website.");
  }
  const uniqueProvinceSlugs = [...new Set(provinceSlugs)];
  const provinceRows = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(and(inArray(categories.slug, uniqueProvinceSlugs), eq(categories.kind, "PROVINCE"), eq(categories.isActive, true)));
  if (provinceRows.length !== uniqueProvinceSlugs.length) throw new Error("Có tỉnh/thành phố không hợp lệ hoặc không còn hoạt động.");
  const provincesBySlug = new Map(provinceRows.map((province) => [province.slug, province]));
  const orderMetadata: OrderMetadata = {
    ...metadata,
    provinces: uniqueProvinceSlugs.map((slug) => provincesBySlug.get(slug)!),
  };

  // A zero-price listing is confirmed immediately. Keeping the order and the
  // listing update in one transaction prevents an order from being marked paid
  // without actually appearing on the leaderboard.
  if (targetTotal === 0) {
    const activatedAt = new Date();
    return db.transaction(async (tx) => {
      const [row] = await tx.insert(orders).values({
        orderCode,
        canonicalUrl: metadata.canonicalUrl,
        expectedAmount: 0,
        status: "PAID",
        metadata: orderMetadata,
        expiresAt,
        paidAt: activatedAt,
      }).returning();

      const [listing] = await tx
        .insert(listings)
        .values({
          canonicalUrl: metadata.canonicalUrl,
          originalUrl: metadata.originalUrl,
          slug: slugFor(metadata),
          domain: metadata.domain,
          title: metadata.title,
          description: metadata.description,
          imageUrl: metadata.imageUrl,
          faviconUrl: metadata.faviconUrl,
          provinceCategoryId: orderMetadata.provinces[0].id,
          totalPaid: 0,
          firstPaidAt: activatedAt,
          lastPaidAt: activatedAt,
        })
        .onConflictDoUpdate({
          target: listings.canonicalUrl,
          set: { status: "ACTIVE", updatedAt: activatedAt },
        })
        .returning({ id: listings.id });

      await tx
        .insert(listingProvinces)
        .values(orderMetadata.provinces.map((province) => ({
          listingId: listing.id,
          provinceCategoryId: province.id,
        })))
        .onConflictDoNothing();

      return orderToPublic(row);
    });
  }

  if (amountToPay === 0) {
    throw new Error("Mức đặt hạng phải cao hơn tổng tiền hiện tại của website.");
  }

  const [row] = await db.insert(orders).values({
    orderCode,
    canonicalUrl: metadata.canonicalUrl,
    expectedAmount: amountToPay,
    metadata: orderMetadata,
    expiresAt,
  }).returning();
  return orderToPublic(row);
}

export async function getOrder(code: string): Promise<PublicOrder | null> {
  const db = getDb();
  const [row] = await db.select().from(orders).where(eq(orders.orderCode, code)).limit(1);
  if (!row) return null;
  if (row.status === "PENDING" && row.expiresAt.getTime() < Date.now()) {
    const [expired] = await db
      .update(orders)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(orders.id, row.id), eq(orders.status, "PENDING")))
      .returning();
    return orderToPublic(expired ?? { ...row, status: "EXPIRED" });
  }
  return orderToPublic(row);
}

type ProcessPaymentInput = {
  orderCode: string;
  transactionId: string;
  amount: number;
  bankAccount: string;
  content: string;
  paidAt: Date;
  payload: Record<string, unknown>;
};

export async function processPayment(input: ProcessPaymentInput) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.orderCode, input.orderCode))
      .for("update")
      .limit(1);
    if (!order) return { status: "ignored" as const, reason: "order_not_found" };

    const [existing] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.sepayTransactionId, input.transactionId))
      .limit(1);
    if (existing) return { status: "duplicate" as const };
    if (order.status !== "PENDING") return { status: "ignored" as const, reason: "order_not_pending" };
    if (order.expiresAt.getTime() < Date.now()) return { status: "ignored" as const, reason: "order_expired" };
    if (input.amount < order.expectedAmount) return { status: "ignored" as const, reason: "insufficient_amount" };

    await tx.insert(payments).values({
      orderId: order.id,
      sepayTransactionId: input.transactionId,
      amount: input.amount,
      bankAccount: input.bankAccount,
      transactionContent: input.content,
      rawPayload: input.payload,
      paidAt: input.paidAt,
    });
    await tx
      .update(orders)
      .set({ status: "PAID", paidAt: input.paidAt, updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    const metadata = order.metadata;
    const [listing] = await tx
      .insert(listings)
      .values({
        canonicalUrl: metadata.canonicalUrl,
        originalUrl: metadata.originalUrl,
        slug: slugFor(metadata),
        domain: metadata.domain,
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        faviconUrl: metadata.faviconUrl,
        // Retained for backward compatibility; locations are stored in listing_provinces.
        provinceCategoryId: metadata.provinces[0].id,
        totalPaid: input.amount,
        firstPaidAt: input.paidAt,
        lastPaidAt: input.paidAt,
      })
      .onConflictDoUpdate({
        target: listings.canonicalUrl,
        set: {
          totalPaid: sql`${listings.totalPaid} + ${input.amount}`,
          lastPaidAt: input.paidAt,
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      })
      .returning({ id: listings.id });

    await tx
      .insert(listingProvinces)
      .values(metadata.provinces.map((province) => ({
        listingId: listing.id,
        provinceCategoryId: province.id,
      })))
      .onConflictDoNothing();

    await tx
      .insert(siteStats)
      .values({ id: 1, totalRevenue: input.amount })
      .onConflictDoUpdate({
        target: siteStats.id,
        set: {
          totalRevenue: sql`${siteStats.totalRevenue} + ${input.amount}`,
          updatedAt: new Date(),
        },
      });

    return { status: "processed" as const };
  });
}

export async function registerListingClick(slug: string, visitorHash: string) {
  return getDb().transaction(async (tx) => {
    const [listing] = await tx
      .select({ id: listings.id, url: listings.canonicalUrl })
      .from(listings)
      .where(and(eq(listings.slug, slug), eq(listings.status, "ACTIVE")));
    if (!listing) return null;

    const cooldown = await tx
      .insert(listingClickGuards)
      .values({ listingId: listing.id, visitorHash })
      .onConflictDoUpdate({
        target: [listingClickGuards.listingId, listingClickGuards.visitorHash],
        set: { lastCountedAt: sql`now()` },
        where: sql`${listingClickGuards.lastCountedAt} <= now() - interval '10 seconds'`,
      })
      .returning({ listingId: listingClickGuards.listingId });

    if (cooldown.length === 0) return listing.url;

    await tx
      .update(listings)
      .set({ clickCount: sql`${listings.clickCount} + 1`, updatedAt: new Date() })
      .where(eq(listings.id, listing.id));
    await tx
      .insert(siteStats)
      .values({ id: 1, totalOutboundClicks: 1 })
      .onConflictDoUpdate({
        target: siteStats.id,
        set: {
          totalOutboundClicks: sql`${siteStats.totalOutboundClicks} + 1`,
          updatedAt: new Date(),
        },
      });
    return listing.url;
  });
}

export async function consumeClickRateLimit(clientHash: string, limit = 30) {
  const result = await getDb().execute<{ clientHash: string }>(sql`
    INSERT INTO ${clickRateLimits} ("client_hash", "window_started_at", "request_count")
    VALUES (${clientHash}, now(), 1)
    ON CONFLICT ("client_hash") DO UPDATE
    SET
      window_started_at = CASE
        WHEN ${clickRateLimits.windowStartedAt} <= now() - interval '1 minute' THEN now()
        ELSE ${clickRateLimits.windowStartedAt}
      END,
      request_count = CASE
        WHEN ${clickRateLimits.windowStartedAt} <= now() - interval '1 minute' THEN 1
        ELSE ${clickRateLimits.requestCount} + 1
      END
    WHERE ${clickRateLimits.windowStartedAt} <= now() - interval '1 minute'
       OR ${clickRateLimits.requestCount} < ${limit}
    RETURNING "client_hash"
  `);
  return result.length > 0;
}

export async function recordVisit(input: {
  visitorId: string;
  referrer?: string;
  userAgentHash?: string;
}) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(visitors)
      .values({
        visitorId: input.visitorId,
        firstReferrer: input.referrer?.slice(0, 500),
        userAgentHash: input.userAgentHash,
      })
      .onConflictDoNothing({ target: visitors.visitorId })
      .returning({ id: visitors.id });

    if (!inserted.length) {
      await tx
        .update(visitors)
        .set({ lastSeenAt: new Date() })
        .where(eq(visitors.visitorId, input.visitorId));
    }

    await tx
      .insert(siteStats)
      .values({ id: 1, totalVisitors: inserted.length, totalPageviews: 1 })
      .onConflictDoUpdate({
        target: siteStats.id,
        set: {
          totalVisitors: sql`${siteStats.totalVisitors} + ${inserted.length}`,
          totalPageviews: sql`${siteStats.totalPageviews} + 1`,
          updatedAt: new Date(),
        },
      });

    // Store reporting dates in Vietnam's local time, independent of the DB server timezone.
    await tx.execute(sql`
      WITH daily_visitor AS (
        INSERT INTO visitor_daily_visits (day, visitor_id)
        VALUES ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, ${input.visitorId}::uuid)
        ON CONFLICT (day, visitor_id) DO NOTHING
        RETURNING visitor_id
      )
      INSERT INTO daily_stats (day, unique_visitors, pageviews, updated_at)
      VALUES (
        (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
        (SELECT count(*) FROM daily_visitor),
        1,
        now()
      )
      ON CONFLICT (day) DO UPDATE
      SET
        unique_visitors = daily_stats.unique_visitors + EXCLUDED.unique_visitors,
        pageviews = daily_stats.pageviews + EXCLUDED.pageviews,
        updated_at = EXCLUDED.updated_at
    `);
  });
  return getPublicStats();
}
