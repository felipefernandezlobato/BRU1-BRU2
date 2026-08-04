"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Movement, MovementLine, User } from "@/lib/types";
import { formatCHF } from "@/lib/format";

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

function directionLabel(direction: string): string {
  return direction === "BRU1_TO_BRU2" ? "BRU1 → BRU2" : "BRU2 → BRU1";
}

function BackArrow() {
  return (
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
      <line x1={19} y1={12} x2={5} y2={12} />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function canEditOrDelete(user: User, movement: Movement): boolean {
  if (user.role === "admin") return true;
  if (user.id !== movement.created_by) return false;
  const created = new Date(movement.created_at).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return now - created < twentyFourHours;
}

function formatTimeFromISO(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function MovimientoDetailContent({ user }: { user: User }) {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const id = params.id as string;

  const [movement, setMovement] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editDirection, setEditDirection] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<MovementLine[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false);
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);

  const fetchMovement = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Movement>(`/api/movements/${id}`);
      setMovement(data);
      setNotFound(false);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setNotFound(true);
      } else {
        toast("Error al cargar el movimiento", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchMovement();
  }, [fetchMovement]);

  useEffect(() => {
    if (!movement?.photo_filename) { setPhotoBlobUrl(null); return; }
    let revoked = false;
    apiFetchBlob(`/api/movements/${id}/photo`).then((url) => {
      if (!revoked) setPhotoBlobUrl(url);
    });
    return () => { revoked = true; };
  }, [movement?.photo_filename, id]);

  function startEditing() {
    if (!movement) return;
    setEditDirection(movement.direction);
    setEditDate(movement.movement_date);
    setEditNotes(movement.notes || "");
    setEditLines([...movement.lines]);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function removeLine(lineId: number) {
    setEditLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function updateLineQuantity(lineId: number, qty: number) {
    setEditLines((prev) => prev.map((l) => l.id === lineId ? { ...l, quantity: qty } : l));
  }

  async function saveChanges() {
    if (!movement) return;
    setSaving(true);
    try {
      await apiFetch(`/api/movements/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          direction: editDirection,
          movement_date: editDate,
          notes: editNotes || null,
          line_ids: editLines.map((l) => l.id),
          line_quantities: editLines.reduce((acc, l) => ({ ...acc, [l.id]: l.quantity }), {}),
        }),
      });
      toast("Movimiento actualizado");
      setEditing(false);
      await fetchMovement();
    } catch {
      toast("Error al guardar cambios", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/movements/${id}`, { method: "DELETE" });
      toast("Movimiento eliminado");
      router.push("/movimientos");
    } catch {
      toast("Error al eliminar movimiento", "error");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
        <div className="p-4">
          {/* Back button + header */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/movimientos")}
              className="p-2 -ml-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] transition-colors"
              aria-label="Volver a movimientos"
            >
              <BackArrow />
            </button>
            <div className="flex-1 min-w-0">
              <h1
                className="font-display text-xl text-[#1A1A1A]"
                style={{ fontStyle: "italic" }}
              >
                Detalle del movimiento
              </h1>
            </div>
            {movement && <DirectionBadge direction={movement.direction} />}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-9 h-9 border-[3px] border-[#861A22] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Not found */}
          {notFound && !loading && (
            <div className="flex flex-col items-center py-16 gap-3">
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
                <circle cx={12} cy={12} r={10} />
                <line x1={15} y1={9} x2={9} y2={15} />
                <line x1={9} y1={9} x2={15} y2={15} />
              </svg>
              <p className="text-[#9CA3AF] text-sm">
                Movimiento no encontrado
              </p>
            </div>
          )}

          {/* Movement detail */}
          {movement && !loading && !editing && (
            <>
              {/* Info section */}
              <div
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-[#9CA3AF]">Fecha</span>
                    <span className="text-sm font-medium text-[#1A1A1A] capitalize">
                      {formatDateLong(movement.movement_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#9CA3AF]">Registrado por</span>
                    <span className="text-sm font-medium text-[#1A1A1A]">
                      {movement.creator_name || "Desconocido"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#9CA3AF]">Hora</span>
                    <span className="text-sm font-medium text-[#1A1A1A]">
                      {formatTimeFromISO(movement.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#9CA3AF]">Direccion</span>
                    <span className="text-sm font-medium text-[#1A1A1A]">
                      {directionLabel(movement.direction)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Photo section */}
              {movement.photo_filename && photoBlobUrl && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowLightbox(true)}
                    className="w-full rounded-xl overflow-hidden shadow-sm"
                    style={{ border: "1px solid #E5E7EB" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoBlobUrl}
                      alt="Foto del movimiento"
                      className="w-full h-auto object-cover"
                    />
                  </button>
                </div>
              )}

              {/* Notes section */}
              {movement.notes && (
                <div
                  className="bg-white rounded-xl p-4 shadow-sm mb-4"
                  style={{ border: "1px solid #E5E7EB" }}
                >
                  <p className="text-sm text-[#9CA3AF] mb-1">Notas:</p>
                  <p className="text-sm text-[#1A1A1A]">{movement.notes}</p>
                </div>
              )}

              {/* Line items */}
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">
                  Articulos ({movement.lines.length})
                </h2>
                <div className="space-y-2">
                  {movement.lines.map((line) => {
                    const lineTotal = line.quantity * line.transfer_price_snapshot;
                    return (
                      <div
                        key={line.id}
                        className="bg-white rounded-xl p-4 shadow-sm"
                        style={{ border: "1px solid #E5E7EB" }}
                      >
                        <p className="font-semibold text-[#1A1A1A] text-sm mb-2">
                          {line.item_name || `Articulo #${line.item_id}`}
                        </p>

                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-[#9CA3AF]">Cantidad</span>
                            <span className="text-[#6B7280]">
                              {line.quantity} {line.unit}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-[#9CA3AF]">Coste unitario</span>
                            <span className="text-[#6B7280]">
                              {formatCHF(line.cost_per_unit_snapshot)}
                            </span>
                          </div>
                          {line.markup_pct_snapshot > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-[#9CA3AF]">Markup</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-medium">
                                {line.markup_pct_snapshot}%
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-[#9CA3AF]">
                              Precio transferencia
                            </span>
                            <span className="text-[#6B7280]">
                              {formatCHF(line.transfer_price_snapshot)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t border-[#F3F4F6]">
                            <span className="text-[#9CA3AF] font-medium">
                              Subtotal
                            </span>
                            <span className="font-semibold text-[#1A1A1A]">
                              {formatCHF(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-[#1A1A1A]">Total</span>
                  <span className="text-lg font-bold text-[#861A22]">
                    {formatCHF(movement.total_cost)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              {canEditOrDelete(user, movement) && (
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={startEditing}
                    className="flex-1 py-2.5 bg-[#861A22] text-white rounded-xl text-sm font-semibold active:bg-[#6B151D] transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 py-2.5 bg-white text-red-600 rounded-xl text-sm font-semibold active:bg-red-50 transition-colors"
                    style={{ border: "1px solid #FCA5A5" }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </>
          )}

          {/* Edit mode */}
          {movement && !loading && editing && (
            <>
              {/* Direction toggle */}
              <div
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <p className="text-sm text-[#9CA3AF] mb-2">Direccion</p>
                <div className="flex gap-2">
                  {(["BRU1_TO_BRU2", "BRU2_TO_BRU1"] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setEditDirection(dir)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editDirection === dir
                          ? "bg-[#861A22] text-white"
                          : "bg-[#F3F4F6] text-[#6B7280]"
                      }`}
                    >
                      {directionLabel(dir)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <label className="text-sm text-[#9CA3AF] block mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#861A22] focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div
                className="bg-white rounded-xl p-4 shadow-sm mb-4"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <label className="text-sm text-[#9CA3AF] block mb-2">
                  Notas
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas opcionales..."
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#861A22] focus:border-transparent resize-none"
                />
              </div>

              {/* Line items with remove */}
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">
                  Articulos ({editLines.length})
                </h2>
                <div className="space-y-2">
                  {editLines.map((line) => (
                    <div
                      key={line.id}
                      className="bg-white rounded-xl p-4 shadow-sm"
                      style={{ border: "1px solid #E5E7EB" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-[#1A1A1A] text-sm flex-1 min-w-0">
                          {line.item_name || `Articulo #${line.item_id}`}
                        </p>
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          aria-label={`Eliminar ${line.item_name}`}
                        >
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-sm text-[#9CA3AF]">Cantidad:</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLineQuantity(line.id, parseFloat(e.target.value) || 0)}
                          className="w-20 border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
                        />
                        <span className="text-sm text-[#9CA3AF]">{line.unit}</span>
                        <span className="text-sm text-[#9CA3AF] ml-auto">{formatCHF(line.transfer_price_snapshot * line.quantity)}</span>
                      </div>
                    </div>
                  ))}
                  {editLines.length === 0 && (
                    <p className="text-sm text-[#9CA3AF] text-center py-4">
                      No quedan articulos
                    </p>
                  )}
                </div>
              </div>

              {/* Save / Cancel buttons */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#F3F4F6] text-[#6B7280] rounded-xl text-sm font-semibold active:bg-[#E5E7EB] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving || editLines.length === 0}
                  className="flex-1 py-2.5 bg-[#861A22] text-white rounded-xl text-sm font-semibold active:bg-[#6B151D] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Guardar cambios
                </button>
              </div>
            </>
          )}

          {/* Delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2 text-center">
                  Eliminar este movimiento?
                </h3>
                <p className="text-sm text-[#9CA3AF] text-center mb-6">
                  Esta accion no se puede deshacer.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 py-2.5 bg-[#F3F4F6] text-[#6B7280] rounded-xl text-sm font-semibold active:bg-[#E5E7EB] transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lightbox */}
          {showLightbox && photoBlobUrl && (
            <div
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
              onClick={() => setShowLightbox(false)}
            >
              <button
                onClick={() => setShowLightbox(false)}
                className="absolute top-4 right-4 text-white p-2"
                aria-label="Cerrar"
              >
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1={18} y1={6} x2={6} y2={18} />
                  <line x1={6} y1={6} x2={18} y2={18} />
                </svg>
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoBlobUrl}
                alt="Foto del movimiento"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
  );
}

export default function MovimientoDetailPage() {
  return (
    <AppShell>
      {(user) => <MovimientoDetailContent user={user} />}
    </AppShell>
  );
}
