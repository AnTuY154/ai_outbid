"use client";

import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicOrder } from "@/lib/types";

export function PaymentStatus({ initialOrder }: { initialOrder: PublicOrder }) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/orders/${order.code}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { order: PublicOrder };
      setOrder(data.order);
      if (data.order.status === "PAID") {
        router.push(`/thanh-cong/${order.code}`);
      }
    }, 3_000);
    return () => clearInterval(timer);
  }, [order.code, order.status, router]);

  if (order.status === "PAID") {
    return <div className="payment-status paid"><CheckCircle2 size={18} /> Đã nhận thanh toán</div>;
  }
  if (order.status !== "PENDING") {
    return <div className="payment-status"><Clock3 size={18} /> Đơn hàng {order.status.toLowerCase()}</div>;
  }
  return <div className="payment-status"><LoaderCircle className="spin" size={18} /> Đang chờ SePay xác nhận</div>;
}
