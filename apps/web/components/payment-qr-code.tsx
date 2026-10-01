"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PaymentQrCode({
  link,
  label = "QR code de paiement",
}: {
  link: string;
  label?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { width: 200, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (!dataUrl) return null;

  return <img src={dataUrl} alt={label} width={200} height={200} />;
}
