import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { listings, orders, payments, siteStats, visitors } from "@/db/schema";
import { appConfig, isDatabaseConfigured } from "./config";
import { demoLeaderboard, demoStats } from "./demo-data";
import { buildSepayQrUrl } from "./sepay";
import type { LeaderboardEntry, PublicOrder, PublicStats, SeoMetadata } from "./types";

function listingToPublic(
  row: typeof listings.$inferSelect,
  rank: number,
): LeaderboardEntry {
  return {
    id: row.id,
    rank,
    slug: row.slug,
    originalUrl: row.originalUrl,
    canonicalUrl: row.canonicalUrl,
    domain: row.domain,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    faviconUrl: row.faviconUrl,
    totalPaid: row.totalPaid,
    clickCount: row.clickCount,
    firstPaidAt: row.firstPaidAt.toISOString(),
    lastPaidAt: row.lastPaidAt.toISOString(),
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
  if (!isDatabaseConfigured()) return demoLeaderboard;
  const rows = await getDb()
    .select()
    .from(listings)
    .where(eq(listings.status, "ACTIVE"))
    .orderBy(desc(listings.totalPaid), asc(listings.firstPaidAt));
  return rows.map((row, index) => listingToPublic(row, index + 1));
}

export async function getListing(slug: string) {
  if (!isDatabaseConfigured()) return demoLeaderboard.find((item) => item.slug === slug) ?? null;
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
  if (!isDatabaseConfigured()) return demoStats;
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

export async function createOrder(metadata: SeoMetadata, amount: number): Promise<PublicOrder> {
  if (!isDatabaseConfigured()) throw new Error("Chưa cấu hình PostgreSQL.");
  const orderCode = `${appConfig.paymentPrefix}${randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + appConfig.orderExpiryMinutes * 60_000);
  const [row] = await getDb()
    .insert(orders)
    .values({
      orderCode,
      canonicalUrl: metadata.canonicalUrl,
      expectedAmount: amount,
      metadata,
      expiresAt,
    })
    .returning();
  return orderToPublic(row);
}

export async function getOrder(code: string): Promise<PublicOrder | null> {
  if (!isDatabaseConfigured()) return null;
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
  if (!isDatabaseConfigured()) throw new Error("Chưa cấu hình PostgreSQL.");
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
        totalPaid: input.amount,
        firstPaidAt: input.paidAt,
        lastPaidAt: input.paidAt,
      })
      .onConflictDoUpdate({
        target: listings.canonicalUrl,
        set: {
          originalUrl: metadata.originalUrl,
          title: metadata.title,
          description: metadata.description,
          imageUrl: metadata.imageUrl,
          faviconUrl: metadata.faviconUrl,
          totalPaid: sql`${listings.totalPaid} + ${input.amount}`,
          lastPaidAt: input.paidAt,
          status: "ACTIVE",
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

export async function incrementListingClick(slug: string) {
  if (!isDatabaseConfigured()) {
    const demo = demoLeaderboard.find((item) => item.slug === slug);
    return demo?.canonicalUrl ?? null;
  }
  return getDb().transaction(async (tx) => {
    const [listing] = await tx
      .update(listings)
      .set({ clickCount: sql`${listings.clickCount} + 1`, updatedAt: new Date() })
      .where(and(eq(listings.slug, slug), eq(listings.status, "ACTIVE")))
      .returning({ url: listings.canonicalUrl });
    if (!listing) return null;
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

export async function recordVisit(input: {
  visitorId: string;
  referrer?: string;
  userAgentHash?: string;
}) {
  if (!isDatabaseConfigured()) return demoStats;
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
