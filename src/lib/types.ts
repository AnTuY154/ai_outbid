export type SeoMetadata = {
  originalUrl: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  description: string;
  imageUrl: string | null;
  faviconUrl: string | null;
};

export type LeaderboardEntry = SeoMetadata & {
  id: string;
  slug: string;
  rank: number;
  totalPaid: number;
  clickCount: number;
  firstPaidAt: string;
  lastPaidAt: string;
};

export type PublicStats = {
  totalVisitors: number;
  totalPageviews: number;
  totalOutboundClicks: number;
  totalRevenue: number;
};

export type PublicOrder = {
  code: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  amount: number;
  expiresAt: string;
  metadata: SeoMetadata;
  qrUrl: string | null;
  bankAccount: string | null;
  bankName: string | null;
  accountName: string | null;
};
