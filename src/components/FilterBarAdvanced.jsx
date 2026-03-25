import { useState } from "react";

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

export default function FilterBarAdvanced({
  catalogos,
  onApplyFilters,
  onResetFilters,
}) {
  const [filters, setFilters] = useState(initialState);

  const handleChange = (e) => {
    const { name, value } = e.target;

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

  const apply = () => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "")
    );
    onApplyFilters(clean);
  };

  const reset = () => {
    setFilters(initialState);
    onResetFilters();
  };

  return (
    <div className="card filter-card">
      <h3>Filtros inteligentes</h3>

      <div className="filters-grid">

        <select name="provincia" value={filters.provincia} onChange={handleChange}>
          <option value="">Provincia</option>
          {(catalogos?.provincias || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select name="ciudad" value={filters.ciudad} onChange={handleChange}>
          <option value="">Ciudad</option>
          {(catalogos?.ciudades || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select name="entidad" value={filters.entidad} onChange={handleChange}>
          <option value="">Entidad</option>
          {(catalogos?.entidades || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select name="tipo_compra" value={filters.tipo_compra} onChange={handleChange}>
          <option value="">Tipo compra</option>
          {(catalogos?.tipos_compra || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select name="procedimiento" value={filters.procedimiento} onChange={handleChange}>
          <option value="">Procedimiento</option>
          {(catalogos?.procedimientos || []).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <input type="date" name="fecha_inicio" value={filters.fecha_inicio} onChange={handleChange} />
        <input type="date" name="fecha_fin" value={filters.fecha_fin} onChange={handleChange} />
        <input type="number" name="valor_min" placeholder="Valor mínimo" value={filters.valor_min} onChange={handleChange} />
        <input type="number" name="valor_max" placeholder="Valor máximo" value={filters.valor_max} onChange={handleChange} />
      </div>

      <div className="actions">
        <button onClick={apply}>Aplicar filtros</button>
        <button className="secondary" onClick={reset}>Limpiar</button>
      </div>
    </div>
  );
}