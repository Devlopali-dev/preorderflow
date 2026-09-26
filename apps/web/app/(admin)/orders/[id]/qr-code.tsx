"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PaymentQrCode({ link }: { link: string }) {
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

  return <img src={dataUrl} alt="QR code de paiement Revolut" width={200} height={200} />;
}
