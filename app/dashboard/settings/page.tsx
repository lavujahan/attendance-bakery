"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppCard } from "@/components/ui/AppCard";
import { getCurrentAdmin, updateAdminPassword, updateAdminUsername } from "./actions";

export default function SettingsPage() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [username, setUsername] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAdmin = async () => {
      const admin = await getCurrentAdmin();
      if (admin) setCurrentUsername(admin.username);
    };
    void loadAdmin();
  }, []);

  const usernameValid = useMemo(() => username.trim().length >= 4 && username.trim().length <= 30, [username]);

  const handleUsernameUpdate = async () => {
    setUsernameMessage("");
    if (!usernameValid) {
      setUsernameMessage("Username must be 4 to 30 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateAdminUsername(username.trim());
      if (result.error) {
        setUsernameMessage(result.error);
        return;
      }
      setCurrentUsername(username.trim());
      setUsername("");
      setUsernameMessage("Username updated successfully.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("All password fields are required.");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 50) {
      setPasswordMessage("New password must be 6 to 50 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateAdminPassword(currentPassword, newPassword);
      if (result.error) {
        setPasswordMessage(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated successfully.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Settings</h1>
        <p className="text-slate-500">Manage admin account credentials and dashboard access.</p>
      </div>

      <AppCard title="Admin Account" description="Update the admin username and password.">
        <div className="grid gap-6">
          <div className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Current Username</p>
                <p className="text-lg font-semibold text-slate-900">{currentUsername || "Loading..."}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Current Password</p>
                <p className="text-lg font-semibold text-slate-900">••••••••</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Change Username</h2>
                <p className="text-sm text-slate-500">Update the admin login username.</p>
              </div>

              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="username">New Username</Label>
                  <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Admin" />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={handleUsernameUpdate} disabled={!usernameValid || loading} className="w-full sm:w-auto">
                    Save Username
                  </Button>
                </div>
                {usernameMessage ? <p className="text-sm text-slate-600">{usernameMessage}</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
                <p className="text-sm text-slate-500">Update the admin password securely.</p>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={handlePasswordUpdate} disabled={loading} className="w-full sm:w-auto">
                    Save Password
                  </Button>
                </div>
                {passwordMessage ? <p className="text-sm text-slate-600">{passwordMessage}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
