"use client";

import { Download, LoaderCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  orderCode: string;
};

export function SaveQrImage({ orderCode }: Props) {
  const imageUrl = `/api/orders/${orderCode}/qr`;
  const filename = `qr-thanh-toan-${orderCode}.png`;
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void fetch(imageUrl, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể chuẩn bị ảnh QR.");
        const image = await response.blob();
        setFile(new File([image], filename, { type: image.type || "image/png" }));
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError("Không thể mở bảng chia sẻ. Bạn vẫn có thể tải ảnh QR.");
      })
      .finally(() => setPreparing(false));

    return () => controller.abort();
  }, [filename, imageUrl]);

  function downloadImage() {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function shareImage() {
    setError("");
    if (!file) {
      downloadImage();
      return;
    }

    const data = { files: [file], title: `QR thanh toán ${orderCode}` };
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      downloadImage();
      return;
    }

    try {
      await navigator.share(data);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("Không thể mở bảng chia sẻ. Bạn vẫn có thể tải ảnh QR.");
    }
  }

  return (
    <div className="qr-save-action">
      <button type="button" className="download-qr" onClick={shareImage} disabled={preparing}>
        {preparing ? <><LoaderCircle className="spin" size={16} /> Đang chuẩn bị QR</> : <><Share2 size={16} /> Lưu ảnh QR</>}
      </button>
      <small className="download-qr-hint">
        {preparing
          ? "Đang chuẩn bị ảnh để mở bảng chia sẻ."
          : "Trên iPhone/iPad, chọn “Lưu hình ảnh” trong bảng Chia sẻ."}
      </small>
      {error && <button type="button" className="qr-download-fallback" onClick={downloadImage}><Download size={14} /> Tải ảnh QR</button>}
    </div>
  );
}
