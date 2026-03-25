export default function ViewSelector({ view, onChange }) {
  const views = [
    { key: "resumen", label: "Resumen" },
    { key: "territorial", label: "Territorial" },
    { key: "temporal", label: "Temporal" },
    { key: "detalle", label: "Detalle" },
  ];

  return (
    <div className="view-selector">
      {views.map((item) => (
        <button
          key={item.key}
          className={view === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}