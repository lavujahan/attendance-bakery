"use server";

import { deleteFaceEmbeddings, enrollFace, type EnrollResult } from "@/lib/faceService/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

// face-service stays a stateless verify/store engine -- it never writes to `employees`.
// This app owns "is this employee kiosk-ready" as business state: after each accepted
// shot, count that employee's onboarding-source rows in face_embeddings (readable here
// via the service-role key, same as face-service uses) and flip `face_enrolled` once the
// required count is reached. See the plan's "Enrollment ownership" note.
const REQUIRED_ONBOARDING_SHOTS = 4;

export async function enrollEmployeeFacePhoto(employeeId: string, image: Blob): Promise<EnrollResult> {
  const result = await enrollFace(employeeId, image);

  if (result.accepted) {
    const { count, error } = await supabaseAdmin
      .from("face_embeddings")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .eq("source", "onboarding");

    if (!error && (count ?? 0) >= REQUIRED_ONBOARDING_SHOTS) {
      await supabaseAdmin.from("employees").update({ face_enrolled: true }).eq("id", employeeId);
    }
  }

  return result;
}

export async function resetEmployeeFaceEnrollment(employeeId: string): Promise<{ deletedCount: number } | { error: string }> {
  const result = await deleteFaceEmbeddings(employeeId, "all");
  await supabaseAdmin.from("employees").update({ face_enrolled: false }).eq("id", employeeId);
  return result;
}
