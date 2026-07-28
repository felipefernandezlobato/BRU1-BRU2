"use client";

import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
import { User } from "@/lib/types";

interface AppShellProps {
  children: (user: User) => React.ReactNode;
}

function AppShellInner({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("bru_movements_token");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <header className="bg-[#861A22] px-4 py-4 sticky top-0 z-10 shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/bru-logo.svg"
            alt="BRU Specialty Coffee"
            className="h-9 w-auto brightness-0 invert"
          />
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-semibold">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="text-white text-xs border border-white/50 rounded-lg px-3 py-1.5 hover:bg-white/15 hover:border-white/70 active:bg-white/20 transition-colors"
              aria-label="Cerrar sesión"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full">
        {children}
      </main>

      <BottomNav user={user} />
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <ToastProvider>
      <AuthGuard>
        {(user: User) => (
          <AppShellInner user={user}>{children(user)}</AppShellInner>
        )}
      </AuthGuard>
    </ToastProvider>
  );
}
