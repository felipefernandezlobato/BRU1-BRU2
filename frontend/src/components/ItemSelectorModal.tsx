"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { formatCHF } from "@/lib/format";
import { Category, Item } from "@/lib/types";

interface ItemSelectorModalProps {
  items: Item[];
  categories: Category[];
  onSelect: (item: Item, qty: number) => void;
  onClose: () => void;
}

export function ItemSelectorModal({
  items,
  categories,
  onSelect,
  onClose,
}: ItemSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  useEffect(() => {
    if (selectedItem && qtyInputRef.current) qtyInputRef.current.focus();
  }, [selectedItem]);

  const filtered = useMemo(() => {
    const strip = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const words = strip(search).split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (catFilter !== null && it.category_id !== catFilter) return false;
      if (words.length > 0) {
        const name = strip(it.name);
        if (!words.every((w) => name.includes(w))) return false;
      }
      return true;
    });
  }, [items, catFilter, search]);

  function handleConfirm() {
    if (!selectedItem) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    onSelect(selectedItem, qty);
  }

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
              onClick={() => { setSelectedItem(null); setQuantity(""); }}
              className="text-[#861A22] text-sm font-medium min-w-[44px] min-h-[44px] flex items-center"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver
            </button>
            <button onClick={onClose} className="text-[#9CA3AF] min-w-[44px] min-h-[44px] flex items-center justify-end" aria-label="Cerrar">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="text-center mb-5">
            <p className="text-lg font-semibold text-[#1A1A1A]">{selectedItem.name}</p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              {selectedItem.category_name || ""} &middot; {formatCHF(selectedItem.cost_per_unit)}/{selectedItem.unit}
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
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              className="w-full px-4 py-3 text-lg rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22] text-center"
              placeholder="0.00"
            />
          </div>

          {quantity && parseFloat(quantity) > 0 && (
            <p className="text-center text-sm text-[#6B7280] mb-4">
              Coste linea: <span className="font-semibold text-[#1A1A1A]">{formatCHF(parseFloat(quantity) * selectedItem.cost_per_unit)}</span>
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
        <div className="p-4 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-[#1A1A1A]" style={{ fontStyle: "italic" }}>
              Seleccionar articulo
            </h3>
            <button onClick={onClose} className="text-[#9CA3AF] min-w-[44px] min-h-[44px] flex items-center justify-end" aria-label="Cerrar">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx={11} cy={11} r={8} />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
              placeholder="Buscar articulo..."
            />
          </div>

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
                onClick={() => setCatFilter(catFilter === cat.id ? null : cat.id)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px]"
                style={{
                  backgroundColor: catFilter === cat.id ? "#861A22" : "#F3F4F6",
                  color: catFilter === cat.id ? "#FFFFFF" : "#6B7280",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[#9CA3AF] py-10 text-sm">No se encontraron articulos</p>
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
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">{it.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#9CA3AF]">{it.category_name || ""}</span>
                        <span className="text-xs text-[#9CA3AF]">&middot; {it.unit}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-[#861A22] shrink-0">{formatCHF(it.cost_per_unit)}</span>
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
