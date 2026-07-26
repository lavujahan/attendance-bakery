import "server-only";

// Server-only client for the face-service microservice (Insightface/face-service).
// Mirrors lib/supabase/admin.ts's server-only guard: FACE_SERVICE_API_KEY must never
// reach the browser bundle, so only import this from Server Actions.
//
// Hardening over the v1 client (attendance_updated-main):
//   1. Every call has an explicit timeout (AbortController) -- v1 had none, so an
//      unresponsive face-service would hang the kiosk indefinitely.
//   2. Network/timeout failures are surfaced as a distinct "service_error" outcome,
//      not conflated with a genuine face mismatch ("unverified") or thrown as an
//      unhandled exception -- callers (the kiosk) need to tell "the employee's face
//      didn't match" apart from "face-service was unreachable" for HR triage and for
//      the fail-open policy (both stay fail-open, but the remediation differs).
//   3. No automatic retries -- a slow-but-eventually-successful retry on /verify risks
//      writing a duplicate attendance record; callers surface a manual "try again".

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL!.replace(/\/+$/, "");
const FACE_SERVICE_API_KEY = process.env.FACE_SERVICE_API_KEY!;

const TIMEOUT_MS = {
  enroll: 15_000,
  verify: 20_000, // includes model inference latency
  delete: 10_000,
} as const;

function authHeaders() {
  return { "X-Internal-Api-Key": FACE_SERVICE_API_KEY };
}

// Raw JSON shape across all three face-service endpoints (fields are optional since
// each endpoint only populates the ones relevant to it -- see main.py in face-service).
interface FaceServiceRawResponse {
  accepted?: boolean;
  reason?: string;
  embedding_id?: string;
  quality_score?: number;
  match?: boolean;
  confidence?: number;
  embedding_added?: boolean;
  deleted_count?: number;
}

async function callFaceService(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ ok: true; status: number; body: FaceServiceRawResponse } | { ok: false; kind: "service_error"; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${FACE_SERVICE_URL}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers ?? {}) },
      signal: controller.signal,
    });

    let body: FaceServiceRawResponse | null = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON body (e.g. a proxy error page) -- treat as a service error below
    }

    if (body === null) {
      return { ok: false, kind: "service_error", detail: `face-service returned a non-JSON response (HTTP ${response.status})` };
    }

    return { ok: true, status: response.status, body };
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? `face-service did not respond within ${timeoutMs}ms`
        : `face-service unreachable: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, kind: "service_error", detail };
  } finally {
    clearTimeout(timer);
  }
}

type EnrollRejectReason =
  | "no_face"
  | "multiple_faces"
  | "face_too_small"
  | "bad_pose"
  | "blurry"
  | "bad_lighting"
  | "duplicate_of_existing"
  | "invalid_image";

export type EnrollResult =
  | { accepted: true; embeddingId: string; qualityScore: number }
  | { accepted: false; reason: EnrollRejectReason }
  | { accepted: false; reason: "service_error"; detail: string };

export async function enrollFace(employeeId: string, image: Blob): Promise<EnrollResult> {
  const form = new FormData();
  form.set("employee_id", employeeId);
  form.set("image", image, "capture.jpg");

  const result = await callFaceService("/enroll", { method: "POST", body: form }, TIMEOUT_MS.enroll);

  if (!result.ok) {
    return { accepted: false, reason: "service_error", detail: result.detail };
  }
  if (result.status === 200 && result.body.accepted && result.body.embedding_id && result.body.quality_score !== undefined) {
    return { accepted: true, embeddingId: result.body.embedding_id, qualityScore: result.body.quality_score };
  }
  return { accepted: false, reason: (result.body.reason as EnrollRejectReason | undefined) ?? "invalid_image" };
}

// `status` is the exact value to persist in attendance.check_in_face_status /
// check_out_face_status ('verified' | 'unverified' | 'service_error'), or null for
// capture-quality issues that should block the write entirely and ask for a retry
// instead (handled by the caller before it ever reaches the DB).
export type VerifyResult =
  | { outcome: "verified"; confidence: number; embeddingAdded: boolean }
  | { outcome: "unverified"; confidence: number }
  | { outcome: "service_error"; detail: string }
  | { outcome: "retry"; reason: "no_face" | "multiple_faces" | "invalid_image" }
  | { outcome: "not_enrolled" };

export async function verifyFace(
  employeeId: string,
  action: "check_in" | "check_out",
  image: Blob
): Promise<VerifyResult> {
  const form = new FormData();
  form.set("employee_id", employeeId);
  form.set("action", action);
  form.set("image", image, "capture.jpg");

  const result = await callFaceService("/verify", { method: "POST", body: form }, TIMEOUT_MS.verify);

  if (!result.ok) {
    return { outcome: "service_error", detail: result.detail };
  }

  const body = result.body;

  if (body.match === true) {
    return { outcome: "verified", confidence: body.confidence ?? 0, embeddingAdded: Boolean(body.embedding_added) };
  }
  if (result.status === 200 && body.reason === "below_threshold") {
    return { outcome: "unverified", confidence: body.confidence ?? 0 };
  }
  if (body.reason === "no_enrolled_embeddings") {
    return { outcome: "not_enrolled" };
  }
  if (body.reason === "no_face" || body.reason === "multiple_faces" || body.reason === "invalid_image") {
    return { outcome: "retry", reason: body.reason };
  }
  return { outcome: "service_error", detail: `unexpected face-service response: ${JSON.stringify(body)}` };
}

export async function deleteFaceEmbeddings(
  employeeId: string,
  source: "all" | "adaptive"
): Promise<{ deletedCount: number } | { error: string }> {
  const result = await callFaceService(
    `/employees/${employeeId}/embeddings?source=${source}`,
    { method: "DELETE" },
    TIMEOUT_MS.delete
  );

  if (!result.ok) {
    return { error: result.detail };
  }
  return { deletedCount: result.body.deleted_count ?? 0 };
}
