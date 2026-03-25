export default function EmptyState({ title = "No hay datos", message = "No se encontraron resultados para los filtros aplicados." }) {
  return (
    <div className="card empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}