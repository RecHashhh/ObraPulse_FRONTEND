import { useEffect, useState } from "react";
import { Bookmark, X, TrendingUp, TrendingDown, ExternalLink, Trash2, RefreshCw } from "lucide-react";
import { getBookmarks, removeBookmark, checkBookmarkChanges } from "../../api/pacApi";
import { useContract } from "../../context/ContractContext";

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function DeltaBadge({ old: oldVal, current }) {
  if (current == null) return null;
  const diff = Number(current) - Number(oldVal || 0);
  const pct = oldVal ? Math.abs(diff / Number(oldVal) * 100) : 0;
  const up = diff > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        fontWeight: 700,
        color: up ? "var(--danger, #d23f57)" : "var(--success, #1e9c6e)",
        background: up
          ? "color-mix(in srgb, var(--danger, #d23f57) 12%, transparent)"
          : "color-mix(in srgb, var(--success, #1e9c6e) 12%, transparent)",
        borderRadius: 5,
        padding: "2px 6px",
      }}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : "-"}{pct.toFixed(1)}%
    </span>
  );
}

export default function BookmarkPanel({ open, onClose }) {
  const { openContract } = useContract();
  const [bookmarks, setBookmarks] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [bms, chgs] = await Promise.all([getBookmarks(), checkBookmarkChanges()]);
        if (!alive) return;
        setBookmarks(Array.isArray(bms) ? bms : []);
        setChanges(Array.isArray(chgs) ? chgs : []);
      } catch {
        // silencioso — no interrumpir la UI
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [open]);

  const handleRemove = async (pacId) => {
    setRemoving(pacId);
    try {
      await removeBookmark(pacId);
      setBookmarks((prev) => prev.filter((b) => b.pac_id !== pacId));
      setChanges((prev) => prev.filter((c) => c.pac_id !== pacId));
    } catch {
      // silencioso
    } finally {
      setRemoving(null);
    }
  };

  const changeMap = Object.fromEntries(changes.map((c) => [c.pac_id, c]));

  if (!open) return null;

  return (
    <>
      <div
        className="panel-overlay"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 900,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        }}
      />
      <aside
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(420px, 92vw)", zIndex: 901,
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          animation: "slideInRight 0.22s ease",
        }}
      >
        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bookmark size={18} style={{ color: "var(--accent)" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Contratos guardados
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                {bookmarks.length} favorito{bookmarks.length !== 1 ? "s" : ""}
                {changes.length > 0 && (
                  <span style={{ marginLeft: 8, color: "var(--danger, #d23f57)", fontWeight: 600 }}>
                    · {changes.length} con cambios
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{ flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 10, color: "var(--text-secondary)" }}>
              <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
              Cargando favoritos…
            </div>
          ) : bookmarks.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 48 }}>
              <Bookmark size={32} style={{ color: "var(--text-secondary)", opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
                Sin contratos guardados
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>
                Guarda contratos desde Vista Detallada usando el ícono de favorito en cada fila.
              </p>
            </div>
          ) : (
            bookmarks.map((bm) => {
              const change = changeMap[bm.pac_id];
              const hasChange = Boolean(change);

              return (
                <article
                  key={bm.pac_id}
                  onClick={() => openContract(bm)}
                  style={{
                    background: hasChange
                      ? "color-mix(in srgb, var(--danger, #d23f57) 6%, var(--bg-soft))"
                      : "var(--bg-soft)",
                    border: hasChange
                      ? "1px solid color-mix(in srgb, var(--danger, #d23f57) 25%, var(--line))"
                      : "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  {/* Entidad + acciones */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word" }}>
                        {bm.Entidad || "Entidad desconocida"}
                      </p>
                      {bm.Provincia && (
                        <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>{bm.Provincia}</p>
                      )}
                    </div>
                    <button
                      className="icon-button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(bm.pac_id); }}
                      disabled={removing === bm.pac_id}
                      aria-label="Quitar favorito"
                      title="Quitar favorito"
                      style={{ flexShrink: 0 }}
                    >
                      {removing === bm.pac_id
                        ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                        : <Trash2 size={14} />}
                    </button>
                  </div>

                  {/* Descripción */}
                  {bm.Descripcion && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {bm.Descripcion.length > 100 ? bm.Descripcion.slice(0, 100) + "…" : bm.Descripcion}
                    </p>
                  )}

                  {/* Valor */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                      {formatMoney(bm.V_Total_Numeric)}
                    </span>
                    {hasChange && (
                      <>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>guardado · ahora:</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatMoney(change.valor_actual)}
                        </span>
                        <DeltaBadge old={bm.V_Total_Numeric} current={change.valor_actual} />
                      </>
                    )}
                  </div>

                  {/* Badge de cambio */}
                  {hasChange && (
                    <div style={{
                      fontSize: 11, color: "var(--danger, #d23f57)",
                      display: "flex", alignItems: "center", gap: 5, marginTop: 2,
                    }}>
                      <TrendingUp size={12} />
                      Valor actualizado el {new Date(change.fecha_actual).toLocaleDateString("es-EC")}
                    </div>
                  )}

                  {/* Fecha guardado */}
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", opacity: 0.7 }}>
                    Guardado {new Date(bm.created_at).toLocaleDateString("es-EC")}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </aside>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
