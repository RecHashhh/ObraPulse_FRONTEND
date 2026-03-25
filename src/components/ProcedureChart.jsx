import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ProcedureChart({ data, metric = "monto" }) {
  const dataKey = metric === "monto" ? "monto_total" : "total_registros";

  return (
    <div className="card chart-card">
      <h3>Distribución por procedimiento</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="Procedimiento" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey={dataKey} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}