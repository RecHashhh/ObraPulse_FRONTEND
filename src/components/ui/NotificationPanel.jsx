import { useEffect, useState, useCallback } from "react";
import { Bell, X, Settings, RefreshCw, AlertTriangle, TrendingUp, BarChart2, Filter, Trash2, CheckCheck, Clock, ChevronRight, ArrowLeft, DollarSign, ExternalLink } from "lucide-react";
import { useContract } from "../../context/ContractContext";
import { useNavigate } from "react-router-dom";

const ALERTS_HISTORY_KEY = "pac.alerts.history";
import { getPacInsights, getCatalogosDinamicos, getPreferencia, setPreferencia, getPac } from "../../api/pacApi";

const CONFIG_KEY = "alertas_config";
const DEFAULT_CONFIG = {
  umbral: 500000,
  tipo_compra: "",
  t_regimen: "",
  procedimiento: "",
  fecha_inicio: "",
  fecha_fin: "",
};

function formatMoney(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function InsightCard({ icon: Icon, label, value, sub, tone = "normal", onViewList }) {
  const colors = {
    critical: { bg: "color-mix(in srgb, var(--danger,#d23f57) 8%, var(--bg-soft))", border: "color-mix(in srgb, var(--danger,#d23f57) 20%, var(--line))", ink: "var(--danger,#d23f57)" },
    warning:  { bg: "color-mix(in srgb, #E75E0D 8%, var(--bg-soft))", border: "color-mix(in srgb, #E75E0D 20%, var(--line))", ink: "#E75E0D" },
    positive: { bg: "color-mix(in srgb, var(--success,#1e9c6e) 8%, var(--bg-soft))", border: "color-mix(in srgb, var(--success,#1e9c6e) 20%, var(--line))", ink: "var(--success,#1e9c6e)" },
    normal:   { bg: "var(--bg-soft)", border: "var(--line)", ink: "var(--accent)" },
  };
  const c = colors[tone] || colors.normal;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ color: c.ink, marginTop: 2, flexShrink: 0 }}><Icon size={16} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
          <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</p>
          {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>{sub}</p>}
        </div>
      </div>
      {onViewList && (
        <button
          onClick={onViewList}
          style={{
            marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "6px 0", background: "rgba(0,0,0,0.05)", border: "none", borderRadius: "var(--radius-sm)",
            cursor: "pointer", fontSize: 12, fontWeight: 600, color: c.ink,
          }}
        >
          Ver contratos <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

export default function NotificationPanel({ open, onClose }) {
  const { openContract } = useContract();
  const navigate = useNavigate();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [draft, setDraft] = useState(DEFAULT_CONFIG);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [catalogos, setCatalogos] = useState({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [contractsView, setContractsView] = useState(null); // null | "outliers" | "sobre_umbral"
  const [contractsList, setContractsList] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // Cargar config y catálogos al abrir
  useEffect(() => {
    if (!open) {
      setContractsView(null);
      setContractsList([]);
      return;
    }
    let alive = true;

    (async () => {
      // Catalogs and preferences load independently so one failure doesn't block the other
      const [savedResult, catsResult] = await Promise.allSettled([
        getPreferencia(CONFIG_KEY),
        getCatalogosDinamicos(),
      ]);
      if (!alive) return;

      const saved = savedResult.status === "fulfilled" ? savedResult.value : null;
      const cats = catsResult.status === "fulfilled" ? catsResult.value : {};

      const merged = { ...DEFAULT_CONFIG, ...(saved || {}) };
      setConfig(merged);
      setDraft(merged);
      setCatalogos(cats || {});
      setConfigLoaded(true);
      try {
        const stored = JSON.parse(localStorage.getItem(ALERTS_HISTORY_KEY) || "[]");
        if (alive) setHistory(Array.isArray(stored) ? stored : []);
      } catch {
        // sin historial
      }
    })();

    return () => { alive = false; };
  }, [open]);

  // Cargar insights cuando la config está lista
  const fetchInsights = useCallback(async (cfg) => {
    setLoading(true);
    try {
      const params = {
        umbral: cfg.umbral,
        ...(cfg.tipo_compra && { tipo_compra: cfg.tipo_compra }),
        ...(cfg.t_regimen && { t_regimen: cfg.t_regimen }),
        ...(cfg.procedimiento && { procedimiento: cfg.procedimiento }),
        ...(cfg.fecha_inicio && { fecha_inicio: cfg.fecha_inicio }),
        ...(cfg.fecha_fin && { fecha_fin: cfg.fecha_fin }),
      };
      const result = await getPacInsights(params);
      setInsights(result);
    } catch {
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !configLoaded) return;
    fetchInsights(config);
  }, [open, configLoaded, config, fetchInsights]);

  const handleViewAll = useCallback((valorMin) => {
    const jumpFilters = {
      valor_min: valorMin,
      ...(config.tipo_compra && { tipo_compra: config.tipo_compra }),
      ...(config.t_regimen && { t_regimen: config.t_regimen }),
      ...(config.procedimiento && { procedimiento: config.procedimiento }),
      ...(config.fecha_inicio && { fecha_inicio: config.fecha_inicio }),
      ...(config.fecha_fin && { fecha_fin: config.fecha_fin }),
    };
    sessionStorage.setItem("pac.jumpFilters", JSON.stringify(jumpFilters));
    onClose();
    navigate("/detalle");
  }, [config, navigate, onClose]);

  const fetchContractsList = useCallback(async (type, valorMin) => {
    setContractsView(type);
    setContractsList([]);
    setContractsLoading(true);
    try {
      const params = {
        page: 1,
        page_size: 50,
        order_by: "V_Total_Numeric",
        order_dir: "desc",
        valor_min: valorMin,
        ...(config.tipo_compra && { tipo_compra: config.tipo_compra }),
        ...(config.t_regimen && { t_regimen: config.t_regimen }),
        ...(config.procedimiento && { procedimiento: config.procedimiento }),
        ...(config.fecha_inicio && { fecha_inicio: config.fecha_inicio }),
        ...(config.fecha_fin && { fecha_fin: config.fecha_fin }),
      };
      const result = await getPac(params);
      setContractsList(Array.isArray(result?.items) ? result.items : []);
    } catch {
      setContractsList([]);
    } finally {
      setContractsLoading(false);
    }
  }, [config]);

  const handleApplyConfig = async () => {
    setConfig(draft);
    setShowConfig(false);
    await setPreferencia(CONFIG_KEY, draft);
    fetchInsights(draft);
  };

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const persistHistory = (next) => {
    localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  };
  const histMarkAllRead = () => persistHistory(history.map((h) => ({ ...h, read: true })));
  const histDeleteOne = (id) => persistHistory(history.filter((h) => h.id !== id));
  const histClearAll = () => persistHistory([]);
  const histMarkOneRead = (id) => persistHistory(history.map((h) => h.id === id ? { ...h, read: true } : h));

  const unreadCount = history.filter((h) => !h.read).length;

  if (!open) return null;

  const o = insights || {};
  const pctOutliers = Number(o.pct_outliers || 0);
  const outlierTone = pctOutliers > 10 ? "critical" : pctOutliers > 5 ? "warning" : "positive";
  const sobreTone = Number(o.total_sobre_umbral || 0) > 0 ? "warning" : "positive";

  return (
    <>
      <div
        className="panel-overlay"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
      />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(460px, 94vw)", zIndex: 901,
        background: "var(--bg-panel)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.22s ease",
      }}>
        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-soft)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bell size={18} style={{ color: "var(--accent)" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Alertas e Insights
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                Análisis sobre el dataset completo
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="icon-button"
              onClick={() => setShowConfig((v) => !v)}
              title="Configurar umbrales"
              aria-label="Configurar alertas"
              style={{ color: showConfig ? "var(--accent)" : undefined }}
            >
              <Settings size={16} />
            </button>
            <button
              className="icon-button"
              onClick={() => fetchInsights(config)}
              title="Actualizar"
              aria-label="Actualizar insights"
            >
              <RefreshCw size={16} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
            <button className="icon-button" onClick={onClose} aria-label="Cerrar panel">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Config panel */}
        {showConfig && (
          <div style={{ padding: "14px 20px 16px", borderBottom: "1px solid var(--line)", background: "var(--bg-main)", flexShrink: 0 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={12} /> Configurar criterios de alerta
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Umbral mínimo ($)</span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={draft.umbral}
                  onChange={(e) => handleDraftChange("umbral", Number(e.target.value))}
                  style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", color: "var(--text-primary)", fontSize: 13 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Tipo de contrato</span>
                <select
                  value={draft.tipo_compra}
                  onChange={(e) => handleDraftChange("tipo_compra", e.target.value)}
                  style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  <option value="">Todos</option>
                  {(catalogos?.tipos_compra || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Régimen</span>
                <select
                  value={draft.t_regimen}
                  onChange={(e) => handleDraftChange("t_regimen", e.target.value)}
                  style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  <option value="">Todos</option>
                  {(catalogos?.regimenes || []).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Procedimiento</span>
                <select
                  value={draft.procedimiento}
                  onChange={(e) => handleDraftChange("procedimiento", e.target.value)}
                  style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", color: "var(--text-primary)", fontSize: 13 }}
                >
                  <option value="">Todos</option>
                  {(catalogos?.procedimientos || []).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Fecha inicio</span>
                <input
                  type="date"
                  value={draft.fecha_inicio}
                  onChange={(e) => handleDraftChange("fecha_inicio", e.target.value)}
                  style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", color: "var(--text-primary)", fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="primary-btn" style={{ fontSize: 13, padding: "8px 16px" }} onClick={handleApplyConfig}>
                Aplicar y guardar
              </button>
              <button className="ghost-btn" style={{ fontSize: 13 }} onClick={() => setShowConfig(false)}>
                Cancelar
              </button>
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
              Tu configuración se guarda en la base de datos y se aplica en tu próxima sesión.
            </p>
          </div>
        )}

        {/* Insights */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Resumen de filtros activos */}
          {(config.tipo_compra || config.t_regimen || config.procedimiento || config.fecha_inicio) && (
            <div style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Filter size={11} style={{ marginTop: 1 }} />
              Filtrando por:
              {config.tipo_compra && <strong>{config.tipo_compra}</strong>}
              {config.t_regimen && <strong>{config.t_regimen}</strong>}
              {config.procedimiento && <strong>{config.procedimiento}</strong>}
              {config.fecha_inicio && <strong>desde {config.fecha_inicio}</strong>}
            </div>
          )}

          {/* Vista lista de contratos */}
          {contractsView ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <button
                  className="icon-button"
                  onClick={() => setContractsView(null)}
                  title="Volver a insights"
                  style={{ flexShrink: 0 }}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {contractsView === "outliers" ? "Outliers detectados" : `Contratos sobre ${formatMoney(config.umbral)}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                    {contractsLoading ? "Cargando…" : `${contractsList.length} contratos · clic para ver detalle`}
                  </p>
                </div>
              </div>

              {contractsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 10, color: "var(--text-secondary)" }}>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Cargando contratos…
                </div>
              ) : contractsList.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13, marginTop: 40 }}>
                  No se encontraron contratos para este criterio.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {contractsList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openContract(item)}
                      style={{
                        textAlign: "left", background: "var(--bg-soft)", border: "1px solid var(--line)",
                        borderRadius: "var(--radius-sm)", padding: "10px 12px", cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 4, width: "100%",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word", lineHeight: 1.3 }}>
                        {item.Entidad || "Entidad desconocida"}
                      </span>
                      {item.Descripcion && (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          {item.Descripcion.length > 80 ? item.Descripcion.slice(0, 80) + "…" : item.Descripcion}
                        </span>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <DollarSign size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>
                          {formatMoney(item.V_Total_Numeric)}
                        </span>
                        {item.Provincia && (
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 4 }}>· {item.Provincia}</span>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Ver todos en Vista Detallada */}
                  <button
                    onClick={() => handleViewAll(contractsView === "outliers" ? insights?.outlier_limit : config.umbral)}
                    style={{
                      marginTop: 4, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 0", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-soft))",
                      border: "1px dashed color-mix(in srgb, var(--accent) 30%, var(--line))",
                      borderRadius: "var(--radius-sm)", cursor: "pointer",
                      fontSize: 13, fontWeight: 700, color: "var(--accent)",
                    }}
                  >
                    <ExternalLink size={14} />
                    Ver todos en Vista Detallada
                  </button>
                </div>
              )}
            </>
          ) : loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 10, color: "var(--text-secondary)" }}>
              <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
              Analizando dataset completo…
            </div>
          ) : !insights ? (
            <div style={{ textAlign: "center", paddingTop: 48 }}>
              <AlertTriangle size={32} style={{ color: "var(--text-secondary)", opacity: 0.3, marginBottom: 12 }} />
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No se pudieron cargar los insights.</p>
              <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => fetchInsights(config)}>Reintentar</button>
            </div>
          ) : (
            <>
              {/* Cards de insights */}
              <InsightCard
                icon={AlertTriangle}
                label="Outliers detectados (IQR)"
                value={`${(o.total_outliers || 0).toLocaleString("es-EC")} contratos`}
                sub={`${o.pct_outliers || 0}% del total · umbral estadístico: ${formatMoney(o.outlier_limit)}`}
                tone={outlierTone}
                onViewList={() => fetchContractsList("outliers", o.outlier_limit)}
              />

              <InsightCard
                icon={TrendingUp}
                label={`Contratos sobre umbral (${formatMoney(config.umbral)})`}
                value={`${(o.total_sobre_umbral || 0).toLocaleString("es-EC")} contratos`}
                sub={`De ${(o.total_registros || 0).toLocaleString("es-EC")} contratos totales analizados`}
                tone={sobreTone}
                onViewList={() => fetchContractsList("sobre_umbral", config.umbral)}
              />

              <InsightCard
                icon={BarChart2}
                label="Promedio por contrato"
                value={formatMoney(o.avg_monto)}
                sub={`Rango: ${formatMoney(o.min_monto)} – ${formatMoney(o.max_monto)}`}
                tone="normal"
              />

              {/* Estadísticas adicionales */}
              <div style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Distribución estadística
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                  {[
                    ["Q1 (25%)", formatMoney(o.q1)],
                    ["Q3 (75%)", formatMoney(o.q3)],
                    ["IQR", formatMoney(o.iqr)],
                    ["Máximo", formatMoney(o.max_monto)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                      <strong style={{ color: "var(--text-primary)" }}>{val}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
                Análisis sobre <strong>{(o.total_positivos || 0).toLocaleString("es-EC")}</strong> contratos con valor positivo
                · Umbral actual: <strong>{formatMoney(config.umbral)}</strong>
              </p>
            </>
          )}
        </div>

        {/* Historial de alertas */}
        <div style={{ borderTop: "1px solid var(--line)", flexShrink: 0 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", background: "none", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} style={{ color: "var(--text-secondary)" }} />
              Historial de alertas
              {unreadCount > 0 && (
                <span style={{ background: "var(--danger,#d23f57)", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>
                  {unreadCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{showHistory ? "▲" : "▼"}</span>
          </button>

          {showHistory && (
            <div style={{ maxHeight: 320, overflowY: "auto", background: "var(--bg-main)" }}>
              {/* Acciones bulk */}
              {history.length > 0 && (
                <div style={{ display: "flex", gap: 8, padding: "0 16px 10px", flexWrap: "wrap" }}>
                  {unreadCount > 0 && (
                    <button className="ghost-btn" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }} onClick={histMarkAllRead}>
                      <CheckCheck size={12} /> Marcar todas leidas
                    </button>
                  )}
                  <button
                    className="ghost-btn"
                    style={{ fontSize: 11, color: "var(--danger,#d23f57)", display: "flex", alignItems: "center", gap: 4 }}
                    onClick={histClearAll}
                  >
                    <Trash2 size={12} /> Borrar historial
                  </button>
                </div>
              )}

              {history.length === 0 ? (
                <p style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                  Sin historial de alertas.
                </p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
                      padding: "10px 16px", borderTop: "1px solid var(--line)",
                      background: item.read ? "transparent" : "color-mix(in srgb, var(--accent) 4%, transparent)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!item.read && (
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginRight: 6, verticalAlign: "middle" }} />
                      )}
                      <strong style={{ fontSize: 12, color: "var(--text-primary)" }}>{item.title}</strong>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>{item.reason}</p>
                      <small style={{ fontSize: 10, color: "var(--text-secondary)", opacity: 0.7 }}>
                        {new Date(item.createdAt).toLocaleString("es-EC")}
                      </small>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {!item.read && (
                        <button className="ghost-btn" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => histMarkOneRead(item.id)}>
                          Leida
                        </button>
                      )}
                      <button
                        className="ghost-btn"
                        style={{ fontSize: 10, padding: "3px 7px", color: "var(--danger,#d23f57)" }}
                        onClick={() => histDeleteOne(item.id)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
