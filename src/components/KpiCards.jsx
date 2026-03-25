function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function KpiCards({ kpis }) {
  const items = [
    { label: "Total registros", value: kpis?.total_registros ?? 0 },
    { label: "Total entidades", value: kpis?.total_entidades ?? 0 },
    { label: "Total provincias", value: kpis?.total_provincias ?? 0 },
    { label: "Total ciudades", value: kpis?.total_ciudades ?? 0 },
    { label: "Monto total", value: formatMoney(kpis?.monto_total ?? 0) },
  ];

  return (
    <div className="kpi-grid">
      {items.map((item) => (
        <div className="card kpi-card" key={item.label}>
          <p className="kpi-label">{item.label}</p>
          <h3 className="kpi-value">{item.value}</h3>
        </div>
      ))}
    </div>
  );
}