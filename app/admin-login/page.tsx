"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => username.trim().length > 0 && password.trim().length > 0, [username, password]);

  const handleLogin = async () => {
    setError("");
    if (!canSubmit) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await loginAdmin(username, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Admin Portal</p>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Administrator Login</h1>
          <p className="mt-3 text-sm text-slate-500">Use your admin credentials to access the dashboard.</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="admin-username">Username</Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Admin"
              autoComplete="username"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-12 text-base"
              onKeyDown={(event) => event.key === "Enter" && handleLogin()}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={handleLogin}
            disabled={!canSubmit || loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </div>
      </div>
    </main>
  );
}
