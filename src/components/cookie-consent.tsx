"use client";

import { useEffect, useState } from "react";
import { getCookieConsent, setCookieConsent, type CookieConsent } from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(getCookieConsent() === null), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function choose(consent: CookieConsent) {
    setCookieConsent(consent);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="cookie-banner" aria-label="Lựa chọn cookie">
      <p>
        OptiRise dùng cookie thiết yếu để chống spam và vận hành website. Với sự đồng ý của bạn,
        chúng tôi dùng thêm dữ liệu ẩn danh để đo lượt truy cập.
      </p>
      <div>
        <button type="button" className="cookie-reject" onClick={() => choose("rejected")}>Từ chối</button>
        <button type="button" className="cookie-accept" onClick={() => choose("accepted")}>Chấp nhận</button>
      </div>
    </aside>
  );
}
