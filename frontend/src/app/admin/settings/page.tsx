"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Setting } from "@/lib/types";

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Local form values
  const [markup, setMarkup] = useState("");
  const [escandUrl, setEscandUrl] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiFetch<Setting[]>("/api/settings");
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setMarkup(map["markup_pct"] || "0");
      setEscandUrl(map["escandallos_url"] || "");
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
    </div>
  );
}
