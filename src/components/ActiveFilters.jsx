export default function ActiveFilters({ filters, onClearOne, onClearAll }) {
  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  if (!entries.length) return null;

  const formatLabel = (key, value) => {
    const labels = {
      entidad: "Entidad",
      provincia: "Provincia",
      ciudad: "Ciudad",
      tipo_compra: "Tipo compra",
      procedimiento: "Procedimiento",
      fecha_inicio: "Desde",
      fecha_fin: "Hasta",
      valor_min: "Valor mínimo",
      valor_max: "Valor máximo",
    };

    return `${labels[key] || key}: ${value}`;
  };

  return (
    <div className="card active-filters-card">
      <div className="active-filters-header">
        <h3>Filtros activos</h3>
        <button className="secondary" onClick={onClearAll}>
          Limpiar todo
        </button>
      </div>

      <div className="chips">
        {entries.map(([key, value]) => (
          <div className="chip" key={key}>
            <span>{formatLabel(key, value)}</span>
            <button className="chip-close" onClick={() => onClearOne(key)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}