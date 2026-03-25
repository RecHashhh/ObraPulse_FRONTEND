import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
} from "recharts";

export default function TopEntidadesChart({ data }) {
  return (
    <div className="card chart-card">
      <h3>Top 10 entidades</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="Entidad" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="Monto" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}