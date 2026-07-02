import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { useIsAuthenticated } from "@azure/msal-react";
import AppShell from "./components/layout/AppShell";
import { ThemeProvider } from "./context/ThemeContext";
import { ContractProvider } from "./context/ContractContext";
import AppErrorBoundary from "./components/ui/AppErrorBoundary";
import { useUser } from "./context/UserContext";
import LoginPage from "./pages/LoginPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";

const DashboardView = lazy(() => import("./pages/views/DashboardView"));
const DetalleView = lazy(() => import("./pages/views/DetalleView"));
const TerritorialView = lazy(() => import("./pages/views/TerritorialView"));
const TemporalView = lazy(() => import("./pages/views/TemporalView"));
const ReportesView = lazy(() => import("./pages/views/ReportesView"));
const InsightsView = lazy(() => import("./pages/views/InsightsView"));
const ComparadorView = lazy(() => import("./pages/views/ComparadorView"));
const EntidadView = lazy(() => import("./pages/views/EntidadView"));
const ConfiguracionView = lazy(() => import("./pages/views/ConfiguracionView"));
const AdminView = lazy(() => import("./pages/views/AdminView"));

const VALID_PAGES = [
  "dashboard",
  "detalle",
  "territorial",
  "temporal",
  "reportes",
  "insights",
  "comparador",
  "entidad",
  "configuracion",
  "usuarios",
];

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 0% 0%, rgba(41,62,70,0.14), transparent 32%), radial-gradient(circle at 100% 20%, rgba(231,94,13,0.11), transparent 42%), var(--bg-main, #f3f6fb)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg, var(--accent, #293E46), var(--accent-2, #E75E0D))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: 16,
          color: "#fff",
          boxShadow: "0 8px 24px rgba(41,62,70,0.2)",
        }}>
          OP
        </div>
        <div style={{
          width: 32,
          height: 32,
          border: "2.5px solid var(--line, #d5dfed)",
          borderTop: "2.5px solid var(--accent, #293E46)",
          borderRadius: "50%",
          animation: "spin 0.85s linear infinite",
        }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary, #5f728b)", margin: 0 }}>
          Verificando acceso…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AuthErrorPage({ title, message, showLogout = false }) {
  const { logout } = useUser();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 0% 0%, rgba(41,62,70,0.14), transparent 32%), radial-gradient(circle at 100% 20%, rgba(231,94,13,0.11), transparent 42%), var(--bg-main, #f3f6fb)",
      padding: 24,
    }}>
      <div style={{
        background: "var(--bg-panel, #fff)",
        border: "1px solid color-mix(in srgb, var(--danger, #d23f57) 30%, var(--line, #d5dfed))",
        borderRadius: 20,
        padding: "36px 32px",
        width: "100%",
        maxWidth: 420,
        textAlign: "center",
        boxShadow: "var(--shadow-soft, 0 18px 40px rgba(24,45,74,0.1))",
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "color-mix(in srgb, var(--danger, #d23f57) 15%, transparent)",
          border: "1px solid color-mix(in srgb, var(--danger, #d23f57) 30%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          margin: "0 auto 16px",
        }}>⚠</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary, #12243b)", margin: "0 0 10px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {title}
        </h2>
        {message && (
          <p style={{ fontSize: 13, color: "var(--text-secondary, #5f728b)", margin: "0 0 24px", lineHeight: 1.6, wordBreak: "break-word" }}>
            {message}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => window.location.reload()}
            className="primary-btn"
            style={{ width: "100%", justifyContent: "center", padding: "11px 20px" }}
          >
            Reintentar
          </button>
          {showLogout && (
            <button
              onClick={logout}
              className="ghost-btn"
              style={{ width: "100%", justifyContent: "center", padding: "11px 20px" }}
            >
              Cerrar sesión y volver a entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const isAuthenticated = useIsAuthenticated();
  const { appUser, loading, authError, authErrorDetail } = useUser();

  if (!isAuthenticated) return <LoginPage />;
  if (loading) return <LoadingScreen />;
  if (authError === "access_denied") return <AccessDeniedPage />;
  if (authError === "network_error") return (
    <AuthErrorPage
      title="Servidor no disponible"
      message={authErrorDetail || `No se pudo conectar con el backend en ${import.meta.env.VITE_API_URL}`}
    />
  );
  if (authError === "token_error") return (
    <AuthErrorPage title="Sesión expirada" message={authErrorDetail} showLogout />
  );
  if (authError === "server_error" || authError === "unknown_error") return (
    <AuthErrorPage title="Error al verificar acceso" message={authErrorDetail} showLogout />
  );
  if (!appUser) return <LoadingScreen />;

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [globalSearch, setGlobalSearch] = useState("");
  const [stats, setStats] = useState({
    activeFiltersCount: 0,
    bookmarksCount: 0,
    lastUpdatedAt: null,
    unreadAlertsCount: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser } = useUser();

  const activePage = useMemo(() => {
    const page = location.pathname.replace("/", "") || "dashboard";
    return VALID_PAGES.includes(page) ? page : "dashboard";
  }, [location.pathname]);

  useEffect(() => {
    const started = performance.now();
    const key = "pac.routeUsage";
    let usage = {};
    try {
      usage = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      usage = {};
    }
    usage[activePage] = Number(usage[activePage] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(usage));
    const routeChanges = Number(sessionStorage.getItem("pac.routeChanges") || 0) + 1;
    sessionStorage.setItem("pac.routeChanges", String(routeChanges));
    const ended = performance.now();
    const routePerfKey = "pac.routePerf";
    const snapshot = {
      route: activePage,
      measuredAt: new Date().toISOString(),
      renderMs: Number((ended - started).toFixed(2)),
    };
    try {
      const history = JSON.parse(localStorage.getItem(routePerfKey) || "[]");
      const nextHistory = [snapshot, ...history].slice(0, 120);
      localStorage.setItem(routePerfKey, JSON.stringify(nextHistory));
    } catch {
      localStorage.setItem(routePerfKey, JSON.stringify([snapshot]));
    }
  }, [activePage]);

  const routeInsights = (() => {
    try {
      const usage = JSON.parse(localStorage.getItem("pac.routeUsage") || "{}");
      const hottestRoute =
        Object.entries(usage).sort((a, b) => b[1] - a[1])[0]?.[0] || "dashboard";
      const routeChanges = Number(sessionStorage.getItem("pac.routeChanges") || 0);
      return { hottestRoute, routeChanges };
    } catch {
      return { hottestRoute: "dashboard", routeChanges: 0 };
    }
  })();

  const handleStatsChange = useCallback((next) => {
    setStats((prev) => ({ ...prev, ...next }));
  }, []);

  const sharedProps = useMemo(
    () => ({ globalSearch, onStatsChange: handleStatsChange }),
    [globalSearch, handleStatsChange]
  );

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <ContractProvider>
        <AppShell
          activePage={activePage}
          onChangePage={(next) => navigate(`/${next}`)}
          activeFiltersCount={stats.activeFiltersCount}
          bookmarksCount={stats.bookmarksCount}
          lastUpdatedAt={stats.lastUpdatedAt}
          hottestRoute={routeInsights.hottestRoute}
          routeChanges={routeInsights.routeChanges}
          unreadAlertsCount={stats.unreadAlertsCount}
          userRole={appUser?.rol}
        >
          <Suspense fallback={<div className="glass-card">Cargando vista...</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardView {...sharedProps} />} />
              <Route path="/detalle" element={<DetalleView {...sharedProps} />} />
              <Route path="/territorial" element={<TerritorialView {...sharedProps} />} />
              <Route path="/temporal" element={<TemporalView {...sharedProps} />} />
              <Route path="/reportes" element={<ReportesView {...sharedProps} />} />
              <Route path="/insights" element={<InsightsView {...sharedProps} />} />
              <Route path="/comparador" element={<ComparadorView {...sharedProps} />} />
              <Route path="/entidad" element={<EntidadView {...sharedProps} />} />
              <Route path="/configuracion" element={<ConfiguracionView {...sharedProps} />} />
              <Route
                path="/usuarios"
                element={
                  appUser?.rol === "administrador" ? (
                    <AdminView />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
        </ContractProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
