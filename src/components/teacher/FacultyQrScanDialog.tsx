import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

type ScanResult = {
  action: "START" | "END";
  message: string;
  statusLabel?: string;
  needsEarlyExitConfirm?: boolean;
  code?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector():
  | (new (opts?: { formats: string[] }) => BarcodeDetectorLike)
  | null {
  const w = window as unknown as {
    BarcodeDetector?: new (opts?: {
      formats: string[];
    }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

export function FacultyQrScanDialog({
  open,
  onOpenChange,
  sessionId,
  courseLabel,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  courseLabel: string;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [earlyConfirm, setEarlyConfirm] = useState<{
    token: string;
    message: string;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const submitToken = useCallback(
    async (token: string, confirmEarlyExit?: boolean) => {
      if (!token.trim() || !sessionId) return;
      setBusy(true);
      try {
        const res = await api<ScanResult>("/teacher/attendance/qr-scan", {
          method: "POST",
          body: JSON.stringify({
            token: token.trim(),
            sessionId,
            confirmEarlyExit: confirmEarlyExit || undefined,
          }),
        });
        toast.success(res.message || "Attendance recorded");
        setEarlyConfirm(null);
        onOpenChange(false);
        onSuccess();
      } catch (err) {
        if (err instanceof ApiError && err.code === "EARLY_EXIT_CONFIRMATION_REQUIRED") {
          setEarlyConfirm({
            token: token.trim(),
            message: err.message,
          });
          return;
        }
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Attendance service is temporarily unavailable. Please try again."
        );
      } finally {
        setBusy(false);
      }
    },
    [sessionId, onOpenChange, onSuccess]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setCameraError(
        "This browser cannot scan QR codes natively. Paste the QR payload below, or use Chrome/Edge on HTTPS/localhost."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      let locked = false;

      const tick = async () => {
        if (!videoRef.current || locked) {
          rafRef.current = requestAnimationFrame(() => void tick());
          return;
        }
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              locked = true;
              stopCamera();
              await submitToken(value);
              return;
            }
          }
        } catch {
          /* keep scanning */
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setCameraError(
        "Camera permission denied or unavailable. Ensure good lighting and allow camera access, or paste the QR payload."
      );
    }
  }, [stopCamera, submitToken]);

  useEffect(() => {
    if (open) {
      void startCamera();
    } else {
      stopCamera();
      setManualToken("");
      setEarlyConfirm(null);
    }
    return () => stopCamera();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <QrCode className="h-5 w-5 text-[#ea580c]" />
            Scan attendance QR
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{courseLabel}</p>

        <div className="overflow-hidden rounded-xl border border-[#E5EBF3] bg-black">
          <video
            ref={videoRef}
            className="aspect-[3/4] w-full object-cover"
            muted
            playsInline
          />
        </div>

        {scanning && (
          <p className="text-center text-xs font-semibold text-[#16a34a]">
            Point your camera at the department QR · good lighting helps
          </p>
        )}
        {cameraError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {cameraError}
          </p>
        )}

        <div className="space-y-1.5">
          <Label className="font-bold text-[#002147]">Or paste QR payload</Label>
          <Input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="DHAPTI-ATT:…"
            className="font-mono text-xs"
          />
        </div>

        {earlyConfirm && (
          <div className="rounded-lg border border-[#ea580c]/30 bg-orange-50 px-3 py-2 text-sm text-[#c2410c]">
            {earlyConfirm.message}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void startCamera()}
            disabled={busy}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Retry camera
          </Button>
          {earlyConfirm ? (
            <Button
              type="button"
              className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
              disabled={busy}
              onClick={() =>
                void submitToken(earlyConfirm.token, true)
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm early end
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-[#002147] text-white hover:bg-[#003366]"
              disabled={busy || !manualToken.trim()}
              onClick={() => void submitToken(manualToken)}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
