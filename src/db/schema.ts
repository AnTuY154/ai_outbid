import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  primaryKey,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { OrderMetadata } from "@/lib/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
    aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalUrl: text("canonical_url").notNull(),
    originalUrl: text("original_url").notNull(),
    slug: text("slug").notNull(),
    domain: text("domain").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    imageUrl: text("image_url"),
    faviconUrl: text("favicon_url"),
    totalPaid: bigint("total_paid", { mode: "number" }).default(0).notNull(),
    clickCount: bigint("click_count", { mode: "number" }).default(0).notNull(),
    firstPaidAt: timestamp("first_paid_at", { withTimezone: true }).notNull(),
    lastPaidAt: timestamp("last_paid_at", { withTimezone: true }).notNull(),
    status: text("status").default("ACTIVE").notNull(),
    provinceCategoryId: uuid("province_category_id")
      .notNull()
      .references(() => categories.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("listings_canonical_url_unique").on(table.canonicalUrl),
    uniqueIndex("listings_domain_unique").on(table.domain),
    uniqueIndex("listings_slug_unique").on(table.slug),
    index("listings_ranking_idx").on(table.status, table.totalPaid, table.firstPaidAt),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderCode: text("order_code").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    expectedAmount: bigint("expected_amount", { mode: "number" }).notNull(),
    status: text("status").default("PENDING").notNull(),
    metadata: jsonb("metadata").$type<OrderMetadata>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_order_code_unique").on(table.orderCode),
    index("orders_status_idx").on(table.status),
    index("orders_canonical_url_idx").on(table.canonicalUrl),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    sepayTransactionId: text("sepay_transaction_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    bankAccount: text("bank_account").notNull(),
    transactionContent: text("transaction_content").default("").notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payments_sepay_transaction_id_unique").on(table.sepayTransactionId),
    index("payments_order_id_idx").on(table.orderId),
  ],
);

export const visitors = pgTable(
  "visitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitorId: uuid("visitor_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    firstReferrer: text("first_referrer"),
    userAgentHash: text("user_agent_hash"),
  },
  (table) => [uniqueIndex("visitors_visitor_id_unique").on(table.visitorId)],
);

export const siteStats = pgTable("site_stats", {
  id: smallint("id").primaryKey(),
  totalVisitors: bigint("total_visitors", { mode: "number" }).default(0).notNull(),
  totalPageviews: bigint("total_pageviews", { mode: "number" }).default(0).notNull(),
  totalOutboundClicks: bigint("total_outbound_clicks", { mode: "number" }).default(0).notNull(),
  totalRevenue: bigint("total_revenue", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dailyStats = pgTable("daily_stats", {
  day: date("day").primaryKey(),
  uniqueVisitors: bigint("unique_visitors", { mode: "number" }).default(0).notNull(),
  pageviews: bigint("pageviews", { mode: "number" }).default(0).notNull(),
  outboundClicks: bigint("outbound_clicks", { mode: "number" }).default(0).notNull(),
  paidOrders: integer("paid_orders").default(0).notNull(),
  revenue: bigint("revenue", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per visitor/listing pair lets the database enforce the click cooldown
// atomically, including when the app is deployed to more than one instance.
export const listingClickGuards = pgTable(
  "listing_click_guards",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    visitorHash: text("visitor_hash").notNull(),
    lastCountedAt: timestamp("last_counted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.listingId, table.visitorHash] })],
);

// The IP address is hashed before it reaches this table. A single row is
// reused for each client, keeping rate limiting shared across app instances.
export const clickRateLimits = pgTable("click_rate_limits", {
  clientHash: text("client_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  requestCount: integer("request_count").default(0).notNull(),
});

export type ListingRow = typeof listings.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
