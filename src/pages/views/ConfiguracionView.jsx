import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useUser } from "../../context/UserContext";
import {
  actualizarEntidad,
  crearEntidad,
  eliminarEntidad,
  getEntidades,
  getScraperLogs,
  getScraperStatus,
  importarEntidadesJson,
  runScraper,
} from "../../api/pacApi";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(val);
  }
}

function StatusBadge({ estado }) {
  const map = {
    corriendo: { bg: "var(--warning)", label: "Corriendo" },
    completado: { bg: "var(--success)", label: "Completado" },
    error: { bg: "var(--danger)", label: "Error" },
  };
  const cfg = map[estado] || { bg: "var(--text-secondary)", label: estado };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        background: cfg.bg,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Modal entidad ─────────────────────────────────────────────────────────────

function EntidadModal({ entidad, onClose, onSaved }) {
  const isEdit = Boolean(entidad?.id);
  const [form, setForm] = useState({
    nombre: entidad?.Nombre_Comercial ?? "",
    url: entidad?.Url ?? "",
    provincia: entidad?.Provincia ?? "",
    ciudad: entidad?.Ciudad ?? "",
    activo: entidad?.Activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.url.trim()) {
      setError("Nombre y URL son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await actualizarEntidad(entidad.id, {
          nombre: form.nombre,
          url: form.url,
          provincia: form.provincia || null,
          ciudad: form.ciudad || null,
          activo: form.activo,
        });
      } else {
        await crearEntidad({
          nombre: form.nombre,
          url: form.url,
          provincia: form.provincia || null,
          ciudad: form.ciudad || null,
        });
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "var(--bg-panel)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "var(--shadow-hover)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{isEdit ? "Editar entidad" : "Nueva entidad"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "nombre", label: "Nombre comercial *", placeholder: "Ministerio de Obras..." },
            { key: "url", label: "URL del PAC *", placeholder: "https://..." },
            { key: "provincia", label: "Provincia", placeholder: "Pichincha" },
            { key: "ciudad", label: "Ciudad", placeholder: "Quito" },
          ].map(({ key, label, placeholder }) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
              <input
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-soft)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                }}
              />
            </label>
          ))}

          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
              <span>Entidad activa (incluir en scraping)</span>
            </label>
          )}

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} className="ghost-btn">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 20px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando…" : isEdit ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sección: Entidades ────────────────────────────────────────────────────────

