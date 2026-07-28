"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { User } from "@/lib/types";

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface UserFormData {
  name: string;
  pin: string;
  role: string;
}

function UserModal({
  title,
  initial,
  onSave,
  onClose,
  isPinReset,
}: {
  title: string;
  initial?: UserFormData;
  onSave: (data: UserFormData) => Promise<void>;
  onClose: () => void;
  isPinReset?: boolean;
}) {
  const [form, setForm] = useState<UserFormData>(
    initial || { name: "", pin: "", role: "staff" }
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPinReset && form.pin.length !== 4) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h3 className="font-display text-lg text-[#1A1A1A]" style={{ fontStyle: "italic" }}>{title}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {!isPinReset && (
            <>
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
                <label className="block text-sm font-medium text-[#6B7280] mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-[#6B7280] mb-1">
              PIN (4 digitos)
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={form.pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setForm({ ...form, pin: v });
              }}
              required
              placeholder="0000"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#861A22]/30 focus:border-[#861A22]"
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
              disabled={saving || form.pin.length !== 4 || (!isPinReset && !form.name)}
              className="flex-1 bg-[#861A22] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B151D] disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : isPinReset ? "Cambiar PIN" : initial ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pinResetUser, setPinResetUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<User[]>("/api/users");
      setUsers(data);
    } catch {
      toast("Error al cargar equipo", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreateUser(data: UserFormData) {
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast("Usuario creado");
      setShowCreateModal(false);
      fetchUsers();
    } catch {
      toast("Error al crear usuario", "error");
    }
  }

  async function handleEditUser(data: UserFormData) {
    if (!editingUser) return;
    try {
      await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: data.name, role: data.role }),
      });
      toast("Usuario actualizado");
      setEditingUser(null);
      fetchUsers();
    } catch {
      toast("Error al actualizar usuario", "error");
    }
  }

  async function handleResetPin(data: UserFormData) {
    if (!pinResetUser) return;
    try {
      await apiFetch(`/api/users/${pinResetUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ pin: data.pin }),
      });
      toast("PIN actualizado");
      setPinResetUser(null);
    } catch {
      toast("Error al cambiar PIN", "error");
    }
  }

  async function handleDeactivate(user: User) {
    if (!confirm(`Desactivar usuario "${user.name}"?`)) return;
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: false }),
      });
      toast("Usuario desactivado");
      fetchUsers();
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
          Equipo
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#861A22] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6B151D] transition-colors"
        >
          Nuevo usuario
        </button>
      </div>

      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-center text-[#9CA3AF] py-10 text-sm">No hay usuarios</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-xl p-4 shadow-sm border border-[#E5E7EB] ${!user.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#F8F0F1] flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#861A22]">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1A1A1A] truncate">{user.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          user.role === "admin"
                            ? "bg-[#F8F0F1] text-[#861A22]"
                            : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}
                      >
                        {user.role === "admin" ? "Admin" : "Staff"}
                      </span>
                      {!user.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F3F4F6]">
                <button
                  onClick={() => setEditingUser(user)}
                  className="text-xs text-[#6B7280] hover:text-[#861A22] transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => setPinResetUser(user)}
                  className="text-xs text-[#6B7280] hover:text-[#861A22] transition-colors"
                >
                  Cambiar PIN
                </button>
                {user.is_active && (
                  <button
                    onClick={() => handleDeactivate(user)}
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
        <UserModal
          title="Nuevo usuario"
          onSave={handleCreateUser}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit modal */}
      {editingUser && (
        <UserModal
          title="Editar usuario"
          initial={{ name: editingUser.name, pin: "0000", role: editingUser.role }}
          onSave={handleEditUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* PIN reset modal */}
      {pinResetUser && (
        <UserModal
          title={`Cambiar PIN - ${pinResetUser.name}`}
          initial={{ name: pinResetUser.name, pin: "", role: pinResetUser.role }}
          onSave={handleResetPin}
          onClose={() => setPinResetUser(null)}
          isPinReset
        />
      )}
    </div>
  );
}
