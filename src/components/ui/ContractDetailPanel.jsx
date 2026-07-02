import { useEffect, useState } from "react";
import { X, Bookmark, BookmarkCheck, Copy, Check, RefreshCw, MapPin, Tag, FileText, DollarSign, Building2 } from "lucide-react";
import { getPacById, addBookmark as apiAddBookmark, removeBookmark as apiRemoveBookmark, getBookmarks } from "../../api/pacApi";

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Field({ label, value, wide }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, wordBreak: "break-word" }}>
        {value}
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
        <Icon size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
        {children}
      </div>
    </div>
  );
}

export default function ContractDetailPanel({ contract, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine if we have full data or just a stub from bookmarks
  const pacId = contract?.pac_id ?? contract?.id;
  const hasFullData = Boolean(contract?.Procedimiento !== undefined && contract?.T_Compra !== undefined);

  useEffect(() => {
    let alive = true;

    if (hasFullData) {
      setData(contract);
    } else if (pacId) {
      setLoading(true);
      getPacById(pacId)
        .then((rec) => { if (alive) setData(rec); })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    }

    // Check if already bookmarked
    getBookmarks()
      .then((bms) => {
        if (alive && Array.isArray(bms)) {
          setBookmarked(bms.some((b) => b.pac_id === pacId));
        }
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [pacId, hasFullData, contract]);

  const handleBookmarkToggle = async () => {
    if (bookmarkBusy || !pacId || !data) return;
    setBookmarkBusy(true);
    try {
      if (bookmarked) {
        await apiRemoveBookmark(pacId);
        setBookmarked(false);
      } else {
        await apiAddBookmark({
          pac_id: pacId,
          Entidad: data.Entidad,
          Descripcion: data.Descripcion,
          V_Total_Numeric: data.V_Total_Numeric,
          Provincia: data.Provincia,
        });
        setBookmarked(true);
      }
    } catch {
      // silencioso
    } finally {
      setBookmarkBusy(false);
    }
  };

  const handleCopy = () => {
    if (!data) return;
    const text = [
      `Entidad: ${data.Entidad || "—"}`,
      `Descripción: ${data.Descripcion || "—"}`,
      `Procedimiento: ${data.Procedimiento || "—"}`,
      `Tipo de compra: ${data.T_Compra || "—"}`,
      `Régimen: ${data.T_Regimen || "—"}`,
      `Monto: ${formatMoney(data.V_Total_Numeric)}`,
      `Provincia: ${data.Provincia || "—"} · ${data.Ciudad || "—"}`,
      `Fecha: ${data.Fecha_Carga || "—"}`,
      data.url ? `URL: ${data.url}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const d = data || {};

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 902,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        }}
      />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(520px, 96vw)", zIndex: 903,
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.22s ease",
      }}>
        {/* Header */}
        <header style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Detalle de contrato
              </p>
              <h2 style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, wordBreak: "break-word" }}>
                {loading ? "Cargando…" : (d.Entidad || contract?.Entidad || "Contrato")}
              </h2>
              {(d.Provincia || contract?.Provincia) && (
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} /> {d.Provincia || contract?.Provincia}{d.Ciudad ? ` · ${d.Ciudad}` : ""}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                className="icon-button"
                onClick={handleBookmarkToggle}
                disabled={bookmarkBusy}
                title={bookmarked ? "Quitar de favoritos" : "Guardar en favoritos"}
                style={{ color: bookmarked ? "var(--accent)" : undefined }}
              >
                {bookmarkBusy ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>
              <button
                className="icon-button"
                onClick={handleCopy}
                title="Copiar resumen al portapapeles"
              >
                {copied ? <Check size={16} style={{ color: "var(--success,#1e9c6e)" }} /> : <Copy size={16} />}
              </button>
              <button className="icon-button" onClick={onClose} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Monto destacado */}
          {(d.V_Total_Numeric ?? contract?.V_Total_Numeric) != null && (
            <div style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "color-mix(in srgb, var(--accent) 8%, var(--bg-main))",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--line))",
              borderRadius: "var(--radius-sm)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <DollarSign size={15} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.02em" }}>
                {formatMoney(d.V_Total_Numeric ?? contract?.V_Total_Numeric)}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 4 }}>monto total</span>
            </div>
          )}
        </header>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10, color: "var(--text-secondary)" }}>
              <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
              Cargando detalle completo…
            </div>
          ) : !data ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center", marginTop: 48 }}>
              No se pudo cargar la información del contrato.
            </p>
          ) : (
            <>
              <Section icon={Building2} title="Entidad contratante">
                <Field label="Entidad" value={d.Entidad} wide />
                <Field label="Provincia" value={d.Provincia} />
                <Field label="Ciudad" value={d.Ciudad} />
              </Section>

              <Section icon={Tag} title="Clasificación">
                <Field label="Tipo de compra" value={d.T_Compra} />
                <Field label="Régimen" value={d.T_Regimen} />
                <Field label="Procedimiento" value={d.Procedimiento} wide />
                <Field label="Fondo BID" value={d.Fondo_BID} />
                <Field label="Tipo de presupuesto" value={d.Tipo_Presupuesto} />
                <Field label="Tipo de producto" value={d.Tipo_Producto} />
                <Field label="Catálogo electrónico" value={d.Cat_Electronico} />
              </Section>

              <Section icon={FileText} title="Descripción del objeto">
                <Field label="Descripción" value={d.Descripcion} wide />
                <Field label="Nro. de partida" value={d.Nro} />
                <Field label="Partida presupuestaria" value={d.Partida_Pres} />
                <Field label="CPC" value={d.CPC} />
                <Field label="Cantidad" value={d.Cantidad} />
                <Field label="Unidad de medida" value={d.Unidad_Medida} />
              </Section>

              <Section icon={DollarSign} title="Valores">
                <Field label="Monto total" value={formatMoney(d.V_Total_Numeric)} />
                <Field label="Costo unitario" value={d.Costo_Unitario ? formatMoney(d.Costo_Unitario) : null} />
                <Field label="Valor total (texto)" value={d.V_Total} />
              </Section>

              <Section icon={MapPin} title="Temporalidad">
                <Field label="Período" value={d.Periodo} />
                <Field label="Fecha de carga" value={d.Fecha_Carga} />
              </Section>

              {d.url && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    Ver fuente oficial ↗
                  </a>
                </div>
              )}
            </>
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
