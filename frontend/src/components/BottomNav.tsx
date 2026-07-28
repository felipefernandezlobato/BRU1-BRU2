"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "@/lib/types";

interface BottomNavProps {
  user: User;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill={active ? "#861A22" : "none"}
      stroke={active ? "#861A22" : "#9CA3AF"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <path d="M5 10v11h14V10" />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#861A22" : "#9CA3AF"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x={9} y={3} width={6} height={4} rx={1} />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#861A22" : "#9CA3AF"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";

  const isHomeActive = pathname === "/";
  const isMovimientosActive = pathname.startsWith("/movimientos");
  const isAdminActive = pathname.startsWith("/admin");

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-20 safe-area-bottom">
      <div className="flex items-stretch max-w-2xl mx-auto">
        <Link
          href="/"
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[52px] relative"
        >
          {isHomeActive && (
            <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#861A22] rounded-b" />
          )}
          <HomeIcon active={isHomeActive} />
          <span
            className="text-xs font-medium"
            style={{ color: isHomeActive ? "#861A22" : "#9CA3AF" }}
          >
            Inicio
          </span>
        </Link>

        <Link
          href="/movimientos"
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[52px] relative"
        >
          {isMovimientosActive && (
            <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#861A22] rounded-b" />
          )}
          <ListIcon active={isMovimientosActive} />
          <span
            className="text-xs font-medium"
            style={{ color: isMovimientosActive ? "#861A22" : "#9CA3AF" }}
          >
            Movimientos
          </span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[52px] relative"
          >
            {isAdminActive && (
              <span className="absolute top-0 left-4 right-4 h-[2px] bg-[#861A22] rounded-b" />
            )}
            <AdminIcon active={isAdminActive} />
            <span
              className="text-xs font-medium"
              style={{ color: isAdminActive ? "#861A22" : "#9CA3AF" }}
            >
              Admin
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
