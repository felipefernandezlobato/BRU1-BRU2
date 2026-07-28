"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { formatCHF } from "@/lib/format";
import { PersonnelCost } from "@/lib/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface FormData {
  year: number;
  month: number;
  total_paid: string;
  bru1_e2n: string;
  bru2_e2n: string;
  notes: string;
}

function PersonnelModal({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial?: FormData;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const now = new Date();
  const [form, setForm] = useState<FormData>(
    initial || {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      total_paid: "",
      bru1_e2n: "",
      bru2_e2n: "",
      notes: "",
    }
  );
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const tp = parseFloat(form.total_paid) || 0;
    const b1 = parseFloat(form.bru1_e2n) || 0;
    const b2 = parseFloat(form.bru2_e2n) || 0;
    const total = b1 + b2;
    if (total === 0) return { ratio: 0, bru2_cost: 0 };
    const ratio = b2 / total;
    return { ratio, bru2_cost: tp * ratio };
  }, [form.total_paid, form.bru1_e2n, form.bru2_e2n]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  const isValid =
    form.year > 0 &&
    form.month >= 1 &&
    form.month <= 12 &&
    parseFloat(form.total_paid) > 0 &&
    parseFloat(form.bru1_e2n) > 0 &&
    parseFloat(form.bru2_e2n) > 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h3 className="font-display text-lg text-[#1A1A1A]" style={{ fontStyle: "italic" }}>{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#6B7280] mb-1">Ano</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })}
                required
                min={2020}
                max={2099}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6B7280] mb-1">Mes</label>
              <select
                value={form.month}
                onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
              >
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Total pagado (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={form.total_paid}
              onChange={(e) => setForm({ ...form, total_paid: e.target.value })}
              required
              placeholder="0.00"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">BRU1 (E2N) (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={form.bru1_e2n}
              onChange={(e) => setForm({ ...form, bru1_e2n: e.target.value })}
              required
              placeholder="0.00"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">BRU2 (E2N) (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={form.bru2_e2n}
              onChange={(e) => setForm({ ...form, bru2_e2n: e.target.value })}
              required
              placeholder="0.00"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22] resize-none"
            />
          </div>

          {/* Live preview */}
          <div className="bg-[#F8F0F1] rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-[#861A22] uppercase tracking-wide mb-2">Vista previa</p>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Ratio BRU2:</span>
              <span className="font-semibold text-[#1A1A1A]">{(preview.ratio * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Coste BRU2:</span>
              <span className="font-bold text-[#861A22]">{formatCHF(preview.bru2_cost)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#E5E7EB] rounded-lg py-2.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !isValid}
              className="flex-1 bg-[#861A22] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PersonnelPage() {
  const toast = useToast();
  const [records, setRecords] = useState<PersonnelCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonnelCost | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await apiFetch<PersonnelCost[]>("/api/personnel/");
      setRecords(data);
    } catch {
      toast("Error al cargar datos de personal", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleCreate(form: FormData) {
    try {
      await apiFetch("/api/personnel/", {
        method: "POST",
        body: JSON.stringify({
          year: form.year,
          month: form.month,
          total_paid: parseFloat(form.total_paid),
          bru1_e2n: parseFloat(form.bru1_e2n),
          bru2_e2n: parseFloat(form.bru2_e2n),
          notes: form.notes || null,
        }),
      });
      toast("Registro guardado");
      setShowCreateModal(false);
      setEditingRecord(null);
      fetchRecords();
    } catch {
      toast("Error al guardar", "error");
    }
  }

  async function handleDelete(record: PersonnelCost) {
    if (!confirm(`Eliminar registro de ${MONTH_NAMES[record.month]} ${record.year}?`)) return;
    try {
      await apiFetch(`/api/personnel/${record.year}/${record.month}`, {
        method: "DELETE",
      });
      toast("Registro eliminado");
      fetchRecords();
    } catch {
      toast("Error al eliminar", "error");
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
          Costes de Personal
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#861A22] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6B151D] transition-colors"
        >
          Nuevo registro
        </button>
      </div>

      <div className="space-y-2">
        {records.length === 0 ? (
          <p className="text-center text-[#9CA3AF] py-10 text-sm">No hay registros de personal</p>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB]"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-bold text-[#1A1A1A]">
                  {MONTH_NAMES[record.month]} {record.year}
                </h3>
                <div className="bg-[#F8F0F1] px-2.5 py-1 rounded-lg">
                  <span className="text-sm font-bold text-[#861A22]">
                    {formatCHF(record.bru2_cost)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Total pagado:</span>
                  <span className="text-[#1A1A1A] font-medium">{formatCHF(record.total_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">Ratio:</span>
                  <span className="text-[#1A1A1A] font-medium">{(record.ratio * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">BRU1 (E2N):</span>
                  <span className="text-[#1A1A1A]">{formatCHF(record.bru1_e2n)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9CA3AF]">BRU2 (E2N):</span>
                  <span className="text-[#1A1A1A]">{formatCHF(record.bru2_e2n)}</span>
                </div>
              </div>

              {record.notes && (
                <p className="text-xs text-[#9CA3AF] mt-2 italic">{record.notes}</p>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F3F4F6]">
                <button
                  onClick={() => setEditingRecord(record)}
                  className="text-xs text-[#6B7280] hover:text-[#861A22] transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(record)}
                  className="text-xs text-[#9CA3AF] hover:text-red-600 transition-colors ml-auto"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <PersonnelModal
          title="Nuevo registro"
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit modal */}
      {editingRecord && (
        <PersonnelModal
          title="Editar registro"
          initial={{
            year: editingRecord.year,
            month: editingRecord.month,
            total_paid: editingRecord.total_paid.toString(),
            bru1_e2n: editingRecord.bru1_e2n.toString(),
            bru2_e2n: editingRecord.bru2_e2n.toString(),
            notes: editingRecord.notes || "",
          }}
          onSave={handleCreate}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}
