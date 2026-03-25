import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "./CommandPalette";
import OnboardingTour from "./OnboardingTour";
import { useTheme } from "../../context/ThemeContext";

const PAGE_TITLES = {
  dashboard: "Dashboard Ejecutivo",
  detalle: "Vista Detallada",
  territorial: "Inteligencia Territorial",
  temporal: "Evolucion Temporal",
  reportes: "Centro de Reportes",
  insights: "Alertas e Insights",
  comparador: "Comparador Analitico",
  entidad: "Perfil de Entidad",
  configuracion: "Configuracion del Usuario",
};

export default function AppShell({
  activePage,
  onChangePage,
  children,
  activeFiltersCount,
  bookmarksCount,
  lastUpdatedAt,
  hottestRoute,
  routeChanges,
  unreadAlertsCount,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSession, setPaletteSession] = useState(0);
  const { toggleTheme } = useTheme();

  const pageTitle = useMemo(
    () => PAGE_TITLES[activePage] || "Dashboard",
    [activePage]
  );

  const paletteActions = useMemo(
    () => [
      {
        id: "goto-dashboard",
        label: "Ir a Dashboard",
        description: "Vista ejecutiva principal",
        run: () => onChangePage("dashboard"),
      },
      {
        id: "goto-detalle",
        label: "Ir a Vista Detallada",
        description: "Tabla avanzada y registros",
        run: () => onChangePage("detalle"),
      },
      {
        id: "goto-territorial",
        label: "Ir a Territorial",
        description: "Mapa, ranking y drill-down",
        run: () => onChangePage("territorial"),
      },
      {
        id: "goto-temporal",
        label: "Ir a Temporal",
        description: "Tendencias y evolucion",
        run: () => onChangePage("temporal"),
      },
      {
        id: "goto-insights",
        label: "Ir a Insights",
        description: "Alertas accionables y recomendaciones",
        run: () => onChangePage("insights"),
      },
      {
        id: "toggle-theme",
        label: "Alternar tema",
        description: "Cambiar entre claro y oscuro",
        run: () => toggleTheme(),
      },
    ],
    [onChangePage, toggleTheme]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setPaletteSession((value) => value + 1);
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="shell-root">
      <Sidebar
        collapsed={collapsed}
        activePage={activePage}
        onSelectPage={onChangePage}
        onToggle={() => setCollapsed((prev) => !prev)}
      />

      <main className={`shell-main ${collapsed ? "expanded" : ""}`}>
        <Topbar
          pageTitle={pageTitle}
          activeFiltersCount={activeFiltersCount}
          bookmarksCount={bookmarksCount}
          lastUpdatedAt={lastUpdatedAt}
          hottestRoute={hottestRoute}
          routeChanges={routeChanges}
          unreadAlertsCount={unreadAlertsCount}
          onOpenPalette={() => {
            setPaletteSession((value) => value + 1);
            setPaletteOpen(true);
          }}
        />
        <section className="shell-content">{children}</section>
      </main>

      <CommandPalette
        key={paletteSession}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />

      <OnboardingTour activePage={activePage} onChangePage={onChangePage} />
    </div>
  );
}
