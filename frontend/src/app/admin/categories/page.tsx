"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Category } from "@/lib/types";

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch<Category[]>("/api/categories");
      setCategories(data.sort((a, b) => a.position - b.position));
    } catch {
      toast("Error al cargar categorias", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleSaveEdit(id: number) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      toast("Categoria actualizada");
      setEditingId(null);
      fetchCategories();
    } catch {
      toast("Error al actualizar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          position: categories.length + 1,
        }),
      });
      toast("Categoria creada");
      setAddingNew(false);
      setNewName("");
      fetchCategories();
    } catch {
      toast("Error al crear categoria", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(cat: Category) {
    if (!confirm(`Desactivar categoria "${cat.name}"?`)) return;
    try {
      await apiFetch(`/api/categories/${cat.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: false }),
      });
      toast("Categoria desactivada");
      fetchCategories();
    } catch {
      toast("Error al desactivar", "error");
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
          Categorias
        </h1>
        <button
          onClick={() => setAddingNew(true)}
          className="bg-[#861A22] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6B151D] transition-colors"
        >
          Nueva categoria
        </button>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB] flex items-center gap-3 ${!cat.is_active ? "opacity-60" : ""}`}
          >
            <span className="text-xs text-[#9CA3AF] font-mono w-6 shrink-0 text-center">
              {cat.position}
            </span>

            {editingId === cat.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleSaveEdit(cat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(cat.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 border border-[#E5E7EB] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#861A22]"
                autoFocus
                disabled={saving}
              />
            ) : (
              <button
                onClick={() => {
                  setEditingId(cat.id);
                  setEditName(cat.name);
                }}
                className="flex-1 text-left text-sm font-medium text-[#1A1A1A] hover:text-[#861A22] transition-colors"
              >
                {cat.name}
              </button>
            )}

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                cat.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}
            >
              {cat.is_active ? "Activa" : "Inactiva"}
            </span>

            {cat.is_active && (
              <button
                onClick={() => handleDeactivate(cat)}
                className="text-xs text-[#9CA3AF] hover:text-red-600 transition-colors shrink-0"
              >
                Desactivar
              </button>
            )}
          </div>
        ))}

        {/* Add new row */}
        {addingNew && (
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-dashed border-[#861A22]/30 flex items-center gap-3">
            <span className="text-xs text-[#9CA3AF] font-mono w-6 shrink-0 text-center">
              {categories.length + 1}
            </span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setAddingNew(false);
                  setNewName("");
                }
              }}
              placeholder="Nombre de la categoria..."
              className="flex-1 border border-[#E5E7EB] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#861A22]"
              autoFocus
              disabled={saving}
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="text-sm font-medium text-[#861A22] hover:text-[#6B151D] disabled:opacity-50 transition-colors"
            >
              {saving ? "Creando..." : "Guardar"}
            </button>
            <button
              onClick={() => {
                setAddingNew(false);
                setNewName("");
              }}
              className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {categories.length === 0 && !addingNew && (
          <p className="text-center text-[#9CA3AF] py-10 text-sm">
            No hay categorias
          </p>
        )}
      </div>
    </div>
  );
}
