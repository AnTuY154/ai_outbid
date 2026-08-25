import type { MetadataRoute } from "next";
import { getLeaderboard } from "@/lib/repository";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/ly-tuong`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/quy-dinh`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/dieu-khoan`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach-bao-mat`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];
  const listings = await getLeaderboard();
  return [
    ...staticPages,
    ...listings.map((listing) => ({
      url: `${baseUrl}/kinh-mat/${listing.slug}`,
      lastModified: listing.lastPaidAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(listing.imageUrl ? { images: [listing.imageUrl] } : {}),
    })),
  ];
}
