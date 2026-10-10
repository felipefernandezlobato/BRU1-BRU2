"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Setting } from "@/lib/types";
import { formatCHF } from "@/lib/format";

// Mirrors FIXED_COSTS in backend/app/services/fixed_costs.py — each cost is
// backed by three settings keys (amount / active / estimado).
const FIXED_COSTS = [
  { slug: "utilities", label: "Utilities", defaultAmount: "850.00", defaultEstimado: false },
  { slug: "sunrise", label: "Sunrise", defaultAmount: "50.00", defaultEstimado: true },
  { slug: "lightspeed", label: "Lightspeed", defaultAmount: "140.00", defaultEstimado: false },
  { slug: "transporte_sergio", label: "Transporte Sergio", defaultAmount: "700.00", defaultEstimado: true },
];

interface FixedCostForm {
  amount: string;
  active: boolean;
  estimado: boolean;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "t", "yes", "si"].includes(value.trim().toLowerCase());
}

// A blank or non-numeric amount must never be saved: the backend cannot parse it
// and would silently fall back to the hardcoded default, so clearing the field
// to type 0 would revert the cost to its full default instead.
function amountIsValid(value: string | undefined): boolean {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) && n >= 0;
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Local form values
  const [markup, setMarkup] = useState("");
  const [escandUrl, setEscandUrl] = useState("");
  const [fixed, setFixed] = useState<Record<string, FixedCostForm>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiFetch<Setting[]>("/api/settings");
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setMarkup(map["markup_pct"] || "0");
      setEscandUrl(map["escandallos_url"] || "");

      const nextFixed: Record<string, FixedCostForm> = {};
      FIXED_COSTS.forEach(({ slug, defaultAmount, defaultEstimado }) => {
        nextFixed[slug] = {
          amount: map[`cost_${slug}_amount`] || defaultAmount,
          active: asBool(map[`cost_${slug}_active`], true),
          estimado: asBool(map[`cost_${slug}_estimado`], defaultEstimado),
        };
      });
      setFixed(nextFixed);
    } catch {
      toast("Error al cargar ajustes", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(key: string, value: string) {
    setSavingKey(key);
    try {
      await apiFetch(`/api/settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      toast("Ajuste guardado");
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch {
      toast("Error al guardar ajuste", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveFixedCost(slug: string) {
    const form = fixed[slug];
    if (!form) return;
    if (!amountIsValid(form.amount)) {
      toast("Introduce un importe valido", "error");
      return;
    }
    setSavingKey(`cost_${slug}`);
    try {
      // One PUT per backing key; the settings API is single-key by design.
      await Promise.all([
        apiFetch(`/api/settings/cost_${slug}_amount`, {
          method: "PUT",
          body: JSON.stringify({ value: form.amount }),
        }),
        apiFetch(`/api/settings/cost_${slug}_active`, {
          method: "PUT",
          body: JSON.stringify({ value: String(form.active) }),
        }),
        apiFetch(`/api/settings/cost_${slug}_estimado`, {
          method: "PUT",
          body: JSON.stringify({ value: String(form.estimado) }),
        }),
      ]);
      toast("Coste guardado");
      setSettings((prev) => ({
        ...prev,
        [`cost_${slug}_amount`]: form.amount,
        [`cost_${slug}_active`]: String(form.active),
        [`cost_${slug}_estimado`]: String(form.estimado),
      }));
    } catch {
      // The three PUTs are independent, so one may have landed while another
      // failed. Pull server truth back in rather than leaving the form showing
      // values that were not all persisted.
      toast("Error al guardar coste", "error");
      fetchSettings();
    } finally {
      setSavingKey(null);
    }
  }

  function updateFixed(slug: string, patch: Partial<FixedCostForm>) {
    setFixed((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      await apiFetch("/api/sync/test", { method: "POST" });
      toast("Conexion exitosa");
    } catch {
      toast("Error de conexion", "error");
    } finally {
      setTesting(false);
    }
  }

  const activeCosts = FIXED_COSTS.filter(({ slug }) => fixed[slug]?.active);
  const sumOf = (list: typeof FIXED_COSTS) =>
    list.reduce((sum, { slug }) => sum + (parseFloat(fixed[slug]?.amount) || 0), 0);
  const totalFixed = sumOf(activeCosts);
  const totalConfirmado = sumOf(activeCosts.filter(({ slug }) => !fixed[slug]?.estimado));
  const totalEstimado = totalFixed - totalConfirmado;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="font-display text-xl text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
        Ajustes
      </h1>

      {/* Markup */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
          Markup (%)
        </label>
        <p className="text-xs text-[#9CA3AF] mb-3">
          Porcentaje de recargo aplicado al coste de los articulos
        </p>
        <div className="flex gap-3">
          <input
            type="number"
            step="0.1"
            min="0"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
          />
          <button
            onClick={() => handleSave("markup_pct", markup)}
            disabled={savingKey === "markup_pct"}
            className="bg-[#861A22] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors"
          >
            {savingKey === "markup_pct" ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Escandallos URL */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]">
        <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
          URL API Escandallos
        </label>
        <p className="text-xs text-[#9CA3AF] mb-3">
          URL del servicio de Escandallos para sincronizar costes
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            value={escandUrl}
            onChange={(e) => setEscandUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
          />
          <button
            onClick={() => handleSave("escandallos_url", escandUrl)}
            disabled={savingKey === "escandallos_url"}
            className="bg-[#861A22] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors shrink-0"
          >
            {savingKey === "escandallos_url" ? "Guardando..." : "Guardar"}
          </button>
        </div>
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="mt-3 border border-[#E5E7EB] text-[#6B7280] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
        >
          {testing ? "Probando..." : "Probar conexion"}
        </button>
      </div>

      {/* Fixed monthly BRU2 costs */}
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
            Costes fijos BRU2
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Gastos mensuales fijos de BRU2. Se aplican desde la apertura
            (febrero 2026 a media mensualidad, completo desde marzo)
          </p>
        </div>

        {FIXED_COSTS.map(({ slug, label }) => {
          const form = fixed[slug];
          if (!form) return null;
          const saving = savingKey === `cost_${slug}`;
          return (
            <div
              key={slug}
              className={`bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB] ${
                form.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-[#1A1A1A]">{label}</label>
                {form.estimado && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
                    Estimado
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF] pointer-events-none">
                    CHF
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => updateFixed(slug, { amount: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-lg pl-12 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
                  />
                </div>
                <button
                  onClick={() => handleSaveFixedCost(slug)}
                  disabled={saving || !amountIsValid(form.amount)}
                  className="bg-[#861A22] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors shrink-0"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>

              <div className="flex gap-5 mt-3">
                <label className="flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateFixed(slug, { active: e.target.checked })}
                    className="w-4 h-4 accent-[#861A22]"
                  />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.estimado}
                    onChange={(e) => updateFixed(slug, { estimado: e.target.checked })}
                    className="w-4 h-4 accent-[#861A22]"
                  />
                  Estimado
                </label>
              </div>
            </div>
          );
        })}

        {/* Live total */}
        <div className="bg-[#F8F0F1] rounded-xl p-4 border border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#1A1A1A]">Total mensual</span>
            <span className="text-sm font-bold text-[#861A22]">{formatCHF(totalFixed)}</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Confirmado</span>
              <span>{formatCHF(totalConfirmado)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Estimado</span>
              <span>{formatCHF(totalEstimado)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
