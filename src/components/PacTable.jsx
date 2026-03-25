function formatMoney(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function PacTable({ data, page, total, pageSize, onPageChange }) {
  const totalPages = Math.ceil((total || 0) / pageSize);

  return (
    <div className="card">
      <div className="table-header">
        <h3>Resultados</h3>
        <span>Total: {total}</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Entidad</th>
              <th>Provincia</th>
              <th>Ciudad</th>
              <th>Tipo compra</th>
              <th>Procedimiento</th>
              <th>Descripción</th>
              <th>Valor</th>
              <th>Fecha carga</th>
            </tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((item) => (
                <tr key={item.id}>
                  <td>{item.Entidad}</td>
                  <td>{item.Provincia}</td>
                  <td>{item.Ciudad}</td>
                  <td>{item.T_Compra}</td>
                  <td>{item.Procedimiento}</td>
                  <td>{item.Descripcion}</td>
                  <td>{formatMoney(item.V_Total_Numeric)}</td>
                  <td>{item.Fecha_Carga}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">No hay datos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </button>
        <span>Página {page} de {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}