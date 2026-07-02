import { useMemo, useState } from "react";
import { ArrowUpDown, Bookmark, BookmarkCheck } from "lucide-react";
import { useContract } from "../../context/ContractContext";

function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const columns = [
  { key: "Entidad", label: "Entidad" },
  { key: "Provincia", label: "Provincia" },
  { key: "Ciudad", label: "Ciudad" },
  { key: "T_Compra", label: "Tipo compra" },
  { key: "T_Regimen", label: "Régimen" },
  { key: "Fondo_BID", label: "Fondo BID" },
  { key: "Procedimiento", label: "Procedimiento" },
  { key: "Descripcion", label: "Descripcion" },
  { key: "V_Total_Numeric", label: "Valor" },
  { key: "Fecha_Carga", label: "Fecha" },
];

export default function AdvancedTable({
  data,
  page,
  total,
  pageSize,
  onPageChange,
  globalSearch,
  onAddBookmark,
  bookmarkedIds = [],
}) {
  const { openContract } = useContract();
  const [query, setQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "V_Total_Numeric", dir: "desc" });

  const filtered = useMemo(() => {
    const lookup = `${query} ${globalSearch}`.trim().toLowerCase();
    const base = !lookup
      ? data
      : data.filter((item) =>
          [item.Entidad, item.Ciudad, item.Provincia, item.Descripcion, item.T_Regimen, item.Fondo_BID]
            .join(" ")
            .toLowerCase()
            .includes(lookup)
        );

    return [...base].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.dir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const compare = String(aVal).localeCompare(String(bVal), "es", {
        sensitivity: "base",
      });
      return sortConfig.dir === "asc" ? compare : -compare;
    });
  }, [data, query, globalSearch, sortConfig]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <section className="glass-card table-section">
      <header>
        <div>
          <h2>Tabla Avanzada</h2>
          <p>
            {total.toLocaleString("es-EC")} resultados, ordenamiento dinamico y favoritos.
          </p>
        </div>
        <input
          placeholder="Buscar en la tabla"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </header>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>
                  <button className="th-button" onClick={() => handleSort(col.key)}>
                    {col.label}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
              ))}
              <th>Favorito</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((item) => {
                const isBookmarked = bookmarkedIds.includes(item.id);
                return (
                  <tr
                    key={item.id || `${item.Entidad}-${item.Descripcion}`}
                    onClick={() => openContract(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{item.Entidad}</td>
                    <td>{item.Provincia}</td>
                    <td>{item.Ciudad}</td>
                    <td>{item.T_Compra}</td>
                    <td>{item.T_Regimen}</td>
                    <td>{item.Fondo_BID}</td>
                    <td>{item.Procedimiento}</td>
                    <td>{item.Descripcion}</td>
                    <td>{formatMoney(item.V_Total_Numeric)}</td>
                    <td>{item.Fecha_Carga}</td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={(e) => { e.stopPropagation(); onAddBookmark(item); }}
                        title={isBookmarked ? "Quitar favorito" : "Guardar favorito"}
                        aria-label={isBookmarked ? "Quitar favorito" : "Guardar favorito"}
                        style={{ color: isBookmarked ? "var(--accent)" : undefined }}
                      >
                        {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11">No hay registros para esta busqueda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <button
          className="ghost-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <span>
          Pagina {page} de {totalPages}
        </span>
        <button
          className="ghost-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </footer>
    </section>
  );
}
