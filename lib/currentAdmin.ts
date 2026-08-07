import { supabaseBrowser } from "@/lib/supabase/client";

// Salary finalize/reopen/pay actions are audited against the acting admin's id --
// resolved client-side from the current Supabase Auth session (RLS already restricts
// every salary table to admin_profiles members, so this is just for attribution).
export async function getCurrentAdminId(): Promise<string> {
  const {
    data: { user },
  } = await supabaseBrowser.auth.getUser();

  if (!user) throw new Error("You must be signed in as an admin to perform this action.");
  return user.id;
}
