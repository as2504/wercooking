import { useEffect, useState } from 'react';
import { Skeleton } from './ui/States';

/** Renders a QR code image (qrcode is loaded lazily to keep the main bundle small). */
export function QR({ value, size = 180, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((m) => m.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#2B1D14', light: '#FFFFFF' } }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (!src) return <Skeleton className="rounded-lg" />;
  return <img src={src} width={size} height={size} alt={label} className="rounded-lg" />;
}
