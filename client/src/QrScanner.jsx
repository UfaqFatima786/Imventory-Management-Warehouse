import { useEffect, useRef } from 'react';
import { Modal, useToast } from './ui';

export function normalizeQrValue(value) {
  const raw = String(value || '').trim();
  const tagged = raw.match(/^(?:SKU|BARCODE)\s*:\s*(.+)$/i);
  return (tagged ? tagged[1] : raw).trim();
}

export default function QrScanner({ onScan, onClose }) {
  const toast = useToast();
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    let scanner;
    let startPromise;
    let stopPromise;
    let disposed = false;

    function stopScanner() {
      if (stopPromise) return stopPromise;
      stopPromise = (async () => {
        if (!scanner) return;
        if (startPromise) await startPromise.catch(() => {});
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      })();
      return stopPromise;
    }

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (disposed) return;
        scanner = new Html5Qrcode('stockyard-qr-reader');
        startPromise = scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
          (decoded) => {
            if (disposed) return;
            disposed = true;
            onScanRef.current(normalizeQrValue(decoded));
            onCloseRef.current();
          },
          () => {},
        );
        await startPromise;
        if (disposed) await stopScanner();
      } catch (error) {
        if (!disposed) {
          toast(`Could not start the camera: ${error.message}`, 'error');
          onCloseRef.current();
        }
      }
    }

    startScanner();
    return () => {
      disposed = true;
      stopScanner().catch((error) => console.error('QR scanner cleanup failed:', error.message));
    };
  }, [toast]);

  return (
    <Modal title="Scan product QR code" onClose={onClose}>
      <p className="muted">Allow camera access and hold a product QR code inside the frame.</p>
      <div id="stockyard-qr-reader" className="qr-reader" />
      <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel scan</button></div>
    </Modal>
  );
}
