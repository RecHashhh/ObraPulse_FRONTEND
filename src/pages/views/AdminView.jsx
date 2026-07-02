import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  getUsuarios,
} from "../../api/pacApi";
import { useUser } from "../../context/UserContext";

const ROL_LABELS = {
  administrador: "Administrador",
  analista: "Analista",
  consultor: "Consultor",
};

const ROL_COLORS = {
  administrador: "#a855f7",
  analista: "#3b82f6",
  consultor: "#10b981",
};

export default function AdminView() {
  const { appUser } = useUser();
  const qc = useQueryClient();

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: getUsuarios,
    staleTime: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const mutCreate = useMutation({
    mutationFn: crearUsuario,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-usuarios"] }),
  });

  const mutUpdate = useMutation({
    mutationFn: ({ id, body }) => actualizarUsuario(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-usuarios"] }),
  });

  const mutDelete = useMutation({
    mutationFn: eliminarUsuario,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-usuarios"] }),
  });

  const filtered = usuarios.filter(
    (u) =>
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.nombre || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "24px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Gestión de Usuarios
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} registrado{usuarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          <button onClick={() => setShowModal(true)} style={btnPrimaryStyle}>
            + Agregar usuario
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-soft, #eaf0fa)", borderBottom: "1px solid var(--line)" }}>
              {["Usuario", "Rol", "Estado", "Último acceso", "Acciones"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                  No se encontraron usuarios
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isMe={u.email === appUser?.email}
                onChangeRol={(rol) => mutUpdate.mutate({ id: u.id, body: { rol } })}
                onToggleActivo={() => mutUpdate.mutate({ id: u.id, body: { activo: !u.activo } })}
                onDelete={() => {
                  if (confirm(`¿Eliminar a ${u.email}?`)) mutDelete.mutate(u.id);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AgregarUsuarioModal
          onClose={() => setShowModal(false)}
          onSubmit={(body) => {
            mutCreate.mutate(body, { onSuccess: () => setShowModal(false) });
          }}
          isLoading={mutCreate.isPending}
          error={mutCreate.error?.response?.data?.detail}
        />
      )}
    </div>
  );
}

function UserRow({ user, isMe, onChangeRol, onToggleActivo, onDelete }) {
  const initials = (user.nombre || user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const lastAccess = user.ultimo_acceso
    ? new Date(user.ultimo_acceso).toLocaleString("es-EC", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Nunca";

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--line)",
        transition: "background 0.1s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-soft, #eaf0fa)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "")}
    >
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: ROL_COLORS[user.rol] + "33",
              border: `1px solid ${ROL_COLORS[user.rol]}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: ROL_COLORS[user.rol],
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {user.nombre || "—"}
              {isMe && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "color-mix(in srgb, var(--accent, #293E46) 15%, transparent)",
                    color: "var(--accent, #293E46)",
                    fontWeight: 500,
                  }}
                >
                  Tú
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user.email}</div>
          </div>
        </div>
      </td>

      <td style={{ padding: "14px 16px" }}>
        {isMe ? (
          <RolBadge rol={user.rol} />
        ) : (
          <select
            value={user.rol}
            onChange={(e) => onChangeRol(e.target.value)}
            style={{
              ...inputStyle,
              padding: "4px 8px",
              fontSize: 12,
              width: "auto",
              cursor: "pointer",
            }}
          >
            <option value="administrador">Administrador</option>
            <option value="analista">Analista</option>
            <option value="consultor">Consultor</option>
          </select>
        )}
      </td>

      <td style={{ padding: "14px 16px" }}>
        <button
          onClick={isMe ? undefined : onToggleActivo}
          disabled={isMe}
          title={isMe ? "No puedes desactivar tu propia cuenta" : ""}
          style={{
            padding: "4px 10px",
            borderRadius: 20,
            border: "none",
            fontSize: 11,
            fontWeight: 600,
            cursor: isMe ? "default" : "pointer",
            background: user.activo ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            color: user.activo ? "#34d399" : "#f87171",
            opacity: isMe ? 0.7 : 1,
          }}
        >
          {user.activo ? "Activo" : "Inactivo"}
        </button>
      </td>

      <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontSize: 12 }}>
        {lastAccess}
      </td>

      <td style={{ padding: "14px 16px" }}>
        {!isMe && (
          <button
            onClick={onDelete}
            title="Eliminar usuario"
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "transparent",
              color: "#f87171",
              fontSize: 12,
              cursor: "pointer",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Eliminar
          </button>
        )}
      </td>
    </tr>
  );
}

function RolBadge({ rol }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: (ROL_COLORS[rol] || "#888") + "22",
        color: ROL_COLORS[rol] || "#888",
        border: `1px solid ${(ROL_COLORS[rol] || "#888")}44`,
      }}
    >
      {ROL_LABELS[rol] || rol}
    </span>
  );
}

function AgregarUsuarioModal({ onClose, onSubmit, isLoading, error }) {
  const [form, setForm] = useState({ email: "", nombre: "", rol: "analista" });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email.trim()) return;
    onSubmit({ email: form.email.trim(), nombre: form.nombre.trim() || undefined, rol: form.rol });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 32,
          width: 400,
          boxShadow: "var(--shadow-soft, 0 18px 40px rgba(24,45,74,0.1))",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>
            Agregar usuario
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={labelStyle}>
            Email corporativo *
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="usuario@empresa.com"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Nombre completo
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Opcional — se completa al primer login"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Rol
            <select value={form.rol} onChange={(e) => set("rol", e.target.value)} style={inputStyle}>
              <option value="administrador">Administrador</option>
              <option value="analista">Analista</option>
              <option value="consultor">Consultor</option>
            </select>
          </label>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} style={btnSecondaryStyle}>
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} style={{ ...btnPrimaryStyle, opacity: isLoading ? 0.6 : 1 }}>
              {isLoading ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--line, #d5dfed)",
  background: "var(--bg-main, #f3f6fb)",
  color: "var(--text-primary, #12243b)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary, #5f728b)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const btnPrimaryStyle = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent, #293E46)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondaryStyle = {
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid var(--line, #d5dfed)",
  background: "transparent",
  color: "var(--text-primary, #12243b)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
