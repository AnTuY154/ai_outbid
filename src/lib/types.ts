export type SeoMetadata = {
  originalUrl: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  description: string;
  imageUrl: string | null;
  faviconUrl: string | null;
};

export type ProvinceCategory = {
  id: string;
  slug: string;
  name: string;
};

export type ProvinceRanking = ProvinceCategory & {
  rank: number;
};

export type ListingRanking = {
  globalRank: number;
  provinces: ProvinceRanking[];
};

export type OrderMetadata = SeoMetadata & {
  provinces: ProvinceCategory[];
};

export type LeaderboardEntry = SeoMetadata & ListingRanking & {
  id: string;
  slug: string;
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
  metadata: OrderMetadata;
  qrUrl: string | null;
  bankAccount: string | null;
  bankName: string | null;
  accountName: string | null;
};
