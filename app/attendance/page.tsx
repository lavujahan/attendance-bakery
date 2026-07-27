"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import CameraCapture from "@/components/attendance/CameraCapture";
import Keypad from "@/components/attendance/Keypad";
import { checkKioskGates, verifyFaceAndRecordAttendance } from "./actions";
import { calculateDistance } from "@/lib/attendanceMath";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";

type GpsState = { latitude: number; longitude: number; accuracy: number };
type StatusType = "info" | "success" | "warning" | "error";
type Stage = "idle" | "gate" | "location" | "capturing" | "uploading" | "complete" | "failed";

type ResultInfo = {
  action: "check_in" | "check_out";
  faceStatus: "verified" | "unverified" | "service_error" | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  responseSeconds: number;
};

const IDLE_MESSAGE = "Enter your Serial No to begin.";

export default function AttendancePortalPage() {
  const [attendanceId, setAttendanceId] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState | null>(null);
  const [captureAttempt, setCaptureAttempt] = useState(0);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [statusMessage, setStatusMessage] = useState(IDLE_MESSAGE);
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [processFinished, setProcessFinished] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/attendance" }).catch(() => {});
    }
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const statusColor = useMemo(() => {
    switch (statusType) {
      case "success":
        return "bg-emerald-50 text-emerald-700 border border-emerald-100";
      case "warning":
        return "bg-amber-50 text-amber-700 border border-amber-100";
      case "error":
        return "bg-rose-50 text-rose-700 border border-rose-100";
      default:
        return "bg-sky-50 text-slate-700 border border-sky-100";
    }
  }, [statusType]);

  const resetProcess = useCallback(() => {
    setProcessFinished(false);
    setEmployee(null);
    setSite(null);
    setPendingAction(null);
    setExistingRecordId(null);
    setGps(null);
    setCaptureAttempt(0);
    setResult(null);
    setAttendanceId("");
    setStatusMessage(IDLE_MESSAGE);
    setStatusType("info");
    setStage("idle");
  }, []);

  useEffect(() => {
    if (stage !== "complete") return;
    const timer = window.setTimeout(resetProcess, 3000);
    return () => window.clearTimeout(timer);
  }, [stage, resetProcess]);

  const runGateCheck = async (id: string) => {
    setStatusMessage("Checking your details...");
    setStatusType("info");
    setStage("gate");

    try {
      const gate = await checkKioskGates(id);

      if (gate.outcome === "invalid_id") {
        setStatusMessage("Invalid Serial No.");
        setStatusType("error");
        setStage("failed");
        return;
      }
      if (gate.outcome === "inactive") {
        setStatusMessage("This employee is inactive.");
        setStatusType("error");
        setStage("failed");
        return;
      }
      if (gate.outcome === "not_enrolled") {
        setStatusMessage("Face not enrolled — contact HR to complete face enrollment.");
        setStatusType("error");
        setStage("failed");
        return;
      }
      if (gate.outcome === "no_site_assignment") {
        setStatusMessage("No godown assigned. Contact HR.");
        setStatusType("error");
        setStage("failed");
        return;
      }
      if (gate.outcome === "already_completed") {
        setEmployee(gate.employee);
        setSite(gate.site);
        setResult({
          action: "check_out",
          faceStatus: null,
          checkInTime: gate.record.checkInTime ?? null,
          checkOutTime: gate.record.checkOutTime ?? null,
          responseSeconds: 0,
        });
        setStatusMessage("Attendance already completed for today.");
        setStatusType("info");
        setStage("complete");
        setProcessFinished(true);
        return;
      }

      // gate.outcome === "ok"
      setEmployee(gate.employee);
      setSite(gate.site);
      setPendingAction(gate.action);
      setExistingRecordId(gate.existingRecordId ?? null);
      setStatusMessage("Verifying location...");
      setStatusType("warning");
      setStage("location");

      const applyGeofence = gate.site.geofenceEnabled;

      const proceedToCapture = (nextLocation: GpsState) => {
        setGps(nextLocation);
        setStatusMessage(
          gate.action === "check_out" ? "Capturing selfie for check-out..." : "Capturing selfie for check-in..."
        );
        setStatusType("warning");
        setStage("capturing");
      };

      if (!applyGeofence) {
        proceedToCapture({ latitude: 0, longitude: 0, accuracy: 0 });
        return;
      }

      if (!navigator.geolocation) {
        setStatusMessage("Location services unavailable.");
        setStatusType("error");
        setStage("failed");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          if (applyGeofence) {
            const distance = calculateDistance(
              nextLocation.latitude,
              nextLocation.longitude,
              Number(gate.site.latitude),
              Number(gate.site.longitude)
            );

            if (distance > Number(gate.site.allowedRadius)) {
              setStatusMessage("You are not near the assigned godown location.");
              setStatusType("error");
              setStage("failed");
              return;
            }
          }

          proceedToCapture(nextLocation);
        },
        () => {
          if (applyGeofence) {
            setStatusMessage("Unable to verify your location.");
            setStatusType("error");
            setStage("failed");
            return;
          }
          proceedToCapture({ latitude: 0, longitude: 0, accuracy: 0 });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    } catch {
      setStatusMessage("Unable to process attendance right now.");
      setStatusType("error");
      setStage("failed");
    }
  };

  const handleCapture = async (blob: Blob) => {
    if (processFinished || !employee || !site || !gps || !pendingAction) return;

    setStatusMessage("Verifying your face...");
    setStatusType("info");
    setStage("uploading");

    const startedAt = performance.now();

    try {
      const outcome = await verifyFaceAndRecordAttendance({
        employee,
        site,
        action: pendingAction,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        recordId: existingRecordId ?? undefined,
        image: blob,
      });
      const responseSeconds = (performance.now() - startedAt) / 1000;

      if (outcome.outcome === "retry") {
        setStatusMessage(outcome.message);
        setStatusType("warning");
        setStage("capturing");
        setCaptureAttempt((attempt) => attempt + 1);
        return;
      }

      if (outcome.outcome === "restart") {
        setStatusMessage(outcome.message);
        setStatusType("error");
        setStage("failed");
        setProcessFinished(true);
        return;
      }

      setResult({
        action: pendingAction,
        faceStatus: outcome.faceStatus,
        checkInTime: outcome.checkInTime,
        checkOutTime: outcome.checkOutTime,
        responseSeconds,
      });
      setStage("complete");
      setProcessFinished(true);
    } catch {
      setStatusMessage("Unable to complete attendance.");
      setStatusType("error");
      setStage("failed");
      setProcessFinished(true);
    }
  };

  const handleCameraError = () => {
    setStatusMessage("Camera access is required to complete attendance.");
    setStatusType("error");
    setStage("failed");
    setProcessFinished(true);
  };

  const handleDigit = (digit: string) => {
    if (processFinished || stage === "failed") {
      resetProcess();
      setAttendanceId(digit);
      return;
    }
    if (attendanceId.length >= 2) return;

    const next = attendanceId + digit;
    setAttendanceId(next);
    if (next.length === 2) {
      void runGateCheck(next);
    }
  };

  const handleBackspace = () => {
    if (processFinished || stage === "failed") return;
    setAttendanceId((prev) => prev.slice(0, -1));
  };

  const showEntryScreen = stage === "idle" || stage === "failed";
  const showProgressScreen = stage !== "idle" && stage !== "failed" && stage !== "complete";
  const showResultCard = stage === "complete" && result;
  const hideSummaryOnMobile = stage === "capturing" || stage === "uploading";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full items-center justify-center">
        <div className="w-full max-w-[100%] rounded-[20px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:max-w-[520px] lg:max-w-[560px]">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="text-left">
                <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
                <p className="text-lg font-bold text-slate-900">{timeLabel}</p>
              </div>

              {employee && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{employee.employeeName}</p>
                  <p className="text-xs text-slate-500">Serial No: {employee.serialNo}</p>
                </div>
              )}
            </div>

            {showEntryScreen && (
              <div className="space-y-5">
                <p className="text-center text-base font-bold uppercase tracking-wide text-slate-700">Serial No</p>

                <div className="mx-auto flex h-20 w-full max-w-[180px] items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-extrabold tracking-[0.5em] text-slate-900 shadow-sm">
                  {attendanceId ? attendanceId : <span className="text-slate-300">• •</span>}
                </div>

                <Keypad onDigit={handleDigit} onBackspace={handleBackspace} onReset={resetProcess} />

                <div className={`rounded-[24px] border p-4 text-center text-base font-semibold ${statusColor}`}>
                  {statusMessage}
                </div>
              </div>
            )}

            {showProgressScreen && (
              <div className="space-y-6">
                <div className={hideSummaryOnMobile ? "hidden gap-4 sm:grid" : "grid gap-4"}>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">EMP</span>
                      <span className="text-sm font-semibold">Employee</span>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-slate-900">{employee?.employeeName || "Identifying..."}</p>
                    <p className="mt-1 text-sm uppercase tracking-[0.24em] text-slate-500">{employee?.employeeCode || "-----"}</p>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">GODOWN</span>
                      <span className="text-sm font-semibold">Assigned Godown</span>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-slate-900">{site?.siteName || "Waiting for assignment..."}</p>
                  </div>
                </div>

                {stage === "capturing" && (
                  <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-1 shadow-sm">
                    <CameraCapture key={captureAttempt} onCapture={handleCapture} onError={handleCameraError} />
                  </div>
                )}

                <div className={`rounded-[24px] border p-4 text-center text-base font-semibold ${statusColor}`}>
                  {statusMessage}
                </div>
              </div>
            )}

            {showResultCard && result && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
                  <FiCheck className="h-14 w-14 text-emerald-600" />
                </div>

                <p className="text-sm font-medium text-slate-500">
                  Attendance Type:{" "}
                  <span className="font-semibold text-slate-900">
                    {result.action === "check_out" ? "Closing" : "Opening"}
                  </span>
                </p>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Godown</span>
                    <span className="font-semibold text-slate-900">{site?.siteName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Opening Time</span>
                    <span className="font-semibold text-slate-900">{result.checkInTime || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Closing Time</span>
                    <span className="font-semibold text-slate-900">{result.checkOutTime || "—"}</span>
                  </div>
                </div>

                {result.faceStatus === "unverified" && (
                  <p className="rounded-[16px] bg-amber-50 p-3 text-sm font-medium text-amber-700">
                    Face couldn&apos;t be confidently verified — HR will review this.
                  </p>
                )}
                {result.faceStatus === "service_error" && (
                  <p className="rounded-[16px] bg-amber-50 p-3 text-sm font-medium text-amber-700">
                    Face verification service was unavailable — recorded and flagged for HR review.
                  </p>
                )}

                <Button onClick={resetProcess} className="w-full bg-emerald-600 py-6 text-base font-semibold hover:bg-emerald-700">
                  OK
                </Button>

                {result.responseSeconds > 0 && (
                  <p className="text-xs text-slate-400">Response Time: {result.responseSeconds.toFixed(3)} Secs</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
