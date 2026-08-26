"use client";

import { CheckCircle2, Clock3, LoaderCircle, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicOrder } from "@/lib/types";

export function PaymentStatus({ initialOrder }: { initialOrder: PublicOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [rank, setRank] = useState<number | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(initialOrder.status === "PAID");

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/orders/${order.code}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { order: PublicOrder; rank: number | null };
      setOrder(data.order);
      if (data.order.status === "PAID") {
        setRank(data.rank);
        setCelebrationOpen(true);
      }
    }, 3_000);
    return () => clearInterval(timer);
  }, [order.code, order.status]);

  useEffect(() => {
    if (order.status !== "PAID" || rank !== null) return;
    void fetch(`/api/orders/${order.code}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ rank: number | null }> : null)
      .then((data) => setRank(data?.rank ?? null));
  }, [order.code, order.status, rank]);

  const status = order.status === "PAID"
    ? <div className="payment-status paid"><CheckCircle2 size={18} /> Đã nhận thanh toán</div>
    : order.status !== "PENDING"
      ? <div className="payment-status"><Clock3 size={18} /> Đơn hàng {order.status.toLowerCase()}</div>
      : <div className="payment-status"><LoaderCircle className="spin" size={18} /> Đang chờ SePay xác nhận</div>;

  return <>
    {status}
    {celebrationOpen && (
      <div className="rank-celebration-backdrop" role="presentation">
        <section className="rank-celebration" role="dialog" aria-modal="true" aria-labelledby="rank-celebration-title">
          <button type="button" className="rank-celebration-close" onClick={() => setCelebrationOpen(false)} aria-label="Đóng thông báo"><X size={17} /></button>
          <span className="rank-celebration-icon"><Trophy size={28} /></span>
          <p className="rank-celebration-eyebrow">THANH TOÁN THÀNH CÔNG</p>
          <h2 id="rank-celebration-title">Chúc mừng bạn đã thăng hạng!</h2>
          <p>{rank ? <>Website của bạn hiện ở <strong>hạng #{rank}</strong> trên bảng xếp hạng.</> : "Bảng xếp hạng đang cập nhật vị trí mới của bạn."}</p>
          <a href="/#bang-xep-hang" className="rank-celebration-link">Xem bảng xếp hạng</a>
        </section>
      </div>
    )}
  </>;
}
