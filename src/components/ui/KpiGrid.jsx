import { Building2, DollarSign, MapPinned, MapPinHouse, Rows4 } from "lucide-react";

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const ICONS = [Rows4, Building2, MapPinned, MapPinHouse, DollarSign];

export default function KpiGrid({ kpis }) {
  const items = [
    {
      label: "Total registros",
      value: (kpis?.total_registros || 0).toLocaleString("es-EC"),
      trend: "+8.4%",
      status: "up",
    },
    {
      label: "Total entidades",
      value: (kpis?.total_entidades || 0).toLocaleString("es-EC"),
      trend: "+2.1%",
      status: "up",
    },
    {
      label: "Total provincias",
      value: (kpis?.total_provincias || 0).toLocaleString("es-EC"),
      trend: "0.0%",
      status: "neutral",
    },
    {
      label: "Total ciudades",
      value: (kpis?.total_ciudades || 0).toLocaleString("es-EC"),
      trend: "+3.2%",
      status: "up",
    },
    {
      label: "Monto total",
      value: formatMoney(kpis?.monto_total || 0),
      trend: "+12.7%",
      status: "up",
    },
  ];

  return (
    <div className="kpi-grid-modern">
      {items.map((item, index) => {
        const Icon = ICONS[index];

        return (
          <article className="glass-card kpi-card-modern" key={item.label}>
            <div className="kpi-header">
              <span>{item.label}</span>
              <Icon size={18} />
            </div>
            <strong>{item.value}</strong>
            <small className={`trend ${item.status}`}>{item.trend} vs mes anterior</small>
          </article>
        );
      })}
    </div>
  );
}
