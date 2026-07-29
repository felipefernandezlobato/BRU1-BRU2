"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { formatCHF } from "@/lib/format";
import { Category, Item, Movement } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineItem {
  item: Item;
  quantity: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/*  Item Selector Modal                                                */
/* ------------------------------------------------------------------ */

function ItemSelectorModal({
  items,
  categories,
  onSelect,
  onClose,
}: {
  items: Item[];
  categories: Category[];
  onSelect: (item: Item, qty: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Focus quantity input when an item is selected
  useEffect(() => {
    if (selectedItem && qtyInputRef.current) {
      qtyInputRef.current.focus();
    }
  }, [selectedItem]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (catFilter !== null && it.category_id !== catFilter) return false;
      if (search && !it.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [items, catFilter, search]);

  function handleConfirm() {
    if (!selectedItem) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    onSelect(selectedItem, qty);
  }

  // Quantity entry sub-view
  if (selectedItem) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[60vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setSelectedItem(null);
                setQuantity("");
              }}
              className="text-[#861A22] text-sm font-medium min-w-[44px] min-h-[44px] flex items-center"
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver
            </button>
            <button
              onClick={onClose}
              className="text-[#9CA3AF] min-w-[44px] min-h-[44px] flex items-center justify-end"
              aria-label="Cerrar"
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="text-center mb-5">
            <p className="text-lg font-semibold text-[#1A1A1A]">
              {selectedItem.name}
            </p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              {selectedItem.category_name || ""} &middot;{" "}
              {formatCHF(selectedItem.cost_per_unit)}/{selectedItem.unit}
            </p>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-[#6B7280] mb-1.5">
              Cantidad ({selectedItem.unit})
            </label>
            <input
              ref={qtyInputRef}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              className="w-full px-4 py-3 text-lg rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22] text-center"
              placeholder="0.00"
            />
          </div>

          {quantity && parseFloat(quantity) > 0 && (
            <p className="text-center text-sm text-[#6B7280] mb-4">
              Coste linea:{" "}
              <span className="font-semibold text-[#1A1A1A]">
                {formatCHF(parseFloat(quantity) * selectedItem.cost_per_unit)}
              </span>
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!quantity || parseFloat(quantity) <= 0}
            className="w-full py-3 rounded-xl text-white font-semibold text-base disabled:opacity-40 active:scale-[0.98] transition-transform touch-manipulation"
            style={{ backgroundColor: "#861A22" }}
          >
            Anadir
          </button>
        </div>
      </div>
    );
  }

  // Main item list view
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between mb-3">
            <h3
              className="font-display text-lg text-[#1A1A1A]"
              style={{ fontStyle: "italic" }}
            >
              Seleccionar articulo
            </h3>
            <button
              onClick={onClose}
              className="text-[#9CA3AF] min-w-[44px] min-h-[44px] flex items-center justify-end"
              aria-label="Cerrar"
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx={11} cy={11} r={8} />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
              placeholder="Buscar articulo..."
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setCatFilter(null)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px]"
              style={{
                backgroundColor: catFilter === null ? "#861A22" : "#F3F4F6",
                color: catFilter === null ? "#FFFFFF" : "#6B7280",
              }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setCatFilter(catFilter === cat.id ? null : cat.id)
                }
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px]"
                style={{
                  backgroundColor:
                    catFilter === cat.id ? "#861A22" : "#F3F4F6",
                  color: catFilter === cat.id ? "#FFFFFF" : "#6B7280",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Item list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[#9CA3AF] py-10 text-sm">
              No se encontraron articulos
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSelectedItem(it)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-[#F3F4F6] active:bg-[#E5E7EB] transition-colors touch-manipulation"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">
                        {it.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#9CA3AF]">
                          {it.category_name || ""}
                        </span>
                        <span className="text-xs text-[#9CA3AF]">
                          &middot; {it.unit}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-[#861A22] shrink-0">
                      {formatCHF(it.cost_per_unit)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Form Content                                                  */
/* ------------------------------------------------------------------ */

function NewMovementContent() {
  const router = useRouter();
  const toast = useToast();

  // Data
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Restore form state from sessionStorage
  const DRAFT_KEY = "bru_movement_draft";
  const savedDraft = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form state
  const [direction, setDirection] = useState<"BRU1_TO_BRU2" | "BRU2_TO_BRU1">(
    savedDraft?.direction || "BRU1_TO_BRU2"
  );
  const [movementDate, setMovementDate] = useState(savedDraft?.movementDate || getTodayISO());
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState(savedDraft?.notes || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const draftRestoredRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch items and categories
  useEffect(() => {
    async function loadData() {
      try {
        const [itemsData, catsData] = await Promise.all([
          apiFetch<Item[]>("/api/items"),
          apiFetch<Category[]>("/api/categories"),
        ]);
        setItems(itemsData.filter((i) => i.is_active));
        setCategories(catsData.filter((c) => c.is_active));
      } catch {
        toast("Error al cargar datos", "error");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [toast]);

  // Restore draft lines once items are loaded
  useEffect(() => {
    if (draftRestoredRef.current || !savedDraft?.lines?.length || items.length === 0) return;
    draftRestoredRef.current = true;
    const restored: LineItem[] = [];
    for (const dl of savedDraft.lines) {
      const item = items.find((i) => i.id === dl.item_id);
      if (item) restored.push({ item, quantity: dl.quantity });
    }
    if (restored.length > 0) setLines(restored);
  }, [items, savedDraft]);

  // Save draft to sessionStorage on changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lines.length === 0 && !notes) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft = {
      direction,
      movementDate,
      notes,
      lines: lines.map((l) => ({ item_id: l.item.id, quantity: l.quantity })),
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [direction, movementDate, lines, notes, DRAFT_KEY]);

  // Warn before leaving with unsaved data
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (lines.length > 0) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lines]);

  // Running total
  const runningTotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + l.quantity * l.item.cost_per_unit,
        0
      ),
    [lines]
  );

  // Add item
  const handleAddItem = useCallback((item: Item, qty: number) => {
    setLines((prev) => {
      // If same item already exists, add to its quantity
      const existing = prev.findIndex((l) => l.item.id === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + qty,
        };
        return updated;
      }
      return [...prev, { item, quantity: qty }];
    });
    setShowItemSelector(false);
  }, []);

  // Remove item
  const handleRemoveLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Photo handling
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Submit
  async function handleSubmit() {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      // Build payload
      const payload = {
        direction,
        movement_date: movementDate,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          item_id: l.item.id,
          quantity: l.quantity,
          unit: l.item.unit,
        })),
      };

      const movement = await apiFetch<Movement>("/api/movements", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Upload photo if present
      if (photo) {
        try {
          const formData = new FormData();
          formData.append("photo", photo);

          const token = localStorage.getItem("bru_movements_token");
          const API_BASE =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";

          await fetch(`${API_BASE}/api/movements/${movement.id}/photo`, {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
          });
        } catch {
          // Photo upload failed but movement was created
          toast("Movimiento creado, pero error al subir foto", "error");
          router.push("/");
          return;
        }
      }

      sessionStorage.removeItem(DRAFT_KEY);
      toast("Movimiento registrado", "success");
      router.push("/");
    } catch {
      toast("Error al registrar movimiento", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-9 h-9 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Title */}
      <h1
        className="font-display text-2xl text-[#1A1A1A]"
        style={{ fontStyle: "italic" }}
      >
        Nuevo Movimiento
      </h1>

      {/* Direction toggle */}
      <div>
        <label className="block text-sm font-medium text-[#6B7280] mb-2">
          Direccion
        </label>
        <div className="flex rounded-xl overflow-hidden border border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => setDirection("BRU1_TO_BRU2")}
            className="flex-1 py-3 text-sm font-semibold transition-colors min-h-[44px]"
            style={{
              backgroundColor:
                direction === "BRU1_TO_BRU2" ? "#861A22" : "#F3F4F6",
              color: direction === "BRU1_TO_BRU2" ? "#FFFFFF" : "#6B7280",
            }}
          >
            BRU1 → BRU2
          </button>
          <button
            type="button"
            onClick={() => setDirection("BRU2_TO_BRU1")}
            className="flex-1 py-3 text-sm font-semibold transition-colors min-h-[44px]"
            style={{
              backgroundColor:
                direction === "BRU2_TO_BRU1" ? "#861A22" : "#F3F4F6",
              color: direction === "BRU2_TO_BRU1" ? "#FFFFFF" : "#6B7280",
            }}
          >
            BRU2 → BRU1
          </button>
        </div>
      </div>

      {/* Date picker */}
      <div>
        <label
          htmlFor="movement-date"
          className="block text-sm font-medium text-[#6B7280] mb-1.5"
        >
          Fecha
        </label>
        <input
          id="movement-date"
          type="date"
          value={movementDate}
          onChange={(e) => setMovementDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
        />
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-display text-lg text-[#1A1A1A]"
            style={{ fontStyle: "italic" }}
          >
            Articulos
          </h2>
          <span className="text-xs text-[#9CA3AF]">
            {lines.length} {lines.length === 1 ? "articulo" : "articulos"}
          </span>
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={() => setShowItemSelector(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-[#861A22]/40 text-[#861A22] font-medium text-sm flex items-center justify-center gap-2 active:bg-[#861A22]/5 transition-colors min-h-[44px] touch-manipulation"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Anadir articulo
        </button>

        {/* Line items list */}
        {lines.length > 0 && (
          <div className="mt-3 space-y-2">
            {lines.map((line, idx) => (
              <div
                key={`${line.item.id}-${idx}`}
                className="bg-white rounded-xl p-3 border border-[#E5E7EB] flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">
                    {line.item.name}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {line.quantity} {line.item.unit} &times;{" "}
                    {formatCHF(line.item.cost_per_unit)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#1A1A1A] shrink-0">
                  {formatCHF(line.quantity * line.item.cost_per_unit)}
                </p>
                <button
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  className="text-[#9CA3AF] hover:text-red-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                  aria-label={`Eliminar ${line.item.name}`}
                >
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Running total */}
            <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between px-1">
              <span className="text-sm font-medium text-[#6B7280]">
                Subtotal
              </span>
              <span className="text-base font-bold text-[#1A1A1A]">
                {formatCHF(runningTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="movement-notes"
          className="block text-sm font-medium text-[#6B7280] mb-1.5"
        >
          Notas
        </label>
        <textarea
          id="movement-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22] resize-none"
          placeholder="Notas opcionales..."
        />
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-[#6B7280] mb-1.5">
          Foto
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {photoPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Vista previa"
              className="w-full h-48 object-cover rounded-xl border border-[#E5E7EB]"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
              aria-label="Eliminar foto"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 rounded-xl border border-[#E5E7EB] text-[#6B7280] text-sm flex items-center justify-center gap-2 active:bg-[#F3F4F6] transition-colors min-h-[44px] touch-manipulation"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx={12} cy={13} r={4} />
            </svg>
            Adjuntar foto
          </button>
        )}
      </div>

      {/* Submit */}
      <div className="sticky bottom-20 bg-[#FAFAFA] pt-3 pb-2 -mx-4 px-4 border-t border-[#E5E7EB]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold text-[#1A1A1A]">Total</span>
          <span className="text-xl font-bold text-[#1A1A1A]">
            {formatCHF(runningTotal)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={lines.length === 0 || submitting}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-40 active:scale-[0.98] transition-transform touch-manipulation flex items-center justify-center gap-2"
          style={{ backgroundColor: "#861A22" }}
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registrando...
            </>
          ) : (
            "Registrar Movimiento"
          )}
        </button>
      </div>

      {/* Item selector modal */}
      {showItemSelector && (
        <ItemSelectorModal
          items={items}
          categories={categories}
          onSelect={handleAddItem}
          onClose={() => setShowItemSelector(false)}
        />
      )}
    </div>
  );
}

export default function NewMovementPage() {
  return (
    <AppShell>
      {() => <NewMovementContent />}
    </AppShell>
  );
}
