import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';

interface Detector {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

/**
 * Camera QR scanner. Uses the native BarcodeDetector where supported (Chrome / Android),
 * otherwise decodes frames with jsQR (iOS Safari). Calls onResult once.
 */
export function QRScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not available in this browser.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const native = BD ? new BD({ formats: ['qr_code'] }) : null;
        const jsQR = native ? null : (await import('jsqr')).default;
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2) {
            let text: string | null = null;
            if (native) {
              const codes = await native.detect(v).catch(() => []);
              text = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              ctx.drawImage(v, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(img.data, img.width, img.height)?.data ?? null;
            }
            if (text) {
              stopped = true;
              onResult(text);
              return;
            }
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch (e) {
        const msg = (e as Error).name === 'NotAllowedError' ? 'Camera permission was denied. Enter the code instead.' : (e as Error).message;
        setError(msg);
      }
    };
    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline aria-label="Camera preview" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/80" aria-hidden="true" />
        </div>
      )}
      <Button variant="secondary" size="lg" onClick={onClose}>
        Close camera
      </Button>
    </div>
  );
}