function SeccionEntidades() {
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {} | {id,...}
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importResult, setImportResult] = useState(null); // {ok, msg}
  const fileRef = useRef();

  async function cargar() {
    setLoading(true);
    try {
      const data = await getEntidades(false);
      setEntidades(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleDelete(ent) {
    await actualizarEntidad(ent.id, {
      nombre: ent.Nombre_Comercial,
      url: ent.Url,
      provincia: ent.Provincia || null,
      ciudad: ent.Ciudad || null,
      activo: false,
    });
    setConfirmDel(null);
    cargar();
  }

  async function handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : Object.values(json);
      setImportCount(arr.length);
      setImporting(true);
      const res = await importarEntidadesJson(arr);
      setImporting(false);
      cargar();
      // Show inline success instead of blocking alert
      setImportResult({ ok: true, msg: `Importación completada: ${res.importados} entidades nuevas, ${res.actualizados ?? 0} actualizadas de ${arr.length} procesadas.` });
    } catch (err) {
      setImporting(false);
      setImportResult({ ok: false, msg: "Error al importar: " + (err?.response?.data?.detail ?? err.message) });
    } finally {
      e.target.value = "";
    }
  }

  const filtered = entidades.filter(
    (e) =>
      e.Nombre_Comercial?.toLowerCase().includes(search.toLowerCase()) ||
      e.Provincia?.toLowerCase().includes(search.toLowerCase()) ||
      e.Ciudad?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <article className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Entidades a scrapear</h3>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            {entidades.length} entidad{entidades.length !== 1 ? "es" : ""} registrada{entidades.length !== 1 ? "s" : ""}
            {" · "}{entidades.filter((e) => e.Activo).length} activa{entidades.filter((e) => e.Activo).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Buscar entidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "7px 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-soft)",
              color: "var(--text-primary)",
              fontSize: 13,
              minWidth: 200,
            }}
          />
          <button
            className="ghost-btn"
            onClick={() => fileRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Upload size={14} /> Importar JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImportJson} />
          <button
            onClick={() => setModal({})}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px",
              background: "var(--accent-2)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <Plus size={14} /> Nueva entidad
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
          <Loader size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                {["Nombre comercial", "Provincia", "Ciudad", "Estado", "Acciones"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
                    {search ? "Sin resultados para la búsqueda." : "No hay entidades registradas."}
                  </td>
                </tr>
              )}
              {filtered.map((ent) => (
                <tr
                  key={ent.id}
                  style={{ borderBottom: "1px solid var(--line)", opacity: ent.Activo ? 1 : 0.5 }}
                >
                  <td style={{ padding: "9px 10px", maxWidth: 280 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ent.Nombre_Comercial}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ent.Url}
                    </div>
                  </td>
                  <td style={{ padding: "9px 10px" }}>{ent.Provincia ?? "—"}</td>
                  <td style={{ padding: "9px 10px" }}>{ent.Ciudad ?? "—"}</td>
                  <td style={{ padding: "9px 10px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: ent.Activo ? "rgba(17,168,117,0.15)" : "rgba(210,63,87,0.12)",
                        color: ent.Activo ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {ent.Activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setModal(ent)}
                        title="Editar"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 4 }}
                      >
                        <Edit2 size={15} />
                      </button>
                      {ent.Activo && (
                        <button
                          onClick={() => setConfirmDel(ent)}
                          title="Desactivar"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <EntidadModal
          entidad={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            cargar();
          }}
        />
      )}

      {importing && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
          }}
        >
          <div style={{
            background: "var(--bg-panel)", borderRadius: "var(--radius-lg)",
            padding: "36px 44px", maxWidth: 380, textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}>
            <Loader size={32} style={{ animation: "spin 1s linear infinite", color: "var(--accent)", marginBottom: 18 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Importando entidades…</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 6px" }}>
              Procesando <strong>{importCount.toLocaleString()}</strong> entidades del archivo JSON.
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
              Esto puede tardar varios segundos. No cierres esta ventana.
            </p>
          </div>
        </div>
      )}

      {importResult && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
          onClick={() => setImportResult(null)}
        >
          <div style={{
            background: "var(--bg-panel)", borderRadius: "var(--radius-lg)",
            padding: 28, maxWidth: 400, boxShadow: "var(--shadow-hover)", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{importResult.ok ? "✅" : "❌"}</div>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, color: importResult.ok ? "var(--success)" : "var(--danger)" }}>
              {importResult.ok ? "Importación completada" : "Error en la importación"}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>{importResult.msg}</p>
            <button
              onClick={() => setImportResult(null)}
              style={{
                padding: "8px 24px", background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                fontWeight: 600, fontSize: 14,
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {confirmDel && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
        >
          <div style={{
            background: "var(--bg-panel)", borderRadius: "var(--radius-lg)",
            padding: 28, maxWidth: 380, boxShadow: "var(--shadow-hover)",
          }}>
            <h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={18} color="var(--warning)" /> Confirmar desactivación
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 6px" }}>
              ¿Desactivar <strong>{confirmDel.Nombre_Comercial}</strong>?
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 20px" }}>
              La entidad se marcará como inactiva y no participará en próximos scrapings.
              Puedes reactivarla editando el registro.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="ghost-btn" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDel)}
                style={{
                  padding: "8px 18px", background: "var(--warning)", color: "#fff",
                  border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                  fontWeight: 600, fontSize: 14,
                }}
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Sección: Scraper ──────────────────────────────────────────────────────────

function fmtElapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m} min ${s.toString().padStart(2, "0")} seg`;
}

function SeccionScraper() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState(null);
  const [page, setPage] = useState(1);
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState("");
  const [entidades, setEntidades] = useState([]);
  const [selectedEntidadId, setSelectedEntidadId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef(null);
  const elapsedRef = useRef(null);

  async function cargarStatus() {
    try {
      const s = await getScraperStatus();
      setStatus(s);
    } catch {
      /* silencioso */
    }
  }

  async function cargarLogs(p = 1) {
    try {
      const data = await getScraperLogs(p, 10);
      setLogs(data);
      setPage(p);
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    cargarStatus();
    cargarLogs(1);
    getEntidades(true).then(setEntidades).catch(() => {});
  }, []);

  // Poll cada 8 s mientras está corriendo
  useEffect(() => {
    if (status?.running) {
      intervalRef.current = setInterval(() => {
        cargarStatus();
        cargarLogs(page);
      }, 8000);
    }
    return () => clearInterval(intervalRef.current);
  }, [status?.running, page]);

  // Cronómetro de 1 s usando started_at del API
  useEffect(() => {
    if (status?.running && status?.started_at) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(status.started_at).getTime()) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      };
      tick();
      elapsedRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(elapsedRef.current);
      setElapsedSeconds(0);
    }
    return () => clearInterval(elapsedRef.current);
  }, [status?.running, status?.started_at]);

  // Duración promedio de las últimas 5 ejecuciones completadas (en segundos)
  const avgDurationSeconds = useMemo(() => {
    if (!logs?.items) return null;
    const durations = logs.items
      .filter((l) => l.estado === "completado" && l.inicio && l.fin)
      .slice(0, 5)
      .map((l) => (new Date(l.fin) - new Date(l.inicio)) / 1000);
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [logs]);

  // % de progreso — tope en 90 % hasta que el estado cambie a completado
  const progressPct = useMemo(() => {
    if (!status?.running || avgDurationSeconds == null || avgDurationSeconds === 0) return null;
    return Math.min(90, Math.round((elapsedSeconds / avgDurationSeconds) * 100));
  }, [status?.running, elapsedSeconds, avgDurationSeconds]);

  async function handleRun(entidadId = null) {
    setTriggering(true);
    setMsg("");
    try {
      const res = await runScraper(entidadId);
      const entityName = entidadId
        ? entidades.find((e) => e.id === entidadId)?.Nombre_Comercial
        : null;
      setMsg(
        entityName
          ? `Scraping de "${entityName}" iniciado (log #${res.log_id}).`
          : `Scraping iniciado (log #${res.log_id}). Puede tomar varios minutos.`
      );
      setTimeout(() => {
        cargarStatus();
        cargarLogs(1);
      }, 1500);
    } catch (err) {
      const detail = err?.response?.data?.detail ?? "Error al iniciar el scraping.";
      setMsg(detail);
    } finally {
      setTriggering(false);
    }
  }

  const lastRun = status?.last_run;
  const totalPages = logs ? Math.ceil(logs.total / 10) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Panel de control */}
      <article className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Control del scraper</h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
          {[
            {
              label: "Estado actual",
              value: status?.running ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warning)", fontWeight: 700 }}>
                  <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Corriendo…
                </span>
              ) : (
                <span style={{ color: "var(--success)", fontWeight: 700 }}>Inactivo</span>
              ),
            },
            {
              label: "Último estado",
              value: lastRun ? <StatusBadge estado={lastRun.estado} /> : "—",
            },
            {
              label: "Última ejecución",
              value: lastRun ? fmtDate(lastRun.inicio) : "Nunca",
            },
            {
              label: "Registros insertados",
              value: lastRun?.registros_insertados != null
                ? lastRun.registros_insertados.toLocaleString()
                : "—",
            },
            {
              label: "Entidades procesadas",
              value: lastRun?.entidades_procesadas != null
                ? lastRun.entidades_procesadas.toLocaleString()
                : "—",
            },
            {
              label: "Programación",
              value: "Automático: lunes 02:00",
            },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "var(--bg-soft)", borderRadius: "var(--radius-sm)", padding: "12px 14px",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Panel de progreso (solo mientras corre) ── */}
        {status?.running && (
          <div style={{
            background: "var(--bg-soft)",
            borderRadius: "var(--radius-md)",
            padding: "16px 18px",
            marginBottom: 16,
          }}>
            {/* Barra */}
            <div style={{
              height: 6,
              background: "var(--line)",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 10,
            }}>
              {progressPct != null ? (
                <div style={{
                  width: "100%",
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 99,
                  transform: `scaleX(${progressPct / 100})`,
                  transformOrigin: "left",
                  transition: "transform 1s linear",
                }} />
              ) : (
                <div style={{
                  width: "28%",
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 99,
                  animation: "scraper-sweep 1.4s ease-in-out infinite",
                }} />
              )}
            </div>

            {/* Etiquetas */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}>
              <span>
                <Loader size={11} style={{ animation: "spin 1s linear infinite", marginRight: 5, verticalAlign: "middle" }} />
                Corriendo hace <strong style={{ color: "var(--text-primary)" }}>{fmtElapsed(elapsedSeconds)}</strong>
              </span>
              {progressPct != null ? (
                <span>
                  {progressPct}% &nbsp;·&nbsp;
                  ~{fmtElapsed(Math.max(0, Math.round(avgDurationSeconds - elapsedSeconds)))} restante
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>
                    (basado en {Math.min(5, logs?.items?.filter(l => l.estado === "completado").length ?? 0)} ejecuci{logs?.items?.filter(l => l.estado === "completado").length === 1 ? "ón" : "ones"})
                  </span>
                </span>
              ) : (
                <span style={{ opacity: 0.7 }}>Calculando estimado tras la primera ejecución…</span>
              )}
            </div>
          </div>
        )}

        {lastRun?.error && (
          <div style={{
            background: "rgba(210,63,87,0.1)", borderRadius: "var(--radius-sm)",
            padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--danger)",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ wordBreak: "break-word" }}>{lastRun.error}</span>
          </div>
        )}

        {lastRun?.mensaje && lastRun.estado === "completado" && (
          <div style={{
            background: "rgba(17,168,117,0.1)", borderRadius: "var(--radius-sm)",
            padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--success)",
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <CheckCircle size={14} />
            <span>{lastRun.mensaje}</span>
          </div>
        )}

        {msg && (
          <div style={{
            background: "var(--bg-soft)", borderRadius: "var(--radius-sm)",
            padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--text-primary)",
          }}>
            {msg}
          </div>
        )}

        {/* Selector de entidad + acciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              Alcance:
            </label>
            <select
              value={selectedEntidadId ?? ""}
              onChange={(e) => setSelectedEntidadId(e.target.value ? Number(e.target.value) : null)}
              disabled={triggering || status?.running}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: "var(--bg-panel)",
                color: "var(--text-primary)",
                fontSize: 13,
                minWidth: 220,
                maxWidth: 380,
                cursor: triggering || status?.running ? "not-allowed" : "pointer",
                opacity: triggering || status?.running ? 0.6 : 1,
              }}
            >
              <option value="">Todas las entidades activas</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>{e.Nombre_Comercial}</option>
              ))}
            </select>
            {selectedEntidadId && (
              <button
                onClick={() => setSelectedEntidadId(null)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-secondary)", padding: "4px 6px",
                  display: "flex", alignItems: "center",
                }}
                title="Limpiar selección"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => handleRun(selectedEntidadId)}
              disabled={triggering || status?.running}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 22px",
                background: status?.running ? "var(--line)" : "var(--accent-2)",
                color: status?.running ? "var(--text-secondary)" : "#fff",
                border: "none", borderRadius: "var(--radius-sm)",
                cursor: triggering || status?.running ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 14,
              }}
            >
              {triggering
                ? <Loader size={15} style={{ animation: "spin 1s linear infinite" }} />
                : <Play size={15} />}
              {status?.running
                ? "Scraping en curso…"
                : selectedEntidadId
                  ? `Ejecutar: ${entidades.find(e => e.id === selectedEntidadId)?.Nombre_Comercial?.split(" ").slice(0, 3).join(" ") ?? "Entidad"}`
                  : "Ejecutar ahora"}
            </button>
            <button
              className="ghost-btn"
              onClick={() => { cargarStatus(); cargarLogs(page); }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} /> Actualizar estado
            </button>
          </div>
        </div>
      </article>

      {/* Historial */}
      <article className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Historial de ejecuciones</h3>

        {!logs ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>
            <Loader size={22} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : logs.items.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 24 }}>
            Aún no hay ejecuciones registradas.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    {["#", "Inicio", "Fin", "Estado", "Entidades", "Registros nuevos", "Mensaje"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "9px 10px", color: "var(--text-secondary)" }}>{log.id}</td>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>{fmtDate(log.inicio)}</td>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>{fmtDate(log.fin)}</td>
                      <td style={{ padding: "9px 10px" }}><StatusBadge estado={log.estado} /></td>
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>{log.entidades_procesadas ?? "—"}</td>
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>{log.registros_insertados ?? "—"}</td>
                      <td style={{ padding: "9px 10px", maxWidth: 220 }}>
                        {log.error ? (
                          <span style={{ color: "var(--danger)", fontSize: 12 }}>{log.error.slice(0, 120)}{log.error.length > 120 ? "…" : ""}</span>
                        ) : (
                          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{log.mensaje ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginTop: 16 }}>
                <button
                  className="ghost-btn"
                  disabled={page === 1}
                  onClick={() => cargarLogs(page - 1)}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Página {page} de {totalPages} ({logs.total} total)
                </span>
                <button
                  className="ghost-btn"
                  disabled={page >= totalPages}
                  onClick={() => cargarLogs(page + 1)}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: "scraper", label: "Scraper", roles: ["administrador", "analista"] },
  { id: "entidades", label: "Entidades", roles: ["administrador", "analista"] },
  { id: "tema", label: "Apariencia", roles: ["administrador", "analista", "consultor"] },
];

