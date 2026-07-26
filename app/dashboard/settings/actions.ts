"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function syntheticEmail(username: string) {
  return `${username}@admin.internal.local`;
}

export async function getCurrentAdmin(): Promise<{ username: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("admin_profiles").select("username").eq("id", user.id).maybeSingle();

  return data ? { username: data.username } : null;
}

export async function updateAdminUsername(newUsername: string): Promise<{ error?: string }> {
  const trimmed = newUsername.trim();
  if (trimmed.length < 4 || trimmed.length > 30) {
    return { error: "Username must be 4 to 30 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: syntheticEmail(trimmed),
  });

  if (emailError) {
    return { error: "Unable to update username." };
  }

  const { error: profileError } = await supabase.from("admin_profiles").update({ username: trimmed }).eq("id", user.id);

  if (profileError) {
    return { error: "Unable to update username." };
  }

  return {};
}

export async function updateAdminPassword(currentPassword: string, newPassword: string): Promise<{ error?: string }> {
  if (newPassword.length < 6 || newPassword.length > 50) {
    return { error: "New password must be 6 to 50 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Not authenticated." };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    return { error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    return { error: "Unable to update password." };
  }

  return {};
}
