"use client";

import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { ListingRanking, PublicOrder } from "@/lib/types";
import { RankCelebration } from "./rank-celebration";

export function PaymentStatus({ initialOrder }: { initialOrder: PublicOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [ranking, setRanking] = useState<ListingRanking | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(initialOrder.status === "PAID");

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/orders/${order.code}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { order: PublicOrder; ranking: ListingRanking | null };
      setOrder(data.order);
      if (data.order.status === "PAID") {
        setRanking(data.ranking);
        setCelebrationOpen(true);
      }
    }, 3_000);
    return () => clearInterval(timer);
  }, [order.code, order.status]);

  useEffect(() => {
    if (order.status !== "PAID" || ranking !== null) return;
    void fetch(`/api/orders/${order.code}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ ranking: ListingRanking | null }> : null)
      .then((data) => setRanking(data?.ranking ?? null));
  }, [order.code, order.status, ranking]);

  const status = order.status === "PAID"
    ? <div className="payment-status paid"><CheckCircle2 size={18} /> Đã nhận thanh toán</div>
    : order.status !== "PENDING"
      ? <div className="payment-status"><Clock3 size={18} /> Đơn hàng {order.status.toLowerCase()}</div>
      : <div className="payment-status"><LoaderCircle className="spin" size={18} /> Đang chờ SePay xác nhận</div>;

  return <>
    {status}
    {celebrationOpen && <RankCelebration ranking={ranking} onClose={() => setCelebrationOpen(false)} />}
  </>;
}
