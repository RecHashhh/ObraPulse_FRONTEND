import { useState } from "react";
import { Save } from "lucide-react";

const initialState = {
  provincia: "",
  ciudad: "",
  entidad: "",
  tipo_compra: "",
  procedimiento: "",
  fecha_inicio: "",
  fecha_fin: "",
  valor_min: "",
  valor_max: "",
};

export default function FilterPanel({
  catalogos,
  onApply,
  onReset,
  onSaveView,
  savedViews,
  onLoadView,
}) {
  const [filters, setFilters] = useState(initialState);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "provincia") {
        next.ciudad = "";
        next.entidad = "";
      }
      if (name === "ciudad") {
        next.entidad = "";
      }
      return next;
    });
  };

  const applyFilters = () => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "")
    );
    onApply(clean);
  };

  const handleReset = () => {
    setFilters(initialState);
    onReset();
  };

  const handleSave = () => {
    const name = window.prompt("Nombre de la vista guardada:");
    if (!name) return;

    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "")
    );
    onSaveView(name, clean);
  };

  return (
    <section className="glass-card filter-panel">
      <header>
        <div>
          <h2>Filtros Inteligentes</h2>
          <p>Refina por ubicacion, tipo de compra, procedimiento, fechas y montos.</p>
        </div>

        <div className="filter-actions">
          <select onChange={(event) => onLoadView(event.target.value)} defaultValue="">
            <option value="">Cargar vista guardada</option>
            {savedViews.map((view) => (
              <option key={view.name} value={view.name}>
                {view.name}
              </option>
            ))}
          </select>

          <button className="ghost-btn" onClick={handleSave}>
            <Save size={14} /> Guardar vista
          </button>
        </div>
      </header>

      <div className="filters-grid-modern">
        <select name="provincia" value={filters.provincia} onChange={handleChange}>
          <option value="">Provincia</option>
          {(catalogos?.provincias || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select name="ciudad" value={filters.ciudad} onChange={handleChange}>
          <option value="">Ciudad</option>
          {(catalogos?.ciudades || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select name="entidad" value={filters.entidad} onChange={handleChange}>
          <option value="">Entidad</option>
          {(catalogos?.entidades || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select name="tipo_compra" value={filters.tipo_compra} onChange={handleChange}>
          <option value="">Tipo de compra</option>
          {(catalogos?.tipos_compra || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          name="procedimiento"
          value={filters.procedimiento}
          onChange={handleChange}
        >
          <option value="">Procedimiento</option>
          {(catalogos?.procedimientos || []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="fecha_inicio"
          value={filters.fecha_inicio}
          onChange={handleChange}
        />
        <input
          type="date"
          name="fecha_fin"
          value={filters.fecha_fin}
          onChange={handleChange}
        />
        <input
          type="number"
          name="valor_min"
          placeholder="Monto minimo"
          value={filters.valor_min}
          onChange={handleChange}
        />
        <input
          type="number"
          name="valor_max"
          placeholder="Monto maximo"
          value={filters.valor_max}
          onChange={handleChange}
        />
      </div>

      <footer className="filters-footer">
        <button className="primary-btn apply-filter-btn" onClick={applyFilters}>
          Aplicar filtros
        </button>
        <button className="ghost-btn" onClick={handleReset}>
          Limpiar
        </button>
      </footer>
    </section>
  );
}
