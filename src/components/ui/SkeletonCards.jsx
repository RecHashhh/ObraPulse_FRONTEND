export default function SkeletonCards() {
  return (
    <div className="kpi-grid-modern skeleton-grid" aria-label="Cargando indicadores">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="glass-card skeleton-card" key={index}>
          <div className="skeleton-line short" />
          <div className="skeleton-line large" />
          <div className="skeleton-line medium" />
        </div>
      ))}
    </div>
  );
}
