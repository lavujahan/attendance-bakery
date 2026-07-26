"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { navigation } from "@/lib/navigation";
import { logoutAdmin } from "@/app/admin-login/actions";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navigation.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icon className="size-5 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAdmin();
    router.replace("/admin-login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:flex md:flex-col">
        <p className="px-3 py-2 text-lg font-semibold text-slate-900">Attendance</p>
        <div className="mt-4 flex-1">
          <NavLinks />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="size-5" />
          Log out
        </button>
      </aside>

      {/* Mobile slide-in drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between px-1 py-2">
              <p className="text-lg font-semibold text-slate-900">Attendance</p>
              <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-5" />
              Log out
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setMobileNavOpen(true)} className="rounded-lg p-2 hover:bg-slate-100">
            <Menu className="size-5" />
          </button>
          <p className="text-base font-semibold text-slate-900">Attendance</p>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
