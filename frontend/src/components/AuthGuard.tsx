"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { User } from "@/lib/types";

interface AuthGuardProps {
  children: (user: User) => React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bru_movements_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    apiFetch<User>("/api/auth/me")
      .then((u) => {
        setUser(u);
        setChecking(false);
      })
      .catch(() => {
        localStorage.removeItem("bru_movements_token");
        router.replace("/login");
      });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#861A22] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#861A22] font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children(user)}</>;
}
