export default function FilterChips({ filters, onClearOne, onClearAll }) {
  const entries = Object.entries(filters || {}).filter(([, value]) => value !== "");

  if (!entries.length) return null;

  const labels = {
    entidad: "Entidad",
    provincia: "Provincia",
    ciudad: "Ciudad",
    tipo_compra: "Tipo compra",
    procedimiento: "Procedimiento",
    fecha_inicio: "Desde",
    fecha_fin: "Hasta",
    valor_min: "Monto min",
    valor_max: "Monto max",
  };

  return (
    <section className="chips-row">
      <div className="chips-wrap">
        {entries.map(([key, value]) => (
          <button key={key} className="chip-modern" onClick={() => onClearOne(key)}>
            {labels[key] || key}: {value} <span>×</span>
          </button>
        ))}
      </div>

      <button className="ghost-btn" onClick={onClearAll}>
        Limpiar filtros
      </button>
    </section>
  );
}
