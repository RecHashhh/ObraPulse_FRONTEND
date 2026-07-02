import {
  BarChart3,
  Building2,
  Compass,
  FileDown,
  Gauge,
  Landmark,
  Settings,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { useUser } from "../../context/UserContext";

const ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "detalle", label: "Vista Detallada", icon: Table2 },
  { id: "territorial", label: "Vista Territorial", icon: Landmark },
  { id: "temporal", label: "Vista Temporal", icon: BarChart3 },
  { id: "reportes", label: "Reportes", icon: FileDown },
  { id: "insights", label: "Alertas e Insights", icon: Sparkles },
  { id: "comparador", label: "Comparador", icon: Compass },
  { id: "entidad", label: "Vista de Entidad", icon: Building2 },
  { id: "configuracion", label: "Configuracion", icon: Settings },
  { id: "usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];

export default function Sidebar({ collapsed, activePage, onSelectPage, onToggle }) {
  const { appUser } = useUser();
  const isAdmin = appUser?.rol === "administrador";

  const visibleItems = ITEMS.filter((item) => !item.adminOnly || isAdmin);

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
        {visibleItems.map((item) => {
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
