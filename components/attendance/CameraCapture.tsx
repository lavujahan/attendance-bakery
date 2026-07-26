"use client";

import { useEffect, useRef, useState } from "react";
import { FiUser } from "react-icons/fi";
import { SwitchCamera } from "lucide-react";

interface Props {
  /** Called once with the captured frame as a JPEG Blob. */
  onCapture: (blob: Blob) => void;
  onError?: (message: string) => void;
  /** Auto-capture after `autoCaptureDelayMs` (kiosk flow). Set false for a manual capture button (guided enrollment). */
  autoCapture?: boolean;
  autoCaptureDelayMs?: number;
  /** Overrides the caption shown before capture, e.g. "Shot 2 of 4 — look straight ahead". */
  caption?: string;
  /** Shows a front/rear camera toggle. Off by default -- kiosk face-verification must stay on the front camera. */
  allowCameraSwitch?: boolean;
}

export default function CameraCapture({
  onCapture,
  onError,
  autoCapture = true,
  autoCaptureDelayMs = 1800,
  caption,
  allowCameraSwitch = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const captureRef = useRef<() => void>(() => {});
  const capturedRef = useRef(false);
  const [captured, setCaptured] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  useEffect(() => {
    const capturePhoto = () => {
      const video = videoRef.current;
      if (!video || capturedRef.current) return;
      capturedRef.current = true;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
      setCaptured(true);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      canvas.toBlob(
        (blob) => {
          if (blob) onCapture(blob);
        },
        "image/jpeg",
        0.9
      );
    };

    captureRef.current = capturePhoto;

    // Guards against React Strict Mode's dev-only double-invoke of this effect: without
    // it, the discarded first invocation's getUserMedia/play() continuation still races
    // the real one on the same videoRef/streamRef, and whichever loses has its play()
    // promise rejected with AbortError, leaving cameraReady/cameraError inconsistent.
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (cancelled) return;

          setCameraReady(true);
          if (autoCapture) {
            timerRef.current = window.setTimeout(capturePhoto, autoCaptureDelayMs);
          }
        }
      } catch {
        if (cancelled) return;
        const message = "Camera access is required to capture your selfie.";
        setCameraError(message);
        onError?.(message);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  return (
    <div className="space-y-3 rounded-2xl bg-slate-950 p-3 sm:p-4">
      <div className="rounded-[24px] overflow-hidden border border-slate-800 bg-black">
        <div className="relative h-[62dvh] max-h-[520px] min-h-[300px] w-full sm:h-[420px]">
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="relative">
                <FiUser className="h-24 w-24 text-slate-300" />
                <span className="absolute -right-2 -top-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
              </div>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {allowCameraSwitch && cameraReady && !captured && !cameraError && (
            <button
              type="button"
              onClick={() => setFacingMode((mode) => (mode === "user" ? "environment" : "user"))}
              aria-label="Switch camera"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur active:scale-[0.95]"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-slate-950/90 to-transparent px-4 py-3 text-center text-sm text-white">
            {cameraError
              ? cameraError
              : captured
              ? "Photo captured. One moment..."
              : caption ?? "Preparing camera..."}
          </div>
        </div>
      </div>

      {!autoCapture && !captured && cameraReady && !cameraError && (
        <button
          type="button"
          onClick={() => captureRef.current()}
          className="w-full rounded-2xl bg-white py-4 text-base font-semibold text-slate-900 shadow-sm active:scale-[0.98]"
        >
          Capture
        </button>
      )}
    </div>
  );
}
