"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PinPad } from "@/components/PinPad";
import { LoginUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pinError, setPinError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // If already logged in, redirect home
    const token = localStorage.getItem("bru_movements_token");
    if (token) {
      router.replace("/");
      return;
    }

    apiFetch<LoginUser[]>("/api/auth/users")
      .then((data) => setUsers(data))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [router]);

  const handlePinSubmit = useCallback(
    async (pin: string) => {
      if (!selectedUser || submitting) return;
      setSubmitting(true);
      setPinError(undefined);

      try {
        const result = await apiFetch<{ token: string; user: { id: number; name: string; role: string } }>(
          "/api/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ name: selectedUser.name, pin }),
          }
        );
        localStorage.setItem("bru_movements_token", result.token);
        router.replace("/");
      } catch {
        setPinError("PIN incorrecto. Inténtalo de nuevo.");
      } finally {
        setSubmitting(false);
      }
    },
    [selectedUser, submitting, router]
  );

  function handleCancel() {
    setSelectedUser(null);
    setPinError(undefined);
  }

  function getInitial(name: string) {
    return name.charAt(0).toUpperCase();
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(to bottom, #F5F0E8 0%, #FAF7F2 40%, #FFFFFF 100%)" }}
    >
      {/* PIN pad overlay */}
      {selectedUser ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
            <div className="text-center mb-8">
              {/* Larger avatar in modal */}
              <div className="w-20 h-20 rounded-full bg-[#861A22] text-white text-3xl font-semibold flex items-center justify-center mx-auto mb-4 shadow-lg">
                {getInitial(selectedUser.name)}
              </div>
              <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-tight">
                {selectedUser.name}
              </h2>
              <p className="text-sm text-[#9CA3AF] mt-1.5">Introduce tu PIN de 4 dígitos</p>
            </div>
            {/* Error state -- shown above the PinPad */}
            {pinError && !submitting && (
              <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-red-600 text-sm font-medium">{pinError}</p>
              </div>
            )}
            <PinPad
              onSubmit={handlePinSubmit}
              onCancel={handleCancel}
              error={submitting ? "Verificando..." : pinError}
            />
          </div>
        </div>
      ) : null}

      {/* Header with full BRU logo */}
      <header className="pt-14 pb-6 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/bru-full-maroon.png"
          alt="BRU Specialty Coffee"
          className="h-24 w-auto mb-1"
        />
        {/* Thin maroon divider below logo */}
        <div
          className="mt-5 mb-0 rounded-full"
          style={{ width: 48, height: 2, backgroundColor: "#861A22", opacity: 0.25 }}
        />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-5 pb-10">
        {/* Section heading -- elegant display font */}
        <h2
          className="font-display text-3xl text-[#1A1A1A] text-center mb-8 mt-6"
          style={{ fontStyle: "italic", letterSpacing: "-0.01em" }}
        >
          ¿Quién registra?
        </h2>

        <div className="w-full max-w-lg">
          {loadingUsers ? (
            <div className="flex justify-center py-16">
              <div className="w-9 h-9 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-[#9CA3AF] py-12">
              No se encontraron miembros del equipo. Contacta con tu responsable.
            </p>
          ) : (
            <div
              className={
                users.length === 1
                  ? "flex justify-center"
                  : "grid grid-cols-2 sm:grid-cols-3 gap-4"
              }
            >
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u);
                    setPinError(undefined);
                  }}
                  className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-all touch-manipulation card-hover"
                  style={{
                    border: "1px solid #E8E0D5",
                    boxShadow: "0 2px 8px rgba(134,26,34,0.06), 0 1px 3px rgba(0,0,0,0.05)",
                    width: users.length === 1 ? 180 : undefined,
                  }}
                >
                  {/* Bigger avatar */}
                  <div className="w-14 h-14 rounded-full bg-[#861A22] text-white text-xl font-semibold flex items-center justify-center shadow-sm">
                    {getInitial(u.name)}
                  </div>
                  <span className="text-sm font-semibold text-[#1A1A1A] text-center leading-tight tracking-wide uppercase" style={{ letterSpacing: "0.04em", fontSize: "0.7rem" }}>
                    {u.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer -- brand accent */}
      <footer className="flex flex-col items-center pb-8 gap-3">
        {/* Thin maroon accent line */}
        <div
          className="rounded-full"
          style={{ width: 40, height: 2, backgroundColor: "#861A22", opacity: 0.3 }}
        />
        <p className="text-[#9CA3AF] text-xs tracking-widest uppercase" style={{ letterSpacing: "0.12em" }}>
          Control de Stock
        </p>
      </footer>
    </div>
  );
}
