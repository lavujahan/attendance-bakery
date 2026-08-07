"use server";

import { uploadIdProof } from "@/lib/googleDrive/client";

// Raises this action's own execution ceiling so the hosting platform doesn't kill it
// before lib/googleDrive/client.ts's 45s client-side timeout ever gets a chance to fire.
// Confirm the hosting plan actually honors this value (e.g. Vercel Hobby caps lower).
export const maxDuration = 60;

export async function uploadEmployeeIdProof(
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ url: string } | { error: string }> {
  const result = await uploadIdProof(fileName, mimeType, base64Data);

  if (!result.ok) {
    return { error: result.detail };
  }
  return { url: result.url };
}
