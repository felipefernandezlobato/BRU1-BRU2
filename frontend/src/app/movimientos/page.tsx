"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Movement } from "@/lib/types";
import { formatCHF, formatDate } from "@/lib/format";

type DateFilter = "today" | "week" | "month" | "all";
type DirectionFilter = "all" | "BRU1_TO_BRU2" | "BRU2_TO_BRU1";

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Todo",
};

const DIRECTION_FILTER_LABELS: Record<DirectionFilter, string> = {
  all: "Todos",
  BRU1_TO_BRU2: "BRU1 → BRU2",
  BRU2_TO_BRU1: "BRU2 → BRU1",
};

const PAGE_SIZE = 20;

function getDateRange(filter: DateFilter): { from?: string; to?: string } {
  if (filter === "all") return {};
  const now = new Date();
  const to = now.toISOString().split("T")[0];

  if (filter === "today") {
    return { from: to, to };
  }
  if (filter === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { from: monday.toISOString().split("T")[0], to };
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: first.toISOString().split("T")[0], to };
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBru1 = direction === "BRU1_TO_BRU2";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isBru1
          ? "bg-[#861A22] text-white"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {isBru1 ? "BRU1 → BRU2" : "BRU2 → BRU1"}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9CA3AF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx={12} cy={13} r={4} />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D1D5DB"
      strokeWidth={1.2}
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

function MovimientosContent() {
  const router = useRouter();
  const toast = useToast();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");

  const buildQueryParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const { from, to } = getDateRange(dateFilter);
      if (from) params.set("start_date", from);
      if (to) params.set("end_date", to);
      if (directionFilter !== "all") params.set("direction", directionFilter);

      return params.toString();
    },
    [dateFilter, directionFilter]
  );

  const fetchMovements = useCallback(
    async (reset: boolean = true) => {
      try {
        if (reset) setLoading(true);
        else setLoadingMore(true);

        const offset = reset ? 0 : movements.length;
        const qs = buildQueryParams(offset);
        const data = await apiFetch<Movement[]>(
          `/api/movements?${qs}`
        );

        if (reset) {
          setMovements(data);
        } else {
          setMovements((prev) => [...prev, ...data]);
        }
        const currentTotal = reset
          ? data.length
          : movements.length + data.length;
        setTotalCount(currentTotal);
        setHasMore(data.length >= PAGE_SIZE);
      } catch {
        toast("Error al cargar movimientos", "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQueryParams, movements, toast]
  );

  // Fetch on filter change
  useEffect(() => {
    fetchMovements(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, directionFilter]);

  // Auto-refresh on window focus
  useEffect(() => {
    function handleFocus() {
      fetchMovements(true);
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, directionFilter]);

  function extractTime(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="p-4">
      {/* Page header */}
      <div className="mb-4">
        <h1
          className="font-display text-2xl text-[#1A1A1A]"
          style={{ fontStyle: "italic" }}
        >
          Movimientos
        </h1>
        {!loading && (
          <p className="text-sm text-[#9CA3AF] mt-0.5">
            {totalCount} movimiento{totalCount !== 1 ? "s" : ""} encontrado
            {totalCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        {/* Date filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                dateFilter === key
                  ? "bg-[#861A22] text-white"
                  : "bg-[#F3F4F6] text-[#6B7280] active:bg-[#E5E7EB]"
              }`}
            >
              {DATE_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Direction filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.keys(DIRECTION_FILTER_LABELS) as DirectionFilter[]).map(
            (key) => (
              <button
                key={key}
                onClick={() => setDirectionFilter(key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                  directionFilter === key
                    ? "bg-[#861A22] text-white"
                    : "bg-[#F3F4F6] text-[#6B7280] active:bg-[#E5E7EB]"
                }`}
              >
                {DIRECTION_FILTER_LABELS[key]}
              </button>
            )
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center py-16 gap-3">
          <EmptyIcon />
          <p className="text-[#9CA3AF] text-sm">
            No se encontraron movimientos
          </p>
        </div>
      ) : (
        <>
          {/* Movement cards */}
          <div className="space-y-3">
            {movements.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/movimientos/${m.id}`)}
                className="w-full bg-white rounded-xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform touch-manipulation"
                style={{ border: "1px solid #E5E7EB" }}
              >
                {/* Top row: direction badge + date */}
                <div className="flex items-center justify-between mb-2">
                  <DirectionBadge direction={m.direction} />
                  <span className="text-sm text-[#6B7280]">
                    {formatDate(m.movement_date)}
                  </span>
                </div>

                {/* Middle row: item count + creator */}
                <p className="text-sm text-[#9CA3AF] mb-1.5">
                  {m.lines.length} articulo{m.lines.length !== 1 ? "s" : ""}{" "}
                  &middot; {m.creator_name || "Desconocido"}
                </p>

                {/* Bottom row: total + photo icon + time */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#1A1A1A]">
                    {formatCHF(m.total_cost)}
                  </span>
                  <div className="flex items-center gap-2">
                    {m.photo_filename && <CameraIcon />}
                    <span className="text-xs text-[#9CA3AF]">
                      {extractTime(m.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fetchMovements(false)}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-[#F3F4F6] text-[#6B7280] rounded-xl text-sm font-medium active:bg-[#E5E7EB] transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#6B7280] border-t-transparent rounded-full animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  "Cargar mas"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MovimientosPage() {
  return (
    <AppShell>
      {() => <MovimientosContent />}
    </AppShell>
  );
}