export default function ConfiguracionView() {
  const { isDark, setTheme } = useTheme();
  const { appUser } = useUser();
  const rol = appUser?.rol || "consultor";
  const TABS = ALL_TABS.filter((t) => t.roles.includes(rol));
  const [tab, setTab] = useState(() => TABS[0]?.id ?? "tema");

  return (
    <div style={{ padding: "24px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 24 }}>Configuración</h2>
      <p style={{ margin: "0 0 24px", color: "var(--text-secondary)", fontSize: 14 }}>
        Administra entidades, scraping y preferencias visuales de ObraPulse.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid var(--line)", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: 14,
              color: tab === t.id ? "var(--accent-2)" : "var(--text-secondary)",
              borderBottom: tab === t.id ? "2px solid var(--accent-2)" : "2px solid transparent",
              marginBottom: -2,
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scraper" && <SeccionScraper />}
      {tab === "entidades" && <SeccionEntidades />}
      {tab === "tema" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <article className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Tema visual</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 16px" }}>
              Selecciona el modo que mejor se adapte a tu flujo de trabajo.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="ghost-btn"
                onClick={() => setTheme("light")}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: !isDark ? 700 : 400 }}
              >
                <Sun size={15} /> Claro
              </button>
              <button
                className="ghost-btn"
                onClick={() => setTheme("dark")}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: isDark ? 700 : 400 }}
              >
                <Moon size={15} /> Oscuro
              </button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 12 }}>
              Tema actual: <strong>{isDark ? "Oscuro" : "Claro"}</strong>
            </p>
          </article>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ghost-btn {
          padding: 7px 14px;
          background: var(--bg-soft);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          transition: background 0.15s;
        }
        .ghost-btn:hover { background: var(--line); }
        .ghost-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
