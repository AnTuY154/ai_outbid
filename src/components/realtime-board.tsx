"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { CircleDot, Glasses, MousePointerClick, Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { LeaderboardEntry, PublicStats } from "@/lib/types";
import { JoinForm } from "./join-form";

type Props = {
  initialLeaderboard: LeaderboardEntry[];
  initialStats: PublicStats;
  minimumBid: number;
};

function getVisitorId() {
  const key = "kinh_mat_visitor_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  document.cookie = `${key}=${id}; Max-Age=31536000; Path=/; SameSite=Lax`;
  return id;
}

export function RealtimeBoard({ initialLeaderboard, initialStats, minimumBid }: Props) {
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [stats, setStats] = useState(initialStats);
  const [online, setOnline] = useState(1);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openListing = (slug: string) => window.open(`/go/${slug}`, "_blank", "noopener");

  const refreshPublicData = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      const [boardResponse, statsResponse] = await Promise.all([
        fetch("/api/leaderboard", { cache: "no-store" }),
        fetch("/api/stats", { cache: "no-store" }),
      ]);
      if (boardResponse.ok) {
        const data = (await boardResponse.json()) as { leaderboard: LeaderboardEntry[] };
        setLeaderboard(data.leaderboard);
      }
      if (statsResponse.ok) {
        const data = (await statsResponse.json()) as { stats: PublicStats };
        setStats(data.stats);
      }
    }, 350);
  }, []);

  useEffect(() => {
    const visitorId = getVisitorId();
    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId, referrer: document.referrer || undefined }),
    }).then(() => refreshPublicData());

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    const supabase = createClient(url, anonKey);
    const dataChannel = supabase
      .channel("public-live-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, refreshPublicData)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_stats" }, refreshPublicData)
      .subscribe();

    const presenceChannel: RealtimeChannel = supabase.channel("site-presence", {
      config: { presence: { key: visitorId } },
    });
    const syncPresence = () => setOnline(Object.keys(presenceChannel.presenceState()).length);
    presenceChannel
      .on("presence", { event: "sync" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void presenceChannel.track({ online_at: new Date().toISOString() });
      } else {
        void presenceChannel.untrack();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void presenceChannel.untrack();
      void supabase.removeChannel(presenceChannel);
      void supabase.removeChannel(dataChannel);
    };
  }, [refreshPublicData]);

  return (
    <main>
      <section className="board-intro board-shell">
        <div className="intro-title"><Glasses size={30} /><h2>Kính Mắt</h2></div>
        <a className="live-stats" href="#bang-xep-hang" aria-label="Thống kê trực tiếp">
          <span><Radio size={13} className="pulse-dot" /><strong>{online.toLocaleString("vi-VN")}</strong> online</span>
          <span>·</span>
          <span><strong>{stats.totalVisitors.toLocaleString("vi-VN")}</strong> lượt truy cập</span>
          <span>· xem bảng ↓</span>
        </a>
      </section>

      <JoinForm
        minimumBid={minimumBid}
        suggestedBid={Math.max(minimumBid, (leaderboard[0]?.totalPaid ?? 0) + 10_000)}
      />

      <section className="ranking-section board-shell" id="bang-xep-hang">
        <div className="category-bar" aria-label="Danh mục xếp hạng">
          <span className="category-chip active"><Glasses size={14} /> Kính Mắt</span>
          <span className="category-note"><CircleDot size={12} /> Một danh mục duy nhất · cập nhật realtime</span>
        </div>

        <div className="ranking-list">
          {leaderboard.map((item, index) => (
            <div className="ranking-fragment" key={item.id}>
            <article
              className={`ranking-card rank-${item.rank}`}
              role="link"
              tabIndex={0}
              aria-label={`Mở trang web ${item.title}`}
              onClick={() => openListing(item.slug)}
              onKeyDown={(event) => {
                if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  openListing(item.slug);
                }
              }}
            >
              <div className="rank-number">#{item.rank}</div>
              <div className="listing-logo">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" />
                ) : item.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.faviconUrl} alt="" />
                ) : (
                  <span>{item.title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="listing-main">
                <div className="listing-title-row">
                  <h3>{item.title}</h3>
                  <strong className="listing-price">{formatMoney(item.totalPaid)}</strong>
                </div>
                <p>{item.description || "Chưa có mô tả."}</p>
                <div className="listing-meta">
                  <span>{item.domain}</span>
                  <span>Kính Mắt</span>
                  <span><MousePointerClick size={14} /> {item.clickCount.toLocaleString("vi-VN")} click</span>
                </div>
              </div>
              <div className="listing-bid">
                <a className="claim-rank" href="#tham-gia" onClick={(event) => event.stopPropagation()}>
                  Vượt hạng với {formatMoney(item.totalPaid + 10_000)}
                </a>
              </div>
            </article>
            {index === 2 && (
              <aside className="activity-strip" aria-label="Hoạt động mới nhất">
                <h2><span /> Hoạt động mới nhất</h2>
                <div>
                  {leaderboard.slice(0, 3).map((activity) => (
                    <a href={`/go/${activity.slug}`} target="_blank" rel="sponsored noopener" key={activity.id}>
                      <b>{activity.title}</b>
                      <span>đang ở #{activity.rank} · {formatMoney(activity.totalPaid)}</span>
                    </a>
                  ))}
                </div>
              </aside>
            )}
            </div>
          ))}
        </div>
      </section>

      <section className="revenue-section board-shell">
        <p>Dự án Kính Mắt này đã ghi nhận</p>
        <strong><span>₫</span>{stats.totalRevenue.toLocaleString("vi-VN")}</strong>
        <small>tổng ngân sách xếp hạng · công khai và cập nhật realtime</small>
        <div className="mini-steps">
          <div><b>01</b><span>Dán URL</span><p>Đọc tự động metadata SEO.</p></div>
          <div><b>02</b><span>Thanh toán</span><p>Quét QR chuyển khoản SePay.</p></div>
          <div><b>03</b><span>Lên hạng</span><p>Webhook cập nhật tức thì.</p></div>
        </div>
      </section>
    </main>
  );
}
