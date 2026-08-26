import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, clickRateLimits, listings, listingClickGuards, orders, payments, siteStats, visitors } from "@/db/schema";
import { appConfig } from "./config";
import { buildSepayQrUrl } from "./sepay";
import type { LeaderboardEntry, OrderMetadata, PublicOrder, PublicStats, SeoMetadata } from "./types";

type ListingWithProvince = {
  listing: typeof listings.$inferSelect;
  province: { id: string; slug: string; name: string };
};

function listingToPublic(
  row: ListingWithProvince,
  rank: number,
): LeaderboardEntry {
  return {
    id: row.listing.id,
    rank,
    slug: row.listing.slug,
    originalUrl: row.listing.originalUrl,
    canonicalUrl: row.listing.canonicalUrl,
    domain: row.listing.domain,
    title: row.listing.title,
    description: row.listing.description,
    imageUrl: row.listing.imageUrl,
    faviconUrl: row.listing.faviconUrl,
    totalPaid: row.listing.totalPaid,
    clickCount: row.listing.clickCount,
    firstPaidAt: row.listing.firstPaidAt.toISOString(),
    lastPaidAt: row.listing.lastPaidAt.toISOString(),
    province: row.province,
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
  const suffix = createHash("sha1").update(metadata.domain).digest("hex").slice(0, 7);
  return `${base || "kinh-mat"}-${suffix}`;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await getDb()
    .select({
      listing: listings,
      province: { id: categories.id, slug: categories.slug, name: categories.name },
    })
    .from(listings)
    .innerJoin(categories, eq(listings.provinceCategoryId, categories.id))
    .where(eq(listings.status, "ACTIVE"))
    .orderBy(desc(listings.totalPaid), asc(listings.firstPaidAt));
  return rows.map((row, index) => listingToPublic(row, index + 1));
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

export async function getListingTotalPaid(domain: string) {
  const [listing] = await getDb()
    .select({ totalPaid: listings.totalPaid })
    .from(listings)
    .where(eq(listings.domain, domain))
    .limit(1);
  return listing?.totalPaid ?? 0;
}

export async function getListingRank(domain: string) {
  const leaderboard = await getLeaderboard();
  return leaderboard.find((listing) => listing.domain === domain)?.rank ?? null;
}

// `targetTotal` is the desired total on the leaderboard. Returning listings
// only pay the difference from their current accumulated amount.
export async function createOrder(metadata: SeoMetadata, targetTotal: number, provinceSlug: string): Promise<PublicOrder> {
  const orderCode = `${appConfig.paymentPrefix}${randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + appConfig.orderExpiryMinutes * 60_000);
  const db = getDb();
  const currentTotal = await getListingTotalPaid(metadata.domain);
  const amountToPay = targetTotal - currentTotal;
  if (amountToPay <= 0) {
    throw new Error("Mức đặt hạng phải cao hơn tổng tiền hiện tại của website.");
  }
  const [province] = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(and(eq(categories.slug, provinceSlug), eq(categories.kind, "PROVINCE"), eq(categories.isActive, true)))
    .limit(1);
  if (!province) throw new Error("Tỉnh/thành phố không hợp lệ.");
  const orderMetadata: OrderMetadata = { ...metadata, province };
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
    await tx
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
        provinceCategoryId: metadata.province.id,
        totalPaid: input.amount,
        firstPaidAt: input.paidAt,
        lastPaidAt: input.paidAt,
      })
      .onConflictDoUpdate({
        target: listings.domain,
        set: {
          totalPaid: sql`${listings.totalPaid} + ${input.amount}`,
          lastPaidAt: input.paidAt,
          status: "ACTIVE",
          provinceCategoryId: metadata.province.id,
          updatedAt: new Date(),
        },
      });

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
  });
  return getPublicStats();
}
