"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Globe2, LoaderCircle, MapPin, Minus, Plus, Search, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { provinces } from "@/lib/vn-provinces";
import type { PublicOrder, SeoMetadata } from "@/lib/types";

function formatBidAmount(amount: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
}

type Prefill = { url: string; targetAmount: number; provinceSlug?: string; revision: number } | null;

export function JoinForm({
  minimumBid,
  suggestedBid,
  prefill,
}: {
  minimumBid: number;
  suggestedBid: number;
  prefill: Prefill;
}) {
  const router = useRouter();
  const initialTarget = Math.max(minimumBid, prefill?.targetAmount ?? suggestedBid);
  const [url, setUrl] = useState(prefill?.url ?? "");
  const [provinceSlug, setProvinceSlug] = useState(prefill?.provinceSlug ?? "");
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [amount, setAmount] = useState(initialTarget);
  const [amountInput, setAmountInput] = useState(() => formatBidAmount(initialTarget));
  const [metadata, setMetadata] = useState<SeoMetadata | null>(null);
  const [currentTotalPaid, setCurrentTotalPaid] = useState(0);
  const [loading, setLoading] = useState<"preview" | "order" | null>(null);
  const [error, setError] = useState("");
  const provincePickerRef = useRef<HTMLDivElement>(null);
  const provinceSearchRef = useRef<HTMLInputElement>(null);
  const selectedProvince = provinces.find((province) => province.slug === provinceSlug);
  const filteredProvinces = provinces.filter((province) => normalizeSearch(province.name).includes(normalizeSearch(provinceSearch)));

  useEffect(() => {
    if (!provincePickerOpen) return;
    provinceSearchRef.current?.focus();
  }, [provincePickerOpen]);

  useEffect(() => {
    function closePicker(event: PointerEvent) {
      if (!provincePickerRef.current?.contains(event.target as Node)) setProvincePickerOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProvincePickerOpen(false);
    }
    document.addEventListener("pointerdown", closePicker);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closePicker);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

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
      const data = (await response.json()) as { metadata?: SeoMetadata; currentTotalPaid?: number; error?: string };
      if (!response.ok || !data.metadata) throw new Error(data.error ?? "Không thể đọc website.");
      setMetadata(data.metadata);
      setCurrentTotalPaid(data.currentTotalPaid ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đọc website.");
    } finally {
      setLoading(null);
    }
  }

  function adjustAmount(delta: number) {
    setAmount((current) => {
      const nextAmount = Math.max(minimumBid, current + delta);
      setAmountInput(formatBidAmount(nextAmount));
      return nextAmount;
    });
  }

  function changeAmount(value: string) {
    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!digits) {
      setAmount(0);
      setAmountInput("");
      return;
    }
    const nextAmount = Math.min(Number(digits), 9_999_999_999);
    setAmount(nextAmount);
    setAmountInput(formatBidAmount(nextAmount));
  }

  const amountToPay = Math.max(0, amount - currentTotalPaid);

  async function createPayment() {
    if (!metadata || !provinceSlug) return;
    setError("");
    setLoading("order");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: metadata.canonicalUrl, amount, provinceSlug }),
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
        <h1>Chiếm vị trí <span>#1</span></h1>
        <div className="amount-stepper">
          <button type="button" onClick={() => adjustAmount(-10_000)} aria-label="Giảm 10.000 đồng">
            <Minus size={16} />
          </button>
          <label htmlFor="bid-amount" className="sr-only">Tổng ngân sách mục tiêu</label>
          <input
            id="bid-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={amountInput}
            onChange={(event) => changeAmount(event.target.value)}
            aria-describedby="bid-amount-help"
            style={{ width: `${Math.max(6, amountInput.length + 1)}ch` }}
          />
          <button type="button" onClick={() => adjustAmount(10_000)} aria-label="Tăng 10.000 đồng">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <p className="claim-explainer" id="bid-amount-help">
        Nhập tổng ngân sách bạn muốn đạt. Vị trí mới bắt đầu từ <strong>{formatMoney(minimumBid)}</strong>; trả thấp hơn vị trí #1 vẫn giúp bạn vào bảng ở hạng tương ứng.
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
                setCurrentTotalPaid(0);
              }}
              placeholder="URL website hoặc sản phẩm kính mắt"
              autoComplete="url"
              required
            />
          </div>
          <div className="province-picker" ref={provincePickerRef}>
            <button
              type="button"
              className="province-picker-trigger"
              aria-haspopup="listbox"
              aria-expanded={provincePickerOpen}
              aria-controls="province-options"
              aria-describedby="province-help"
              onClick={() => setProvincePickerOpen((open) => !open)}
            >
              <MapPin size={17} aria-hidden="true" />
              <span className={selectedProvince ? undefined : "province-placeholder"}>{selectedProvince?.name ?? "Chọn tỉnh/thành"}</span>
              <ChevronDown className={provincePickerOpen ? "province-chevron-open" : undefined} size={16} aria-hidden="true" />
            </button>
            {provincePickerOpen && (
              <div className="province-popover">
                <div className="province-search">
                  <Search size={15} aria-hidden="true" />
                  <label htmlFor="province-search" className="sr-only">Tìm tỉnh hoặc thành phố</label>
                  <input
                    id="province-search"
                    ref={provinceSearchRef}
                    value={provinceSearch}
                    onChange={(event) => setProvinceSearch(event.target.value)}
                    placeholder="Tìm tỉnh/thành..."
                    autoComplete="off"
                  />
                </div>
                <div className="province-options" id="province-options" role="listbox" aria-label="Tỉnh hoặc thành phố">
                  {filteredProvinces.length ? filteredProvinces.map((province) => (
                    <button
                      key={province.slug}
                      type="button"
                      role="option"
                      aria-selected={province.slug === provinceSlug}
                      className={province.slug === provinceSlug ? "province-option-selected" : undefined}
                      onClick={() => {
                        setProvinceSlug(province.slug);
                        setProvinceSearch("");
                        setProvincePickerOpen(false);
                      }}
                    >
                      <span>{province.name}</span>
                      {province.slug === provinceSlug && <Check size={15} aria-hidden="true" />}
                    </button>
                  )) : <p className="province-empty">Không tìm thấy tỉnh/thành phù hợp.</p>}
                </div>
              </div>
            )}
          </div>
          <button type="submit" className="outbid-button" disabled={loading !== null || !url.trim() || !provinceSlug}>
            {loading === "preview" ? <LoaderCircle className="spin" size={18} /> : "Đặt hạng"}
          </button>
        </form>
        <p className="returning-note" id="province-help">Chọn tỉnh/thành phố nơi cửa hàng hoạt động. Đã có trên bảng? Nhập lại đúng URL để cộng thêm ngân sách và tăng hạng.</p>

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
              disabled={loading !== null || amount < minimumBid || amountToPay <= 0 || !provinceSlug}
            >
              {loading === "order" ? <LoaderCircle className="spin" size={18} /> : <>Thanh toán thêm {formatMoney(amountToPay)} <ArrowRight size={17} /></>}
            </button>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="secure-note"><ShieldCheck size={14} /> Chuyển khoản an toàn qua SePay · tự động lên hạng sau khi xác nhận</div>
    </section>
  );
}
