import { Bookmark, Command, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function Topbar({
  pageTitle,
  bookmarksCount,
  onOpenPalette,
}) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="shell-topbar glass-card">
      <div>
        <h1>{pageTitle}</h1>
        <p>Analitica inteligente de contratacion publica en Ecuador</p>
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

        <button className="icon-button" title="Favoritos guardados">
          <Bookmark size={18} />
          <span className="dot">{bookmarksCount}</span>
        </button>

        <div className="user-pill">
          <span className="user-avatar">WG</span>
          <div>
            <strong>William Garzon</strong>
            <small>Analista Senior</small>
          </div>
        </div>
      </div>

    </header>
  );
}
