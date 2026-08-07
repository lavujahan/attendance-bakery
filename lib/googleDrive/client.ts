import "server-only";

// Server-only client for the Google Apps Script web app that uploads employee ID proof
// PDFs to Drive (see google-apps-script/upload-id-proof.gs -- deployed outside this
// repo, in the admin's own Google account). Mirrors lib/faceService/client.ts's
// server-only guard and typed-result-instead-of-throw shape: GOOGLE_DRIVE_UPLOAD_SECRET
// must never reach the browser bundle, so only import this from Server Actions.

const GOOGLE_DRIVE_UPLOAD_URL = process.env.GOOGLE_DRIVE_UPLOAD_URL!;
const GOOGLE_DRIVE_UPLOAD_SECRET = process.env.GOOGLE_DRIVE_UPLOAD_SECRET!;

// Apps Script cold starts + Drive write can be slow. 20s was too tight in practice: the
// client would abort and report "upload failed" while Apps Script kept running server-side
// and finished writing the file to Drive anyway (it only responds *after* the write
// completes), producing an orphaned Drive file plus a false failure. 45s cuts that race
// down significantly; EmployeeForm no longer treats an upload failure as fatal to the
// employee save either way, so this is a mitigation, not the sole fix.
const TIMEOUT_MS = 45_000;

interface UploadRawResponse {
  url?: string;
  error?: string;
}

export type UploadResult = { ok: true; url: string } | { ok: false; detail: string };

export async function uploadIdProof(fileName: string, mimeType: string, base64Data: string): Promise<UploadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: GOOGLE_DRIVE_UPLOAD_SECRET, fileName, mimeType, base64Data }),
      signal: controller.signal,
    });

    let body: UploadRawResponse | null = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON body (e.g. Apps Script's own error page) -- treat as a service error below
    }

    if (body === null) {
      return { ok: false, detail: `upload service returned a non-JSON response (HTTP ${response.status})` };
    }
    if (body.error) {
      return { ok: false, detail: body.error };
    }
    if (!body.url) {
      return { ok: false, detail: `unexpected upload service response: ${JSON.stringify(body)}` };
    }

    return { ok: true, url: body.url };
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? `upload service did not respond within ${TIMEOUT_MS}ms`
        : `upload service unreachable: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, detail };
  } finally {
    clearTimeout(timer);
  }
}
