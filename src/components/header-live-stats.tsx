"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { getPresenceId } from "@/lib/presence";

export function HeaderLiveStats() {
  const [online, setOnline] = useState(0);
  const [visitors, setVisitors] = useState(0);

  useEffect(() => {
    let active = true;
    const refreshVisitors = async () => {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok || !active) return;
      const data = (await response.json()) as { stats?: { totalVisitors?: number } };
      setVisitors(data.stats?.totalVisitors ?? 0);
    };
    void refreshVisitors();
    const refreshInterval = window.setInterval(() => void refreshVisitors(), 60_000);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return () => {
        active = false;
        window.clearInterval(refreshInterval);
      };
    }

    const supabase = createClient(url, anonKey);
    const channel: RealtimeChannel = supabase.channel("site-presence", {
      config: { presence: { key: getPresenceId() } },
    });
    const syncPresence = () => setOnline(Object.keys(channel.presenceState()).length);
    channel
      .on("presence", { event: "sync" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="header-live-stats" aria-label="Thống kê trực tiếp">
      <span><Radio size={12} className="pulse-dot" /> <strong>{online.toLocaleString("vi-VN")}</strong> online</span>
      <span>·</span>
      <span><strong>{visitors.toLocaleString("vi-VN")}</strong> lượt truy cập</span>
    </div>
  );
}
