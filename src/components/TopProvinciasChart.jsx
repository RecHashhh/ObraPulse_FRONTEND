import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
} from "recharts";

export default function TopProvinciasChart({ data }) {
  return (
    <div className="card chart-card">
      <h3>Top 10 provincias</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="Provincia" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="monto_total" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}