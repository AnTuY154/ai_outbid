import { getLeaderboard, getPublicStats } from "@/lib/repository";
import { RealtimeBoard } from "@/components/realtime-board";
import { appConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cửa hàng kính mắt trên toàn quốc",
  description: "Khám phá các cửa hàng kính mắt, gọng kính và tròng kính trên toàn quốc. So sánh lựa chọn và truy cập trực tiếp website của từng nhà bán lẻ.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [leaderboard, stats] = await Promise.all([getLeaderboard(), getPublicStats()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "OptiRise",
            alternateName: "Opti Rise",
            url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            inLanguage: "vi-VN",
          }),
        }}
      />
      <RealtimeBoard
        initialLeaderboard={leaderboard}
        initialStats={stats}
        minimumBid={appConfig.minimumBid}
      />
    </>
  );
}
import type { Metadata } from "next";
