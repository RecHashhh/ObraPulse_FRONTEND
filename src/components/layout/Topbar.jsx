import { Bookmark, Bell, Command, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useUser } from "../../context/UserContext";

const ROL_LABELS = {
  administrador: "Administrador",
  analista: "Analista",
  consultor: "Consultor",
};

function getInitials(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Topbar({
  pageTitle,
  pageSubtitle,
  bookmarksCount,
  unreadAlertsCount,
  onOpenPalette,
  onOpenBookmarks,
  onOpenNotifications,
}) {
  const { isDark, toggleTheme } = useTheme();
  const { appUser, logout } = useUser();

  const nombre = appUser?.nombre || "Usuario";
  const rol = appUser?.rol || "consultor";

  return (
    <header className="shell-topbar glass-card">
      <div>
        <h1>{pageTitle}</h1>
        {pageSubtitle && <p>{pageSubtitle}</p>}
      </div>

      <div className="topbar-actions">
        <button
          className="ghost-btn command-launch"
          title="Abrir command palette"
          onClick={onOpenPalette}
        >
          <Command size={16} /> Ctrl+K
        </button>

        <button
          className="icon-button"
          title="Cambiar tema"
          aria-label="Cambiar tema"
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Campana de alertas */}
        <button
          className="icon-button"
          title="Alertas e Insights"
          aria-label={`${unreadAlertsCount || 0} alertas`}
          onClick={onOpenNotifications}
          style={{ position: "relative" }}
        >
          <Bell size={18} />
          {unreadAlertsCount > 0 && (
            <span
              className="dot"
              style={{
                background: "var(--danger, #d23f57)",
                color: "#fff",
                fontSize: 9,
                minWidth: 15,
                height: 15,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
              }}
            >
              {unreadAlertsCount > 99 ? "99+" : unreadAlertsCount}
            </span>
          )}
        </button>

        {/* Favoritos */}
        <button
          className="icon-button"
          title="Contratos guardados"
          aria-label={`${bookmarksCount || 0} favoritos guardados`}
          onClick={onOpenBookmarks}
          style={{ position: "relative" }}
        >
          <Bookmark size={18} />
          {bookmarksCount > 0 && (
            <span className="dot">{bookmarksCount > 99 ? "99+" : bookmarksCount}</span>
          )}
        </button>

        <button
          className="user-pill"
          title="Cerrar sesión"
          aria-label={`Cerrar sesión de ${nombre}`}
          onClick={logout}
          style={{ cursor: "pointer", background: "transparent" }}
        >
          <span className="user-avatar">{getInitials(nombre)}</span>
          <div>
            <strong>{nombre}</strong>
            <small>{ROL_LABELS[rol] || rol}</small>
          </div>
        </button>
      </div>
    </header>
  );
}
