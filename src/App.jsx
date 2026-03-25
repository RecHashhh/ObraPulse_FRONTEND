import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { ThemeProvider } from "./context/ThemeContext";
import AppErrorBoundary from "./components/ui/AppErrorBoundary";

const DashboardView = lazy(() => import("./pages/views/DashboardView"));
const DetalleView = lazy(() => import("./pages/views/DetalleView"));
const TerritorialView = lazy(() => import("./pages/views/TerritorialView"));
const TemporalView = lazy(() => import("./pages/views/TemporalView"));
const ReportesView = lazy(() => import("./pages/views/ReportesView"));
const InsightsView = lazy(() => import("./pages/views/InsightsView"));
const ComparadorView = lazy(() => import("./pages/views/ComparadorView"));
const EntidadView = lazy(() => import("./pages/views/EntidadView"));
const ConfiguracionView = lazy(() => import("./pages/views/ConfiguracionView"));

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
];

export default function App() {
  const [globalSearch, setGlobalSearch] = useState("");
  const [stats, setStats] = useState({
    activeFiltersCount: 0,
    bookmarksCount: 0,
    lastUpdatedAt: null,
    unreadAlertsCount: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();

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
    setStats((prev) => ({
      ...prev,
      ...next,
    }));
  }, []);

  const sharedProps = useMemo(
    () => ({
      globalSearch,
      onStatsChange: handleStatsChange,
    }),
    [globalSearch, handleStatsChange]
  );

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AppShell
          activePage={activePage}
          onChangePage={(next) => navigate(`/${next}`)}
          activeFiltersCount={stats.activeFiltersCount}
          bookmarksCount={stats.bookmarksCount}
          lastUpdatedAt={stats.lastUpdatedAt}
          hottestRoute={routeInsights.hottestRoute}
          routeChanges={routeInsights.routeChanges}
          unreadAlertsCount={stats.unreadAlertsCount}
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
              <Route
                path="/configuracion"
                element={<ConfiguracionView {...sharedProps} />}
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

