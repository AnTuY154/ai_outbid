import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "72px", background: "#fdfcf9", color: "#20201e" }}>
      <div style={{ display: "flex", color: "#ee765f", fontSize: 34, fontWeight: 700 }}>OptiRise</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 74, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1.05 }}>Cửa hàng kính mắt<br />trên toàn quốc</div>
      <div style={{ display: "flex", marginTop: 26, color: "#77756f", fontSize: 30 }}>Khám phá · So sánh · Kết nối trực tiếp</div>
    </div>,
  );
}
