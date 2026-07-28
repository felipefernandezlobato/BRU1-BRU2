"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { formatCHF } from "@/lib/format";
import { Item, Category } from "@/lib/types";

const UNIT_OPTIONS = ["kg", "g", "mg", "litro", "ml", "cl", "unidad"];

interface ItemFormData {
  name: string;
  category_id: number;
  unit: string;
  cost_per_unit: number;
  is_produced: boolean;
  escandallos_name: string;
}

interface SyncPreview {
  name: string;
  current_cost: number;
  new_cost: number;
}

function PencilIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ItemModal({
  title,
  categories,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  categories: Category[];
  initial?: ItemFormData;
  onSave: (data: ItemFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemFormData>(
    initial || {
      name: "",
      category_id: categories[0]?.id || 0,
      unit: "kg",
      cost_per_unit: 0,
      is_produced: false,
      escandallos_name: "",
    }
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

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
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Categoria</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Unidad</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Coste por unidad</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cost_per_unit}
              onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })}
              required
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_produced"
              checked={form.is_produced}
              onChange={(e) => setForm({ ...form, is_produced: e.target.checked })}
              className="w-4 h-4 accent-[#861A22]"
            />
            <label htmlFor="is_produced" className="text-sm text-[#6B7280]">Producido</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">Nombre en Escandallos (opcional)</label>
            <input
              type="text"
              value={form.escandallos_name}
              onChange={(e) => setForm({ ...form, escandallos_name: e.target.value })}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
            />
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
              disabled={saving || !form.name}
              className="flex-1 bg-[#861A22] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : initial ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SyncModal({
  previews,
  onConfirm,
  onClose,
}: {
  previews: SyncPreview[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h3 className="font-display text-lg text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
            Sincronizar con Escandallos
          </h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4">
          {previews.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-4">No hay cambios de coste</p>
          ) : (
            <div className="space-y-2 mb-4">
              {previews.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm border-b border-[#F3F4F6] py-2">
                  <span className="text-[#1A1A1A] font-medium truncate mr-2">{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[#9CA3AF] line-through">{formatCHF(p.current_cost)}</span>
                    <span className="text-[#1A1A1A] font-semibold">{formatCHF(p.new_cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-[#E5E7EB] rounded-lg py-2.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancelar
            </button>
            {previews.length > 0 && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 bg-[#861A22] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors"
              >
                {confirming ? "Aplicando..." : "Aplicar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editCostValue, setEditCostValue] = useState("");
  const [syncPreviews, setSyncPreviews] = useState<SyncPreview[] | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [itemsData, catsData] = await Promise.all([
        apiFetch<Item[]>("/api/items"),
        apiFetch<Category[]>("/api/categories"),
      ]);
      setItems(itemsData);
      setCategories(catsData.filter((c) => c.is_active));
    } catch {
      toast("Error al cargar articulos", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => {
    if (!showInactive && !item.is_active) return false;
    if (filterCategory !== "all" && item.category_id !== filterCategory) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleCreateItem(data: ItemFormData) {
    try {
      await apiFetch("/api/items", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast("Articulo creado");
      setShowCreateModal(false);
      fetchData();
    } catch {
      toast("Error al crear articulo", "error");
    }
  }

  async function handleEditItem(data: ItemFormData) {
    if (!editingItem) return;
    try {
      await apiFetch(`/api/items/${editingItem.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      toast("Articulo actualizado");
      setEditingItem(null);
      fetchData();
    } catch {
      toast("Error al actualizar articulo", "error");
    }
  }

  async function handleDeactivate(item: Item) {
    if (!confirm(`Desactivar "${item.name}"?`)) return;
    try {
      await apiFetch(`/api/items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: false }),
      });
      toast("Articulo desactivado");
      fetchData();
    } catch {
      toast("Error al desactivar", "error");
    }
  }

  async function handleSaveCost(itemId: number) {
    const cost = parseFloat(editCostValue);
    if (isNaN(cost) || cost < 0) return;
    try {
      await apiFetch(`/api/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ cost_per_unit: cost }),
      });
      toast("Coste actualizado");
      setEditingCostId(null);
      fetchData();
    } catch {
      toast("Error al actualizar coste", "error");
    }
  }

  async function handleSync() {
    try {
      const previews = await apiFetch<SyncPreview[]>("/api/sync/escandallos", {
        method: "POST",
      });
      setSyncPreviews(previews);
    } catch {
      toast("Error al sincronizar", "error");
    }
  }

  async function handleConfirmSync() {
    try {
      const result = await apiFetch<{ updated: number }>("/api/sync/confirm", {
        method: "POST",
      });
      toast(`${result.updated} costes actualizados`);
      setSyncPreviews(null);
      fetchData();
    } catch {
      toast("Error al aplicar cambios", "error");
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
          Articulos
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="border border-[#E5E7EB] text-[#6B7280] px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
          >
            Sincronizar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#861A22] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6B151D] transition-colors"
          >
            Nuevo articulo
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Buscar articulos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
        />
        <div className="flex gap-3 items-center">
          <select
            value={filterCategory === "all" ? "all" : filterCategory}
            onChange={(e) => setFilterCategory(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
          >
            <option value="all">Todas las categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[#6B7280] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 accent-[#861A22]"
            />
            Mostrar inactivos
          </label>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <p className="text-center text-[#9CA3AF] py-10 text-sm">
            No se encontraron articulos
          </p>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB] ${!item.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1A1A1A]">{item.name}</span>
                    {item.category_name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F3F4F6] text-[#6B7280]">
                        {item.category_name}
                      </span>
                    )}
                    {item.is_produced && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                        Producido
                      </span>
                    )}
                    {!item.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-1">Unidad: {item.unit}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {editingCostId === item.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={editCostValue}
                        onChange={(e) => setEditCostValue(e.target.value)}
                        className="w-20 border border-[#E5E7EB] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#861A22]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCost(item.id);
                          if (e.key === "Escape") setEditingCostId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveCost(item.id)}
                        className="text-green-600 hover:text-green-700 p-1"
                        aria-label="Guardar coste"
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditingCostId(null)}
                        className="text-[#9CA3AF] hover:text-[#6B7280] p-1"
                        aria-label="Cancelar"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingCostId(item.id);
                        setEditCostValue(item.cost_per_unit.toString());
                      }}
                      className="flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                      title="Editar coste"
                    >
                      <span className="font-semibold">{formatCHF(item.cost_per_unit)}</span>
                      <PencilIcon />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F3F4F6]">
                <button
                  onClick={() => setEditingItem(item)}
                  className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#861A22] transition-colors"
                >
                  <PencilIcon />
                  Editar
                </button>
                {item.is_active && (
                  <button
                    onClick={() => handleDeactivate(item)}
                    className="text-xs text-[#9CA3AF] hover:text-red-600 transition-colors ml-auto"
                  >
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <ItemModal
          title="Nuevo articulo"
          categories={categories}
          onSave={handleCreateItem}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit modal */}
      {editingItem && (
        <ItemModal
          title="Editar articulo"
          categories={categories}
          initial={{
            name: editingItem.name,
            category_id: editingItem.category_id,
            unit: editingItem.unit,
            cost_per_unit: editingItem.cost_per_unit,
            is_produced: editingItem.is_produced,
            escandallos_name: editingItem.escandallos_name || "",
          }}
          onSave={handleEditItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Sync modal */}
      {syncPreviews !== null && (
        <SyncModal
          previews={syncPreviews}
          onConfirm={handleConfirmSync}
          onClose={() => setSyncPreviews(null)}
        />
      )}
    </div>
  );
}
