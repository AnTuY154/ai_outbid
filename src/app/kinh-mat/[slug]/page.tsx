import { notFound } from "next/navigation";
import { ArrowUpRight, MousePointerClick, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { cache } from "react";
import { formatMoney } from "@/lib/format";
import { getListing } from "@/lib/repository";

export const dynamic = "force-dynamic";

const getListingCached = cache(getListing);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingCached(slug);
  if (!listing) return { title: "Không tìm thấy nhà bán lẻ" };
  const description = listing.description || `Thông tin website ${listing.title}, nhà bán lẻ kính đang xuất hiện trên OptiRise.`;
  return {
    title: listing.title,
    description,
    alternates: { canonical: `/kinh-mat/${listing.slug}` },
    openGraph: {
      title: `${listing.title} | OptiRise`,
      description,
      ...(listing.imageUrl ? { images: [{ url: listing.imageUrl, alt: listing.title }] } : {}),
    },
  };
}

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListingCached(slug);
  if (!listing) notFound();

  return (
    <main className="detail-page shell">
      <article className="detail-card">
        <div className="detail-hero">
          <span className="eyebrow" style={{ color: "#c9f35b" }}>{listing.domain}</span>
          <h1>{listing.title}</h1>
          <p>{listing.description || "Website chưa cung cấp mô tả."}</p>
        </div>
        <div className="detail-stats">
          <div><Trophy size={20} /><small>THỨ HẠNG</small><strong>#{listing.rank}</strong></div>
          <div><small>TỔNG ĐÃ TRẢ</small><strong>{formatMoney(listing.totalPaid)}</strong></div>
          <div><MousePointerClick size={20} /><small>LƯỢT CLICK</small><strong>{listing.clickCount.toLocaleString("vi-VN")}</strong></div>
        </div>
        <div className="detail-actions">
          <a href={`/go/${listing.slug}`} className="primary-link" target="_blank" rel="sponsored noopener">
            Truy cập website <ArrowUpRight size={17} />
          </a>
        </div>
      </article>
    </main>
  );
}
