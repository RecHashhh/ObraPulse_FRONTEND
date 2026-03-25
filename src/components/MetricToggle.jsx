export default function MetricToggle({ metric, onChange }) {
  return (
    <div className="metric-toggle">
      <button
        className={metric === "monto" ? "active" : ""}
        onClick={() => onChange("monto")}
      >
        Ver por monto
      </button>
      <button
        className={metric === "registros" ? "active" : ""}
        onClick={() => onChange("registros")}
      >
        Ver por registros
      </button>
    </div>
  );
}