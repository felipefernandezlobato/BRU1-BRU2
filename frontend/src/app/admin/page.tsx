"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { formatCHF } from "@/lib/format";
import { AnalyticsSummary, PersonnelCost } from "@/lib/types";

function ChangeBadge({ pct, invertColor }: { pct: number; invertColor?: boolean }) {
  const isNeg = pct < 0;
  // For cost, down is good (green), up is bad (red)
  // invertColor flips that logic
  const isGood = invertColor ? !isNeg : isNeg;
  const bgColor = isGood ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
  const arrow = isNeg ? (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ) : (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${bgColor}`}>
      {arrow}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function AdminDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [personnelCost, setPersonnelCost] = useState<PersonnelCost | null>(null);
  const [personnelLoaded, setPersonnelLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<AnalyticsSummary>("/api/analytics/summary");
      setSummary(data);
    } catch {
      toast("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }

    // Fetch current month personnel cost (separate, non-blocking)
    try {
      const now = new Date();
      const pc = await apiFetch<PersonnelCost>(`/api/personnel/${now.getFullYear()}/${now.getMonth() + 1}`);
      setPersonnelCost(pc);
    } catch {
      // 404 or error — no record for this month
    } finally {
      setPersonnelLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 text-center text-[#9CA3AF] text-sm py-16">
        No se pudieron cargar los datos
      </div>
    );
  }

  const maxCost = summary.top_items_by_cost.length > 0
    ? Math.max(...summary.top_items_by_cost.map((i) => i.total))
    : 1;
  const maxQty = summary.top_items_by_quantity.length > 0
    ? Math.max(...summary.top_items_by_quantity.map((i) => i.total))
    : 1;

  const sortedCategories = [...summary.category_comparison].sort(
    (a, b) => b.current - a.current
  );

  return (
    <div className="p-4 space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
            Coste este mes
          </p>
          <p className="text-xl font-bold text-[#1A1A1A] mt-1">
            {formatCHF(summary.current_month_cost)}
          </p>
          <div className="mt-2">
            <ChangeBadge pct={summary.cost_change_pct} />
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
            Movimientos
          </p>
          <p className="text-xl font-bold text-[#1A1A1A] mt-1">
            {summary.current_month_count}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-2">
            Mes anterior: {summary.previous_month_count}
          </p>
        </div>
      </div>

      {/* Markup profit card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
          BENEFICIO PRODUCCION
        </p>
        <p className="text-xl font-bold text-[#1A1A1A] mt-1">
          {formatCHF(summary.current_month_markup)}
        </p>
        <div className="mt-2">
          <ChangeBadge pct={summary.markup_change_pct} invertColor />
        </div>
        <p className="text-xs text-[#9CA3AF] mt-2">
          Markup sobre articulos producidos
        </p>
      </div>

      {/* Personnel BRU2 card */}
      {personnelLoaded && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
          <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">
            Personal BRU2 este mes
          </p>
          {personnelCost ? (
            <>
              <p className="text-xl font-bold text-[#861A22] mt-1">
                {formatCHF(personnelCost.bru2_cost)}
              </p>
              <p className="text-xs text-[#9CA3AF] mt-2">
                Ratio: {(personnelCost.ratio * 100).toFixed(1)}% &middot; Total pagado: {formatCHF(personnelCost.total_paid)}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#9CA3AF] mt-1">
              Sin registro de personal este mes
            </p>
          )}
        </div>
      )}

      {/* Top items by cost */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <h2 className="font-display text-lg text-[#1A1A1A] mb-4" style={{ fontStyle: "italic" }}>
          Top articulos por coste
        </h2>
        <div className="space-y-3">
          {summary.top_items_by_cost.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#1A1A1A] font-medium truncate mr-2">
                  {item.name}
                </span>
                <span className="text-sm text-[#6B7280] font-semibold shrink-0">
                  {formatCHF(item.total)}
                </span>
              </div>
              <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                <div
                  className="bg-[#861A22] h-2 rounded-full progress-fill"
                  style={{ width: `${(item.total / maxCost) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {summary.top_items_by_cost.length === 0 && (
            <p className="text-sm text-[#9CA3AF] text-center py-4">Sin datos</p>
          )}
        </div>
      </div>

      {/* Top items by quantity */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <h2 className="font-display text-lg text-[#1A1A1A] mb-4" style={{ fontStyle: "italic" }}>
          Top articulos por cantidad
        </h2>
        <div className="space-y-3">
          {summary.top_items_by_quantity.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#1A1A1A] font-medium truncate mr-2">
                  {item.name}
                </span>
                <span className="text-sm text-[#6B7280] font-semibold shrink-0">
                  {item.total}
                </span>
              </div>
              <div className="w-full bg-[#F3F4F6] rounded-full h-2">
                <div
                  className="bg-[#D4C3A5] h-2 rounded-full progress-fill"
                  style={{ width: `${(item.total / maxQty) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {summary.top_items_by_quantity.length === 0 && (
            <p className="text-sm text-[#9CA3AF] text-center py-4">Sin datos</p>
          )}
        </div>
      </div>

      {/* Category comparison */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <h2 className="font-display text-lg text-[#1A1A1A] mb-4" style={{ fontStyle: "italic" }}>
          Comparacion por categoria
        </h2>
        {sortedCategories.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-4">Sin datos</p>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 font-medium text-[#6B7280]">Categoria</th>
                  <th className="text-right py-2 font-medium text-[#6B7280]">Este mes</th>
                  <th className="text-right py-2 font-medium text-[#6B7280]">Mes anterior</th>
                  <th className="text-right py-2 font-medium text-[#6B7280]">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((cat) => {
                  const isUp = cat.change_pct > 0;
                  const isDown = cat.change_pct < 0;
                  return (
                    <tr key={cat.category} className="border-b border-[#F3F4F6]">
                      <td className="py-2.5 text-[#1A1A1A] font-medium">{cat.category}</td>
                      <td className="py-2.5 text-right text-[#1A1A1A]">{formatCHF(cat.current)}</td>
                      <td className="py-2.5 text-right text-[#9CA3AF]">{formatCHF(cat.previous)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isUp ? "text-red-600" : isDown ? "text-green-600" : "text-[#9CA3AF]"
                        }`}>
                          {isUp && (
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          )}
                          {isDown && (
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                          {cat.change_pct === 0 ? "—" : `${Math.abs(cat.change_pct).toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
