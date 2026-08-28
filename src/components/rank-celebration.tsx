"use client";

import { Trophy, X } from "lucide-react";
import Link from "next/link";
import type { ListingRanking } from "@/lib/types";

export function RankCelebration({
  ranking,
  eyebrow = "THANH TOÁN THÀNH CÔNG",
  onClose,
}: {
  ranking: ListingRanking | null;
  eyebrow?: string;
  onClose: () => void;
}) {
  return (
    <div className="rank-celebration-backdrop" role="presentation">
      <section className="rank-celebration" role="dialog" aria-modal="true" aria-labelledby="rank-celebration-title">
        <button type="button" className="rank-celebration-close" onClick={onClose} aria-label="Đóng thông báo"><X size={17} /></button>
        <span className="rank-celebration-icon"><Trophy size={28} /></span>
        <p className="rank-celebration-eyebrow">{eyebrow}</p>
        <h2 id="rank-celebration-title">Chúc mừng bạn đã thăng hạng!</h2>
        <p>{ranking ? <>Website của bạn hiện ở <strong>hạng #{ranking.globalRank} toàn quốc</strong>.</> : "Bảng xếp hạng đang cập nhật vị trí mới của bạn."}</p>
        {ranking?.provinces.length ? (
          <div className="rank-celebration-regions" aria-label="Thứ hạng theo tỉnh thành">
            {ranking.provinces.map((province) => <span key={province.id}>#{province.rank} {province.name}</span>)}
          </div>
        ) : null}
        <Link href="/#bang-xep-hang" className="rank-celebration-link" onClick={onClose}>Xem bảng xếp hạng</Link>
      </section>
    </div>
  );
}
