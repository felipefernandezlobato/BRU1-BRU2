"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { formatCHF } from "@/lib/format";
import { Movement, User } from "@/lib/types";

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSpanishDate(): string {
  const days = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBru1ToBru2 = direction === "BRU1_TO_BRU2";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
      style={{ backgroundColor: isBru1ToBru2 ? "#861A22" : "#92400E" }}
    >
      {isBru1ToBru2 ? "BRU1 → BRU2" : "BRU2 → BRU1"}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx={12} cy={13} r={4} />
    </svg>
  );
}

function HomeContent({ user }: { user: User }) {
  const toast = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = useCallback(async () => {
    try {
      const today = getTodayISO();
      const data = await apiFetch<Movement[]>(
        `/api/movements?start_date=${today}&end_date=${today}`
      );
      setMovements(data);
    } catch {
      toast("Error al cargar movimientos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Auto-refresh on window focus
  useEffect(() => {
    function handleFocus() {
      fetchMovements();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchMovements]);

  const todayCount = movements.length;
  const todayCost = movements.reduce((sum, m) => sum + m.total_cost, 0);

  return (
    <div className="p-4 space-y-5">
      {/* Greeting */}
      <div>
        <h1
          className="font-display text-2xl text-[#1A1A1A]"
          style={{ fontStyle: "italic" }}
        >
          Hola, {user.name}
        </h1>
        <p className="text-sm text-[#9CA3AF] mt-1">{formatSpanishDate()}</p>
      </div>

      {/* Quick action */}
      <Link
        href="/movimientos/nuevo"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-semibold text-base active:scale-[0.98] transition-transform touch-manipulation"
        style={{ backgroundColor: "#861A22" }}
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nuevo Movimiento
      </Link>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
            Movimientos hoy
          </p>
          <p className="text-2xl font-bold text-[#1A1A1A] mt-1">
            {loading ? "—" : todayCount}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
            Coste total hoy
          </p>
          <p className="text-2xl font-bold text-[#1A1A1A] mt-1">
            {loading ? "—" : formatCHF(todayCost)}
          </p>
        </div>
      </div>

      {/* Today's movements */}
      <div>
        <h2
          className="font-display text-lg text-[#1A1A1A] mb-3"
          style={{ fontStyle: "italic" }}
        >
          Movimientos de hoy
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : movements.length === 0 ? (
          <p className="text-center text-[#9CA3AF] py-10 text-sm">
            No hay movimientos hoy
          </p>
        ) : (
          <div className="space-y-3">
            {movements.map((m) => (
              <Link
                key={m.id}
                href={`/movimientos/${m.id}`}
                className="block bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB] card-hover touch-manipulation"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DirectionBadge direction={m.direction} />
                      <span className="text-xs text-[#9CA3AF]">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#6B7280] mt-2">
                      {m.creator_name || "Usuario"}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#9CA3AF]">
                        {m.lines.length}{" "}
                        {m.lines.length === 1 ? "articulo" : "articulos"}
                      </span>
                      {m.photo_filename && (
                        <span className="text-[#9CA3AF]">
                          <CameraIcon />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {formatCHF(m.total_cost)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      {(user) => <HomeContent user={user} />}
    </AppShell>
  );
}
