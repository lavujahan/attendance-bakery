"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function loginAdmin(username: string, password: string): Promise<{ error?: string }> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) {
    return { error: "Username and password are required." };
  }

  const { data: email, error: lookupError } = await supabaseAdmin.rpc("admin_email_for_username", {
    p_username: trimmedUsername,
  });

  if (lookupError || !email) {
    return { error: "Invalid username or password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Invalid username or password." };
  }

  return {};
}

export async function logoutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
