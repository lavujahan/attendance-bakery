// One-time script to create the first admin user.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/bootstrap-admin.mjs <username> <password>

import { createClient } from "@supabase/supabase-js";

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <username> <password>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `${username}@admin.internal.local`;

const { data: userData, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  console.error("Failed to create admin user:", createError.message);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from("admin_profiles")
  .insert({ id: userData.user.id, username });

if (profileError) {
  console.error("Failed to create admin_profiles row:", profileError.message);
  process.exit(1);
}

console.log(`Admin user "${username}" created successfully.`);
