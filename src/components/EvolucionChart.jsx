import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function EvolucionChart({ data }) {
  return (
    <div className="card chart-card">
      <h3>Evolución por fecha</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="Fecha_Carga" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="total_registros" stroke="#6366f1" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}