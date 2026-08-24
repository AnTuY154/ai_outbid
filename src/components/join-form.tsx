"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, LoaderCircle, Minus, Plus, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PublicOrder, SeoMetadata } from "@/lib/types";

export function JoinForm({ minimumBid, suggestedBid }: { minimumBid: number; suggestedBid: number }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [amount, setAmount] = useState(Math.max(minimumBid, suggestedBid));
  const [metadata, setMetadata] = useState<SeoMetadata | null>(null);
  const [loading, setLoading] = useState<"preview" | "order" | null>(null);
  const [error, setError] = useState("");

  async function preview(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading("preview");
    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { metadata?: SeoMetadata; error?: string };
      if (!response.ok || !data.metadata) throw new Error(data.error ?? "Không thể đọc website.");
      setMetadata(data.metadata);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đọc website.");
    } finally {
      setLoading(null);
    }
  }

  function adjustAmount(delta: number) {
    setAmount((current) => Math.max(minimumBid, current + delta));
  }

  async function createPayment() {
    if (!metadata) return;
    setError("");
    setLoading("order");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: metadata.canonicalUrl, amount }),
      });
      const data = (await response.json()) as { order?: PublicOrder; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error ?? "Không thể tạo thanh toán.");
      router.push(`/thanh-toan/${data.order.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo thanh toán.");
      setLoading(null);
    }
  }

  return (
    <section className="bid-entry board-shell" id="tham-gia">
      <div className="claim-heading">
        <h1>Chiếm vị trí <span>#1</span> với</h1>
        <div className="amount-stepper">
          <button type="button" onClick={() => adjustAmount(-10_000)} aria-label="Giảm 10.000 đồng">
            <Minus size={16} />
          </button>
          <label htmlFor="bid-amount" className="sr-only">Số tiền đặt hạng</label>
          <span aria-hidden="true">₫</span>
          <input
            id="bid-amount"
            type="number"
            min={minimumBid}
            step={10_000}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
          <button type="button" onClick={() => adjustAmount(10_000)} aria-label="Tăng 10.000 đồng">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <p className="claim-explainer">
        Vị trí mới bắt đầu từ <strong>{formatMoney(minimumBid)}</strong>. Trả thấp hơn vị trí #1 vẫn giúp bạn vào bảng ở hạng tương ứng.
      </p>

      <div className="bid-form-wrap">
        <form onSubmit={preview} className="bid-form">
          <div className="bid-url-field">
            <Globe2 size={17} aria-hidden="true" />
            <label htmlFor="website-url" className="sr-only">URL website hoặc sản phẩm</label>
            <input
              id="website-url"
              type="text"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setMetadata(null);
              }}
              placeholder="URL website hoặc sản phẩm kính mắt"
              autoComplete="url"
              required
            />
          </div>
          <button type="submit" className="outbid-button" disabled={loading !== null || !url.trim()}>
            {loading === "preview" ? <LoaderCircle className="spin" size={18} /> : "Đặt hạng"}
          </button>
        </form>
        <p className="returning-note">Đã có trên bảng? Nhập lại đúng URL để cộng thêm ngân sách và tăng hạng.</p>

        {metadata && (
          <div className="seo-preview">
            <div className="preview-brand">
              {metadata.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={metadata.imageUrl} alt="" />
              ) : (
                <span>{metadata.title.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="preview-info">
              <span className="preview-kicker">SEO preview</span>
              <strong>{metadata.title}</strong>
              <p>{metadata.description || "Website chưa cung cấp meta description."}</p>
              <span className="preview-domain">{metadata.domain}</span>
            </div>
            <button
              type="button"
              className="payment-button"
              onClick={createPayment}
              disabled={loading !== null || amount < minimumBid}
            >
              {loading === "order" ? <LoaderCircle className="spin" size={18} /> : <>Thanh toán {formatMoney(amount)} <ArrowRight size={17} /></>}
            </button>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="secure-note"><ShieldCheck size={14} /> Chuyển khoản an toàn qua SePay · tự động lên hạng sau khi xác nhận</div>
    </section>
  );
}
