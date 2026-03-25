import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function HistogramChart({ data }) {
  return (
    <div className="card chart-card">
      <h3>Distribución de montos</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rango" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total_registros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}