import { getLeaderboard, getPublicStats } from "@/lib/repository";
import { RealtimeBoard } from "@/components/realtime-board";
import { appConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leaderboard, stats] = await Promise.all([getLeaderboard(), getPublicStats()]);
  return (
    <RealtimeBoard
      initialLeaderboard={leaderboard}
      initialStats={stats}
      minimumBid={appConfig.minimumBid}
    />
  );
}
