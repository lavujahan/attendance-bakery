"use server";

import { uploadIdProof } from "@/lib/googleDrive/client";

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
