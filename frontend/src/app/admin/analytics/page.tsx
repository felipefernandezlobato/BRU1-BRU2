"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { BarChart } from "@/components/charts/BarChart";
import { DoughnutChart } from "@/components/charts/DoughnutChart";

interface MonthlyData {
  year: number;
  month: number;
  total_cost: number;
  count: number;
}

interface CategoryData {
  category: string;
  total: number;
}

interface DirectionData {
  direction: string;
  total_cost: number;
  count: number;
}

const PERIOD_OPTIONS = [
  { label: "Ultimos 3 meses", months: 3 },
  { label: "Ultimos 6 meses", months: 6 },
  { label: "Ultimos 12 meses", months: 12 },
];

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function getDateRange(months: number): { start_date: string; end_date: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start_date: fmt(start), end_date: fmt(end) };
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [months, setMonths] = useState(3);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [directionData, setDirectionData] = useState<DirectionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateRange(months);
      const [monthly, categories, direction] = await Promise.all([
        apiFetch<MonthlyData[]>(`/api/analytics/monthly?months=${months}`),
        apiFetch<CategoryData[]>(`/api/analytics/categories?start_date=${start_date}&end_date=${end_date}`),
        apiFetch<DirectionData[]>(`/api/analytics/direction?start_date=${start_date}&end_date=${end_date}`),
      ]);
      setMonthlyData(monthly);
      setCategoryData(categories);
      setDirectionData(direction);
    } catch {
      toast("Error al cargar analiticas", "error");
    } finally {
      setLoading(false);
    }
  }, [months, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const monthlyLabels = monthlyData.map((d) => {
    return MONTH_NAMES[d.month - 1] || `${d.month}`;
  });
  const monthlyValues = monthlyData.map((d) => d.total_cost);

  const catLabels = categoryData.map((d) => d.category);
  const catValues = categoryData.map((d) => d.total);

  const dirLabels = directionData.map((d) =>
    d.direction === "BRU1_TO_BRU2" ? "BRU1 → BRU2" : "BRU2 → BRU1"
  );
  const dirValues = directionData.map((d) => d.total_cost);

  return (
    <div className="p-4 space-y-6">
      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.months}
            onClick={() => setMonths(opt.months)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              months === opt.months
                ? "bg-[#861A22] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#9CA3AF]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Monthly cost bar chart */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
            <BarChart
              labels={monthlyLabels}
              data={monthlyValues}
              title="Coste mensual"
            />
          </div>

          {/* Category breakdown doughnut */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
            <DoughnutChart
              labels={catLabels}
              data={catValues}
              title="Distribucion por categoria"
            />
          </div>

          {/* Direction split */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
            <BarChart
              labels={dirLabels}
              data={dirValues}
              title="Direccion de movimientos"
              horizontal
              color="#861A22"
            />
          </div>
        </>
      )}
    </div>
  );
}
