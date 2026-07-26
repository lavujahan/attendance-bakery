"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CameraCapture from "@/components/attendance/CameraCapture";
import { enrollEmployeeFacePhoto } from "@/app/dashboard/employees/faceActions";

const TOTAL_SHOTS = 4;

const REASON_MESSAGES: Record<string, string> = {
  no_face: "No face detected — center your face in the frame.",
  multiple_faces: "More than one face detected — make sure only one person is in frame.",
  face_too_small: "Move closer to the camera.",
  bad_pose: "Face the camera more directly.",
  blurry: "That was blurry — hold still and retry.",
  bad_lighting: "Lighting is too dark or too bright.",
  duplicate_of_existing: "Too similar to a previous shot — try a different angle.",
  invalid_image: "Could not read that photo — try again.",
  service_error: "Could not reach the face service — try again.",
};

interface Props {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function FaceEnrollDialog({ employeeId, employeeName, open, onOpenChange, onComplete }: Props) {
  const [shotIndex, setShotIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const done = shotIndex >= TOTAL_SHOTS;

  const handleCapture = async (blob: Blob) => {
    setSubmitting(true);
    setFeedback("");

    try {
      const result = await enrollEmployeeFacePhoto(employeeId, blob);

      if (result.accepted) {
        toast.success(`Shot ${shotIndex + 1} of ${TOTAL_SHOTS} captured`);
        setShotIndex((index) => index + 1);
      } else {
        setFeedback(REASON_MESSAGES[result.reason] ?? "Capture rejected — try again.");
      }
    } catch {
      setFeedback("Could not reach the face service — try again.");
    } finally {
      setSubmitting(false);
      setAttempt((value) => value + 1);
    }
  };

  const resetState = () => {
    setShotIndex(0);
    setAttempt(0);
    setFeedback("");
    setSubmitting(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      const wasComplete = done;
      resetState();
      if (wasComplete) onComplete?.();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Face — {employeeName}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-base font-medium text-emerald-700">
              All {TOTAL_SHOTS} shots captured. This employee can now use the kiosk.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <CameraCapture
              key={attempt}
              autoCapture={false}
              allowCameraSwitch
              caption={`Shot ${shotIndex + 1} of ${TOTAL_SHOTS} — look straight ahead`}
              onCapture={handleCapture}
            />
            {submitting && <p className="text-center text-sm text-slate-500">Checking photo...</p>}
            {feedback && !submitting && <p className="text-center text-sm text-rose-600">{feedback}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {done ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
