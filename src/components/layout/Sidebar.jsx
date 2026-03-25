import {
  BarChart3,
  Bell,
  Compass,
  FileDown,
  Gauge,
  Landmark,
  Settings,
  Sparkles,
  Table2,
} from "lucide-react";

const ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "detalle", label: "Vista Detallada", icon: Table2 },
  { id: "territorial", label: "Vista Territorial", icon: Landmark },
  { id: "temporal", label: "Vista Temporal", icon: BarChart3 },
  { id: "reportes", label: "Reportes", icon: FileDown },
  { id: "insights", label: "Alertas e Insights", icon: Sparkles },
  { id: "comparador", label: "Comparador", icon: Compass },
  { id: "entidad", label: "Vista de Entidad", icon: Bell },
  { id: "configuracion", label: "Configuracion", icon: Settings },
];

export default function Sidebar({ collapsed, activePage, onSelectPage, onToggle }) {
  return (
    <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
      <button className="brand" onClick={onToggle}>
        <span className="brand-mark">PAC</span>
        {!collapsed && (
          <div className="brand-copy">
            <strong>ObraPulse</strong>
            <small>Public Analytics Cloud</small>
          </div>
        )}
      </button>

      <nav className="menu">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`menu-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => onSelectPage(item.id)}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
